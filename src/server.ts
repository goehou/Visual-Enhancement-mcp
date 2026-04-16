#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import {
  createVisionAdapter,
  getHelpText,
  getRuntimeConfig,
  getServerMeta,
  isHelpRequested
} from './core/config.js'
import { registerVisionAnalyzeTool } from './tools/visionAnalyze.js'
import { registerVisionOcrTool } from './tools/visionOcr.js'

async function main() {
  if (isHelpRequested()) {
    console.error(getHelpText())
    return
  }

  const runtimeConfig = getRuntimeConfig()
  const meta = getServerMeta(runtimeConfig)
  const adapter = createVisionAdapter(runtimeConfig)
  const server = new McpServer(meta, {
    capabilities: {
      logging: {}
    },
    instructions: [
      'Use vision_analyze for general image understanding.',
      'Use vision_ocr for text extraction.',
      'Prefer imagePath for local files.',
      'Use imageUrl for remote URLs, data URLs, or file URLs.',
      'Use imageBase64 with imageMediaType when the client can forward uploaded attachment bytes.'
    ].join(' ')
  })

  registerVisionAnalyzeTool(server, adapter)
  registerVisionOcrTool(server, adapter)

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`${meta.name} running on stdio`)
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
