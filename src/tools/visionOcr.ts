import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { buildOcrPrompt } from '../core/prompts.js'
import { registerVisionTool } from './registerVisionTool.js'

export function registerVisionOcrTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  registerVisionTool(server, adapter, {
    name: 'vision_ocr',
    title: 'Extract text from an image',
    description: 'Run OCR on a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
    extraShape: {
      languageHint: z.string().min(1).optional().describe('Optional language hint such as zh-CN or en.')
    },
    buildPrompt: (args) => buildOcrPrompt(args.languageHint as string | undefined)
  })
}
