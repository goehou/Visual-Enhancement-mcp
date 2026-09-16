import test from 'node:test'
import assert from 'node:assert/strict'

import { OpenAICompatibleVisionAdapter, normalizeContent } from './openaiCompatible.js'

test('normalizeContent returns trimmed string content', () => {
  const text = normalizeContent({
    choices: [{ message: { content: '  cabbage  ' } }]
  })

  assert.equal(text, 'cabbage')
})

test('normalizeContent joins text parts from array content', () => {
  const text = normalizeContent({
    choices: [
      {
        message: {
          content: [
            { type: 'text', text: '  line 1  ' },
            { type: 'image_url', text: 'ignored' },
            { type: 'text', text: 'line 2' }
          ]
        }
      }
    ]
  })

  assert.equal(text, 'line 1\nline 2')
})

test('normalizeContent ignores non-text parts even when they carry a text field', () => {
  const text = normalizeContent({
    choices: [
      {
        message: {
          content: [
            { type: 'image_url', text: 'ignored-url' },
            { type: 'text', text: 'kept' }
          ]
        }
      }
    ]
  })

  assert.equal(text, 'kept')
})

test('normalizeContent falls back to reasoning when content is null', () => {
  const text = normalizeContent({
    choices: [{ message: { content: undefined, reasoning: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent falls back to reasoning when string content is empty', () => {
  const text = normalizeContent({
    choices: [{ message: { content: '', reasoning: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent falls back to reasoning_content when reasoning is empty', () => {
  const text = normalizeContent({
    choices: [{ message: { content: undefined, reasoning: ' ', reasoning_content: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent falls back to reasoning_content when string content is blank', () => {
  const text = normalizeContent({
    choices: [{ message: { content: '   ', reasoning_content: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent falls back to reasoning when array content has no usable text', () => {
  const text = normalizeContent({
    choices: [{ message: { content: [{ type: 'text', text: '   ' }], reasoning: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent returns empty string when no usable text exists', () => {
  const text = normalizeContent({
    choices: [{ message: { content: [{ type: 'image_url', text: 'ignored' }] } }]
  })

  assert.equal(text, '')
})

function createAdapter(overrides: Partial<ConstructorParameters<typeof OpenAICompatibleVisionAdapter>[0]> = {}) {
  return new OpenAICompatibleVisionAdapter({
    apiBaseUrl: 'https://example.com',
    apiPath: '/v1/chat/completions',
    apiKey: 'sk-test',
    defaultModel: 'vision-model',
    timeoutMs: 50,
    maxTokens: 4096,
    maxRetries: 0,
    retryBaseDelayMs: 1,
    ...overrides
  })
}

async function withStubFetch<T>(
  impl: (url: string, init: RequestInit) => Promise<Response>,
  run: () => Promise<T>
): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = original
  }
}

test('analyze surfaces abort as a friendly timeout error', async () => {
  const adapter = createAdapter({ timeoutMs: 10 })

  await withStubFetch(
    (_url, init) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      }),
    async () => {
      await assert.rejects(
        adapter.analyze({ prompt: 'describe', imageUrls: ['https://example.com/a.png'] }),
        /请求超时 \(10ms\)/
      )
    }
  )
})

test('analyze wraps fetch TypeError as a connection error', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () => {
      throw new TypeError('fetch failed: ENOTFOUND')
    },
    async () => {
      await assert.rejects(
        adapter.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] }),
        /无法连接到上游视觉模型 API: fetch failed: ENOTFOUND/
      )
    }
  )
})

test('analyze includes status and body prefix when upstream returns non-JSON', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () => new Response('<html>bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    async () => {
      await assert.rejects(
        adapter.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] }),
        /HTTP 502.*<html>bad gateway<\/html>/s
      )
    }
  )
})

test('analyze surfaces upstream error.message when JSON body carries one', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () =>
      new Response(JSON.stringify({ error: { message: 'invalid key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      }),
    async () => {
      await assert.rejects(
        adapter.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] }),
        /HTTP 401.*invalid key/s
      )
    }
  )
})

test('analyze returns normalized text on success', async () => {
  const adapter = createAdapter()

  await withStubFetch(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello world' } }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
    async () => {
      const result = await adapter.analyze({
        prompt: 'describe',
        imageUrls: ['https://example.com/a.png']
      })
      assert.equal(result.text, 'hello world')
      assert.equal(result.model, 'vision-model')
    }
  )
})

test('analyze sends configured max token default when input omits maxTokens', async () => {
  const adapter = createAdapter({ maxTokens: 8192 })
  let requestBody: any

  await withStubFetch(
    async (_url, init) => {
      requestBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello world' } }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
    async () => {
      await adapter.analyze({
        prompt: 'describe',
        imageUrls: ['https://example.com/a.png']
      })
    }
  )

  assert.equal(requestBody.max_tokens, 8192)
})

test('analyze prefers input maxTokens over configured default', async () => {
  const adapter = createAdapter({ maxTokens: 8192 })
  let requestBody: any

  await withStubFetch(
    async (_url, init) => {
      requestBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello world' } }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
    async () => {
      await adapter.analyze({
        prompt: 'describe',
        imageUrls: ['https://example.com/a.png'],
        maxTokens: 1234
      })
    }
  )

  assert.equal(requestBody.max_tokens, 1234)
})

test('analyze rejects when no images are provided', async () => {
  const adapter = createAdapter()
  await assert.rejects(adapter.analyze({ prompt: 'x', imageUrls: [] }), /至少需要一张图片/)
})

test('analyze sends one image_url content part per image, in order', async () => {
  const adapter = createAdapter()
  let requestBody: any

  await withStubFetch(
    async (_url, init) => {
      requestBody = JSON.parse(init.body as string)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    },
    async () => {
      await adapter.analyze({
        prompt: 'compare',
        imageUrls: ['https://example.com/a.png', 'https://example.com/b.png']
      })
    }
  )

  const parts = requestBody.messages[0].content
  assert.equal(parts.length, 3)
  assert.equal(parts[0].type, 'text')
  assert.equal(parts[1].image_url.url, 'https://example.com/a.png')
  assert.equal(parts[2].image_url.url, 'https://example.com/b.png')
})

test('analyze retries on 503 and succeeds on the next attempt', async () => {
  const adapter = createAdapter({ maxRetries: 2, retryBaseDelayMs: 1 })
  let attempts = 0

  await withStubFetch(
    async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response('service unavailable', { status: 503, headers: { 'content-type': 'text/plain' } })
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    },
    async () => {
      const result = await adapter.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] })
      assert.equal(result.text, 'recovered')
    }
  )

  assert.equal(attempts, 2)
})

test('analyze does not retry on 400 and exhausts retries on repeated 500', async () => {
  const adapterNoRetryOn400 = createAdapter({ maxRetries: 2, retryBaseDelayMs: 1 })
  let attempts400 = 0

  await withStubFetch(
    async () => {
      attempts400 += 1
      return new Response(JSON.stringify({ error: { message: 'bad request' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    },
    async () => {
      await assert.rejects(
        adapterNoRetryOn400.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] }),
        /HTTP 400/
      )
    }
  )
  assert.equal(attempts400, 1)

  const adapterExhausted = createAdapter({ maxRetries: 2, retryBaseDelayMs: 1 })
  let attempts500 = 0

  await withStubFetch(
    async () => {
      attempts500 += 1
      return new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } })
    },
    async () => {
      await assert.rejects(
        adapterExhausted.analyze({ prompt: 'x', imageUrls: ['https://example.com/a.png'] }),
        /HTTP 500/
      )
    }
  )
  assert.equal(attempts500, 3)
})
