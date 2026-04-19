import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'

import type { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'
import { buildAnalyzePrompt } from '../core/prompts.js'
import { registerVisionTool } from './registerVisionTool.js'

export function registerVisionAnalyzeTool(server: McpServer, adapter: OpenAICompatibleVisionAdapter) {
  registerVisionTool(server, adapter, {
    name: 'vision_analyze',
    title: 'Analyze an image with a vision model',
    description: 'Analyze a local image path, remote URL, file URL, data URL, or uploaded base64 image payload.',
    extraShape: {
      prompt: z.string().min(1).describe('Instruction passed to the vision model.')
    },
    buildPrompt: (args) => buildAnalyzePrompt(args.prompt as string)
  })
}
