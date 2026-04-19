import test from 'node:test'
import assert from 'node:assert/strict'

import * as z from 'zod/v4'

import { registerVisionTool } from './registerVisionTool.js'

interface RegisteredCall {
  name: string
  meta: { title: string; description: string; inputSchema: unknown }
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

function stubServer(): { registered: RegisteredCall[]; server: any } {
  const registered: RegisteredCall[] = []
  const server = {
    registerTool(name: string, meta: any, handler: any) {
      registered.push({ name, meta, handler })
    }
  }
  return { registered, server }
}

function stubAdapter() {
  const calls: any[] = []
  const adapter = {
    async analyze(input: any) {
      calls.push(input)
      return { text: 'stub-result', model: input.model ?? 'stub-model', raw: {} }
    }
  }
  return { calls, adapter }
}

test('registerVisionTool forwards prompt, detail, maxTokens, model to adapter', async () => {
  const { registered, server } = stubServer()
  const { calls, adapter } = stubAdapter()

  registerVisionTool(server, adapter as any, {
    name: 'vision_test',
    title: 'Test tool',
    description: 'desc',
    extraShape: {
      prompt: z.string()
    },
    buildPrompt: (args) => `PREFIX:${args.prompt as string}`
  })

  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'vision_test')

  const result = (await registered[0].handler({
    imageUrl: 'https://example.com/a.png',
    prompt: 'hello',
    model: 'custom-model',
    detail: 'low',
    maxTokens: 321
  })) as { content: Array<{ type: string; text: string }> }

  assert.equal(calls.length, 1)
  assert.equal(calls[0].prompt, 'PREFIX:hello')
  assert.equal(calls[0].imageUrl, 'https://example.com/a.png')
  assert.equal(calls[0].model, 'custom-model')
  assert.equal(calls[0].detail, 'low')
  assert.equal(calls[0].maxTokens, 321)
  assert.deepEqual(result.content, [{ type: 'text', text: 'stub-result' }])
})

test('registerVisionTool passes through optional extra fields (languageHint)', async () => {
  const { registered, server } = stubServer()
  const { calls, adapter } = stubAdapter()

  registerVisionTool(server, adapter as any, {
    name: 'vision_ocr_test',
    title: 'OCR test',
    description: 'desc',
    extraShape: {
      languageHint: z.string().optional()
    },
    buildPrompt: (args) => `OCR:${(args.languageHint as string | undefined) ?? 'auto'}`
  })

  await registered[0].handler({
    imageBase64: 'aGVsbG8=',
    imageMediaType: 'image/png',
    languageHint: 'zh-CN'
  })

  assert.equal(calls[0].prompt, 'OCR:zh-CN')
  assert.match(calls[0].imageUrl, /^data:image\/png;base64,aGVsbG8=/)
})

test('registerVisionTool surfaces loadImageInput failures', async () => {
  const { registered, server } = stubServer()
  const { adapter } = stubAdapter()

  registerVisionTool(server, adapter as any, {
    name: 'vision_err',
    title: 'err',
    description: 'd',
    extraShape: {
      prompt: z.string()
    },
    buildPrompt: (args) => args.prompt as string
  })

  await assert.rejects(
    registered[0].handler({ prompt: 'x' }),
    /Exactly one of imagePath, imageUrl, or imageBase64 must be provided/
  )
})
