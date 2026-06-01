import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { buildOcrPrompt, type OcrOutputFormat } from '../core/prompts.js'
import { registerVisionTool } from './registerVisionTool.js'

export function registerVisionOcrTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  registerVisionTool(server, adapter, {
    name: 'vision_ocr',
    title: 'Extract text from an image',
    description: 'Run OCR on a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
    extraShape: {
      languageHint: z.string().min(1).optional().describe('Optional language hint such as zh-CN or en.'),
      outputFormat: z
        .enum(['plain', 'markdown', 'json'])
        .optional()
        .describe('Preferred OCR output format. Defaults to plain.')
    },
    buildPrompt: (args) =>
      buildOcrPrompt(args.languageHint as string | undefined, (args.outputFormat as OcrOutputFormat | undefined) ?? 'plain')
  })
}
