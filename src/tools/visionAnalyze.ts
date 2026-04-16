import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { createImageInputSchema, loadImageInput } from '../core/image.js'
import { buildAnalyzePrompt } from '../core/prompts.js'

export function registerVisionAnalyzeTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  server.registerTool(
    'vision_analyze',
    {
      title: 'Analyze an image with a vision model',
      description: 'Analyze a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
      inputSchema: createImageInputSchema({
        prompt: z.string().min(1).describe('Instruction passed to the vision model.'),
        model: z.string().min(1).optional().describe('Optional model override.'),
        detail: z.enum(['auto', 'low', 'high']).optional().describe('Optional detail level for providers that support it.'),
        maxTokens: z.number().int().positive().max(4096).optional().describe('Optional max output tokens.')
      })
    },
    async ({ imagePath, imageUrl, imageBase64, imageMediaType, prompt, model, detail, maxTokens }) => {
      const image = await loadImageInput({ imagePath, imageUrl, imageBase64, imageMediaType })
      const result = await adapter.analyze({
        prompt: buildAnalyzePrompt(prompt),
        imageUrl: image.imageUrl,
        mediaType: image.mediaType,
        model,
        detail,
        maxTokens
      })

      return {
        content: [
          {
            type: 'text' as const,
            text: result.text
          }
        ]
      }
    }
  )
}
