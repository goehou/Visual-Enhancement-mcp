import test from 'node:test'
import assert from 'node:assert/strict'

import { registerVisionOcrTool } from './visionOcr.js'

interface RegisteredCall {
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

function stubServer(): { registered: RegisteredCall[]; server: any } {
  const registered: RegisteredCall[] = []
  const server = {
    registerTool(_name: string, _meta: any, handler: any) {
      registered.push({ handler })
    }
  }
  return { registered, server }
}

test('vision_ocr passes outputFormat into the OCR prompt', async () => {
  const { registered, server } = stubServer()
  const calls: any[] = []
  const adapter = {
    async analyze(input: any) {
      calls.push(input)
      return { text: 'stub-result', model: 'stub-model', raw: {} }
    }
  }

  registerVisionOcrTool(server, adapter as any)

  await registered[0].handler({
    imageUrl: 'https://example.com/receipt.png',
    languageHint: 'en',
    outputFormat: 'markdown'
  })

  assert.match(calls[0].prompt, /Known language preference: en/)
  assert.match(calls[0].prompt, /Output format: Markdown/)
})
