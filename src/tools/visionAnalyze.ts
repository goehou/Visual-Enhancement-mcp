import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { loadImageInput } from '../core/image.js'
import { buildAnalyzePrompt } from '../core/prompts.js'

export function registerVisionAnalyzeTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  server.registerTool(
    'vision_analyze',
    {
      title: 'Analyze an image with a vision model',
      description: '识别本地图片或图片 URL，返回模型的文本分析结果',
      inputSchema: z.object({
        imagePath: z.string().min(1).optional().describe('本地图片绝对路径。与 imageUrl 二选一'),
        imageUrl: z.string().url().optional().describe('远程图片 URL 或 data URL。与 imagePath 二选一'),
        prompt: z.string().min(1).describe('给视觉模型的分析指令'),
        model: z.string().min(1).optional().describe('可选，覆盖默认 VISION_MODEL'),
        detail: z.enum(['auto', 'low', 'high']).optional().describe('可选，透传给支持 detail 的上游'),
        maxTokens: z.number().int().positive().max(4096).optional().describe('返回 token 上限')
      })
    },
    async ({ imagePath, imageUrl, prompt, model, detail, maxTokens }) => {
      const image = await loadImageInput({ imagePath, imageUrl })
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
