import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
<<<<<<< HEAD
=======
import { createImageInputSchema, loadImageInput } from '../core/image.js'
>>>>>>> d220540c57d690c55cd8d26bd25456bf9e538539
import { buildOcrPrompt } from '../core/prompts.js'
import { registerVisionTool } from './registerVisionTool.js'

export function registerVisionOcrTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
<<<<<<< HEAD
  registerVisionTool(server, adapter, {
    name: 'vision_ocr',
    title: 'Extract text from an image',
    description: 'Run OCR on a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
    extraShape: {
      languageHint: z.string().min(1).optional().describe('Optional language hint such as zh-CN or en.')
    },
    buildPrompt: (args) => buildOcrPrompt(args.languageHint as string | undefined)
  })
=======
  server.registerTool(
    'vision_ocr',
    {
      title: 'Extract text from an image',
      description: 'Run OCR on a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
      inputSchema: createImageInputSchema({
        languageHint: z.string().min(1).optional().describe('Optional language hint such as zh-CN or en.'),
        model: z.string().min(1).optional().describe('Optional model override.'),
        detail: z.enum(['auto', 'low', 'high']).optional().describe('Optional detail level for providers that support it.'),
        maxTokens: z.number().int().positive().max(4096).optional().describe('Optional max output tokens.')
      })
    },
    async ({ imagePath, imageUrl, imageBase64, imageMediaType, languageHint, model, detail, maxTokens }) => {
      const image = await loadImageInput({ imagePath, imageUrl, imageBase64, imageMediaType })
      const result = await adapter.analyze({
        prompt: buildOcrPrompt(languageHint),
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
>>>>>>> d220540c57d690c55cd8d26bd25456bf9e538539
}
