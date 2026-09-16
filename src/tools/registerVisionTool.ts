import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { buildCacheKey, type ResultCache } from '../core/cache.js'
import { createImageInputSchema, loadImageInputs, type SingleImageInput } from '../core/image.js'

export const visionOptionsShape = {
  model: z.string().min(1).optional().describe('Optional model override.'),
  detail: z.enum(['auto', 'low', 'high']).optional().describe('Optional detail level for providers that support it.'),
  maxTokens: z.number().int().positive().max(32768).optional().describe('Optional max output tokens.')
}

export const visionOutputShape = {
  text: z.string().describe('Text returned by the vision model.'),
  model: z.string().describe('Model used for the request.'),
  images: z
    .array(
      z.object({
        sourceLabel: z.string().describe('Resolved image source label.'),
        mediaType: z.string().describe('Resolved image media type.')
      })
    )
    .describe('Resolved image sources, in call order.'),
  cached: z.boolean().describe('True when the result was served from the in-memory result cache.')
}

export interface VisionToolDefinition {
  name: string
  title: string
  description: string
  extraShape: z.core.$ZodLooseShape
  buildPrompt: (args: Record<string, unknown>) => string
}

export interface RegisterVisionToolOptions {
  /** Max bytes allowed for local file / base64 / data-URL images. */
  maxImageBytes?: number
  /** Shared cache for identical (tool + prompt + images + options) requests. */
  cache?: ResultCache<VisionCacheValue>
}

export interface VisionCacheValue {
  text: string
  model: string
  images: Array<{ sourceLabel: string; mediaType: string }>
}

type VisionToolArgs = {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  imageMediaType?: string
  images?: SingleImageInput[]
  model?: string
  detail?: 'auto' | 'low' | 'high'
  maxTokens?: number
} & Record<string, unknown>

export function registerVisionTool(
  server: McpServer,
  adapter: OpenAICompatibleVisionAdapter,
  def: VisionToolDefinition,
  options: RegisterVisionToolOptions = {}
): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: createImageInputSchema({ ...def.extraShape, ...visionOptionsShape }),
      outputSchema: visionOutputShape
    },
    async (rawArgs) => {
      const args = rawArgs as VisionToolArgs
      const { imagePath, imageUrl, imageBase64, imageMediaType, images, model, detail, maxTokens, ...extraArgs } =
        args
      const loadedImages = await loadImageInputs(
        { imagePath, imageUrl, imageBase64, imageMediaType, images },
        options.maxImageBytes
      )
      const prompt = def.buildPrompt(extraArgs)
      const imageUrls = loadedImages.map((image) => image.imageUrl)

      const cacheKey = options.cache
        ? buildCacheKey({ tool: def.name, prompt, imageUrls, model, detail, maxTokens })
        : undefined
      const cachedValue = cacheKey ? options.cache?.get(cacheKey) : undefined

      const resolved: VisionCacheValue =
        cachedValue ??
        (await adapter.analyze({ prompt, imageUrls, model, detail, maxTokens }).then((result) => ({
          text: result.text,
          model: result.model,
          images: loadedImages.map((image) => ({ sourceLabel: image.sourceLabel, mediaType: image.mediaType }))
        })))

      if (cacheKey && !cachedValue) {
        options.cache?.set(cacheKey, resolved)
      }

      const structuredContent = {
        text: resolved.text,
        model: resolved.model,
        images: resolved.images,
        cached: Boolean(cachedValue)
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: resolved.text
          }
        ],
        structuredContent
      }
    }
  )
}

