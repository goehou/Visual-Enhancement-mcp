import { access, readFile } from 'node:fs/promises'
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

export interface LoadedImage {
  imageUrl: string
  mediaType: string
  sourceLabel: string
}

export interface ImageInput {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  imageMediaType?: string
}

export function createImageInputSchema<T extends z.core.$ZodLooseShape>(extraShape: T) {
  return z
    .object({
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
        .describe('Required with imageBase64, for example image/png or image/jpeg.'),
      ...extraShape
    })
    .superRefine((value, ctx) => {
      const imageValue = value as ImageInput
      const provided = [imageValue.imagePath, imageValue.imageUrl, imageValue.imageBase64].filter(Boolean)
      if (provided.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Exactly one of imagePath, imageUrl, or imageBase64 must be provided.'
        })
      }

      if (imageValue.imageBase64 && !imageValue.imageMediaType) {
        ctx.addIssue({
          code: 'custom',
          path: ['imageMediaType'],
          message: 'imageMediaType is required when imageBase64 is provided.'
        })
      }

      if (!imageValue.imageBase64 && imageValue.imageMediaType) {
        ctx.addIssue({
          code: 'custom',
          path: ['imageMediaType'],
          message: 'imageMediaType is only supported together with imageBase64.'
        })
      }
    })
}

export async function loadImageInput(input: ImageInput): Promise<LoadedImage> {
  if (input.imagePath) {
    return loadFromPath(input.imagePath)
  }

  if (input.imageBase64) {
    return loadFromBase64(input.imageBase64, input.imageMediaType)
  }

  if (input.imageUrl) {
    return loadFromUrl(input.imageUrl)
  }

  throw new Error('Exactly one of imagePath, imageUrl, or imageBase64 must be provided.')
}

async function loadFromPath(imagePath: string): Promise<LoadedImage> {
  const resolvedPath = path.resolve(imagePath)
  await access(resolvedPath)
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

async function loadFromUrl(imageUrl: string): Promise<LoadedImage> {
  const parsed = new URL(imageUrl)
  if (!['http:', 'https:', 'data:', 'file:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }

  if (parsed.protocol === 'data:') {
    const mediaType = parsed.pathname.split(';', 1)[0] || 'image/*'
    return {
      imageUrl,
      mediaType,
      sourceLabel: 'data-url'
    }
  }

  if (parsed.protocol === 'file:') {
    return loadFromPath(fileURLToPath(parsed))
  }

  const ext = path.extname(parsed.pathname).toLowerCase()
  return {
    imageUrl,
    mediaType: MIME_BY_EXT[ext] || 'image/*',
    sourceLabel: imageUrl
  }
}

function loadFromBase64(imageBase64: string, imageMediaType?: string): LoadedImage {
  if (!imageMediaType) {
    throw new Error('imageMediaType is required when imageBase64 is provided.')
  }

  return {
    imageUrl: `data:${imageMediaType};base64,${imageBase64}`,
    mediaType: imageMediaType,
    sourceLabel: 'base64-upload'
  }
}
