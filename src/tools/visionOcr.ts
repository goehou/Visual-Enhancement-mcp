import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { loadImageInput } from '../core/image.js'
import { buildOcrPrompt } from '../core/prompts.js'

export function registerVisionOcrTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  server.registerTool(
    'vision_ocr',
    {
      title: 'Extract text from an image',
      description: '对本地图片或图片 URL 执行 OCR，尽量保持原有排版',
      inputSchema: z.object({
        imagePath: z.string().min(1).optional().describe('本地图片绝对路径。与 imageUrl 二选一'),
        imageUrl: z.string().url().optional().describe('远程图片 URL 或 data URL。与 imagePath 二选一'),
        languageHint: z.string().min(1).optional().describe('可选，语言提示，例如 zh-CN、en'),
        model: z.string().min(1).optional().describe('可选，覆盖默认 VISION_MODEL'),
        detail: z.enum(['auto', 'low', 'high']).optional().describe('可选，透传给支持 detail 的上游'),
        maxTokens: z.number().int().positive().max(4096).optional().describe('返回 token 上限')
      })
    },
    async ({ imagePath, imageUrl, languageHint, model, detail, maxTokens }) => {
      const image = await loadImageInput({ imagePath, imageUrl })
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
}
