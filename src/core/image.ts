import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

export interface LoadedImage {
  imageUrl: string
  mediaType: string
  sourceLabel: string
}

export async function loadImageInput(input: { imagePath?: string; imageUrl?: string }): Promise<LoadedImage> {
  const provided = [input.imagePath, input.imageUrl].filter(Boolean)
  if (provided.length !== 1) {
    throw new Error('必须且只能提供 imagePath 或 imageUrl 其中一个')
  }

  if (input.imagePath) {
    return loadFromPath(input.imagePath)
  }

  return loadFromUrl(input.imageUrl!)
}

async function loadFromPath(imagePath: string): Promise<LoadedImage> {
  const resolvedPath = path.resolve(imagePath)
  await access(resolvedPath)
  const ext = path.extname(resolvedPath).toLowerCase()
  const mediaType = MIME_BY_EXT[ext]
  if (!mediaType) {
    throw new Error(`暂不支持的图片格式: ${ext || 'unknown'}`)
  }

  const buffer = await readFile(resolvedPath)
  const base64 = buffer.toString('base64')

  return {
    imageUrl: `data:${mediaType};base64,${base64}`,
    mediaType,
    sourceLabel: resolvedPath
  }
}

function loadFromUrl(imageUrl: string): LoadedImage {
  const parsed = new URL(imageUrl)
  if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
    throw new Error(`不支持的 URL 协议: ${parsed.protocol}`)
  }

  if (parsed.protocol === 'data:') {
    const mediaType = parsed.pathname.split(';', 1)[0] || 'image/*'
    return {
      imageUrl,
      mediaType,
      sourceLabel: 'data-url'
    }
  }

  const ext = path.extname(parsed.pathname).toLowerCase()
  return {
    imageUrl,
    mediaType: MIME_BY_EXT[ext] || 'image/*',
    sourceLabel: imageUrl
  }
}
