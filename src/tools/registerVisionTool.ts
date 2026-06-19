import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { createImageInputSchema, loadImageInput } from '../core/image.js'

export const visionOptionsShape = {
  model: z.string().min(1).optional().describe('Optional model override.'),
  detail: z.enum(['auto', 'low', 'high']).optional().describe('Optional detail level for providers that support it.'),
  maxTokens: z.number().int().positive().max(32768).optional().describe('Optional max output tokens.')
}

export const visionOutputShape = {
  text: z.string().describe('Text returned by the vision model.'),
  model: z.string().describe('Model used for the request.'),
  sourceLabel: z.string().describe('Resolved image source label.'),
  mediaType: z.string().describe('Resolved image media type.')
}

export interface VisionToolDefinition {
  name: string
  title: string
  description: string
  extraShape: z.core.$ZodLooseShape
  buildPrompt: (args: Record<string, unknown>) => string
}

type VisionToolArgs = {
  imagePath?: string
  imageUrl?: string
  imageBase64?: string
  imageMediaType?: string
  model?: string
  detail?: 'auto' | 'low' | 'high'
  maxTokens?: number
} & Record<string, unknown>

export function registerVisionTool(
  server: McpServer,
  adapter: OpenAICompatibleVisionAdapter,
  def: VisionToolDefinition
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
      const { imagePath, imageUrl, imageBase64, imageMediaType, model, detail, maxTokens, ...extraArgs } = args
      const image = await loadImageInput({ imagePath, imageUrl, imageBase64, imageMediaType })
      const result = await adapter.analyze({
        prompt: def.buildPrompt(extraArgs),
        imageUrl: image.imageUrl,
        model,
        detail,
        maxTokens
      })
      const structuredContent = {
        text: result.text,
        model: result.model,
        sourceLabel: image.sourceLabel,
        mediaType: image.mediaType
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: result.text
          }
        ],
        structuredContent
      }
    }
  )
}
