import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as z from 'zod/v4'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

const IMAGE_MEDIA_TYPE_PATTERN = /^image\/[a-zA-Z0-9.+-]+$/i

export const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES_PER_CALL = 8

export interface LoadedImage {
  imageUrl: string
  mediaType: string
  sourceLabel: string
}

export interface SingleImageInput {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  imageMediaType?: string
}

export interface ImageInput extends SingleImageInput {
  images?: SingleImageInput[]
}

const singleImageShape = {
  imagePath: z
    .string()
    .min(1)
    .optional()
    .describe('Local absolute image path. Mutually exclusive with imageUrl and imageBase64.'),
  imageUrl: z
    .string()
    .url()
    .optional()
    .describe('Remote URL, data URL, or file URL. Mutually exclusive with imagePath and imageBase64.'),
  imageBase64: z
    .base64()
    .optional()
    .describe(
      'Base64-encoded image payload. Use this for uploaded attachments when the client can pass file contents.'
    ),
  imageMediaType: z
    .string()
    .regex(IMAGE_MEDIA_TYPE_PATTERN, 'imageMediaType must be an image/* MIME type.')
    .optional()
    .describe('Required with imageBase64, for example image/png or image/jpeg.')
}

function validateSingleImage(value: SingleImageInput, ctx: z.core.$RefinementCtx, path: (string | number)[] = []) {
  const provided = [value.imagePath, value.imageUrl, value.imageBase64].filter(Boolean)
  if (provided.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: 'Exactly one of imagePath, imageUrl, or imageBase64 must be provided.'
    })
  }

  if (value.imageBase64 && !value.imageMediaType) {
    ctx.addIssue({
      code: 'custom',
      path: [...path, 'imageMediaType'],
      message: 'imageMediaType is required when imageBase64 is provided.'
    })
  }

  if (!value.imageBase64 && value.imageMediaType) {
    ctx.addIssue({
      code: 'custom',
      path: [...path, 'imageMediaType'],
      message: 'imageMediaType is only supported together with imageBase64.'
    })
  }
}

export function createImageInputSchema<T extends z.core.$ZodLooseShape>(extraShape: T) {
  return z
    .object({
      ...singleImageShape,
      images: z
        .array(z.object(singleImageShape))
        .min(1)
        .max(MAX_IMAGES_PER_CALL)
        .optional()
        .describe(
          `Optional list of images (max ${MAX_IMAGES_PER_CALL}) for multi-image calls such as comparisons. ` +
            'Each entry follows the same imagePath/imageUrl/imageBase64 rules. Mutually exclusive with the top-level image fields.'
        ),
      ...extraShape
    })
    .superRefine((value, ctx) => {
      const imageValue = value as ImageInput
      const hasSingle = Boolean(imageValue.imagePath || imageValue.imageUrl || imageValue.imageBase64)
      const hasList = Array.isArray(imageValue.images)

      if (hasSingle && hasList) {
        ctx.addIssue({
          code: 'custom',
          message: 'Provide either imagePath/imageUrl/imageBase64 or images[], not both.'
        })
        return
      }

      if (!hasSingle && !hasList) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Exactly one of imagePath, imageUrl, or imageBase64 must be provided, or use images[] for multiple images.'
        })
        return
      }

      if (hasList) {
        imageValue.images?.forEach((item, index) => validateSingleImage(item, ctx, ['images', index]))
        return
      }

      validateSingleImage(imageValue, ctx)
    })
}

export async function loadImageInputs(
  input: ImageInput,
  maxImageBytes: number = DEFAULT_MAX_IMAGE_BYTES
): Promise<LoadedImage[]> {
  if (input.images && input.images.length > 0) {
    const loaded: LoadedImage[] = []
    for (const item of input.images) {
      loaded.push(await loadSingleImageInput(item, maxImageBytes))
    }
    return loaded
  }

  return [await loadSingleImageInput(input, maxImageBytes)]
}

async function loadSingleImageInput(input: SingleImageInput, maxImageBytes: number): Promise<LoadedImage> {
  if (input.imagePath) {
    return loadFromPath(input.imagePath, maxImageBytes)
  }

  if (input.imageBase64) {
    return loadFromBase64(input.imageBase64, input.imageMediaType, maxImageBytes)
  }

  if (input.imageUrl) {
    return loadFromUrl(input.imageUrl, maxImageBytes)
  }

  throw new Error('Exactly one of imagePath, imageUrl, or imageBase64 must be provided.')
}

async function loadFromPath(imagePath: string, maxImageBytes: number): Promise<LoadedImage> {
  const resolvedPath = path.resolve(imagePath)
  const stats = await stat(resolvedPath)
  if (stats.size > maxImageBytes) {
    throw new Error(`Image file too large: ${stats.size} bytes (max ${maxImageBytes} bytes)`)
  }

  const ext = path.extname(resolvedPath).toLowerCase()
  const mediaType = MIME_BY_EXT[ext]
  if (!mediaType) {
    throw new Error(`Unsupported image format: ${ext || 'unknown'}`)
  }

  const buffer = await readFile(resolvedPath)
  const base64 = buffer.toString('base64')

  return {
    imageUrl: `data:${mediaType};base64,${base64}`,
    mediaType,
    sourceLabel: resolvedPath
  }
}

async function loadFromUrl(imageUrl: string, maxImageBytes: number): Promise<LoadedImage> {
  const parsed = new URL(imageUrl)
  if (!['http:', 'https:', 'data:', 'file:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }

  if (parsed.protocol === 'data:') {
    const [meta, payload = ''] = imageUrl.slice('data:'.length).split(',', 2)
    const mediaType = meta.split(';')[0] || 'image/*'
    if (meta.includes('base64') && payload) {
      const byteLength = Buffer.byteLength(payload, 'base64')
      if (byteLength > maxImageBytes) {
        throw new Error(`Image data URL too large: ${byteLength} bytes (max ${maxImageBytes} bytes)`)
      }
    }
    return {
      imageUrl,
      mediaType,
      sourceLabel: 'data-url'
    }
  }

  if (parsed.protocol === 'file:') {
    return loadFromPath(fileURLToPath(parsed), maxImageBytes)
  }

  const ext = path.extname(parsed.pathname).toLowerCase()
  return {
    imageUrl,
    mediaType: MIME_BY_EXT[ext] || 'image/*',
    sourceLabel: imageUrl
  }
}

function loadFromBase64(imageBase64: string, imageMediaType: string | undefined, maxImageBytes: number): LoadedImage {
  if (!imageMediaType) {
    throw new Error('imageMediaType is required when imageBase64 is provided.')
  }

  const byteLength = Buffer.byteLength(imageBase64, 'base64')
  if (byteLength > maxImageBytes) {
    throw new Error(`Image payload too large: ${byteLength} bytes (max ${maxImageBytes} bytes)`)
  }

  return {
    imageUrl: `data:${imageMediaType};base64,${imageBase64}`,
    mediaType: imageMediaType,
    sourceLabel: 'base64-upload'
  }
}
