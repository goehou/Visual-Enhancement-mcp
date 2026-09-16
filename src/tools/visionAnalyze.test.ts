import test from 'node:test'
import assert from 'node:assert/strict'

import { registerVisionAnalyzeTool } from './visionAnalyze.js'

interface RegisteredTool {
  name: string
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

function stubServer(): { registered: RegisteredTool[]; server: any } {
  const registered: RegisteredTool[] = []
  const server = {
    registerTool(name: string, _meta: any, handler: any) {
      registered.push({ name, handler })
    }
  }
  return { registered, server }
}

test('vision_analyze passes the user prompt to the adapter', async () => {
  const { registered, server } = stubServer()
  const calls: any[] = []
  const adapter = {
    async analyze(input: any) {
      calls.push(input)
      return { text: 'stub-result', model: 'stub-model', raw: {} }
    }
  }

  registerVisionAnalyzeTool(server, adapter as any)

  assert.equal(registered[0].name, 'vision_analyze')

  await registered[0].handler({
    imageBase64: 'aGk=',
    imageMediaType: 'image/png',
    prompt: '  describe the chart  '
  })

  assert.equal(calls[0].prompt, 'describe the chart')
})

test('vision_analyze rejects an empty prompt', async () => {
  const { registered, server } = stubServer()
  registerVisionAnalyzeTool(server, {
    async analyze() {
      throw new Error('adapter must not be called')
    }
  } as any)

  await assert.rejects(
    registered[0].handler({ imageBase64: 'aGk=', imageMediaType: 'image/png', prompt: '   ' }),
    /prompt cannot be empty/
  )
})
