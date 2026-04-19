import test from 'node:test'
import assert from 'node:assert/strict'

import { getHelpText, getRuntimeConfig, isHelpRequested } from './config.js'

const ENV_KEYS = [
  'VISION_API_BASE_URL',
  'VISION_API_PATH',
  'VISION_API_KEY',
  'VISION_MODEL',
  'VISION_TIMEOUT_MS',
  'MCP_SERVER_NAME',
  'MCP_SERVER_VERSION'
]

function withCleanEnv<T>(fn: () => T, overrides: Record<string, string | undefined> = {}): T {
  const backup: Record<string, string | undefined> = {}
  for (const key of ENV_KEYS) {
    backup[key] = process.env[key]
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  try {
    return fn()
  } finally {
    for (const key of ENV_KEYS) {
      if (backup[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = backup[key]
      }
    }
  }
}

test('getRuntimeConfig parses inline --flag=value form', () => {
  withCleanEnv(() => {
    const config = getRuntimeConfig(['--api-base-url=https://inline.example.com', '--model=gpt-inline'])
    assert.equal(config.apiBaseUrl, 'https://inline.example.com')
    assert.equal(config.defaultModel, 'gpt-inline')
  })
})

test('getRuntimeConfig parses separated --flag value form', () => {
  withCleanEnv(() => {
    const config = getRuntimeConfig(['--api-base-url', 'https://sep.example.com', '--model', 'gpt-sep'])
    assert.equal(config.apiBaseUrl, 'https://sep.example.com')
    assert.equal(config.defaultModel, 'gpt-sep')
  })
})

test('getRuntimeConfig falls back to environment variables when argv is empty', () => {
  withCleanEnv(
    () => {
      const config = getRuntimeConfig([])
      assert.equal(config.apiBaseUrl, 'https://env.example.com')
      assert.equal(config.defaultModel, 'gpt-env')
      assert.equal(config.apiKey, 'sk-env')
      assert.equal(config.timeoutMs, 1234)
    },
    {
      VISION_API_BASE_URL: 'https://env.example.com',
      VISION_MODEL: 'gpt-env',
      VISION_API_KEY: 'sk-env',
      VISION_TIMEOUT_MS: '1234'
    }
  )
})

test('getRuntimeConfig prefers CLI over environment', () => {
  withCleanEnv(
    () => {
      const config = getRuntimeConfig(['--api-base-url=https://cli.example.com', '--model=cli-model'])
      assert.equal(config.apiBaseUrl, 'https://cli.example.com')
      assert.equal(config.defaultModel, 'cli-model')
    },
    {
      VISION_API_BASE_URL: 'https://env.example.com',
      VISION_MODEL: 'env-model'
    }
  )
})

test('getRuntimeConfig accepts --vision-* alias flags', () => {
  withCleanEnv(() => {
    const config = getRuntimeConfig(['--vision-api-base-url=https://alias.example.com', '--vision-model=alias-model'])
    assert.equal(config.apiBaseUrl, 'https://alias.example.com')
    assert.equal(config.defaultModel, 'alias-model')
  })
})

test('getRuntimeConfig throws when apiBaseUrl is missing from both argv and env', () => {
  withCleanEnv(() => {
    assert.throws(() => getRuntimeConfig(['--model=only-model']), /缺少配置项 apiBaseUrl/)
  })
})

test('getRuntimeConfig throws when defaultModel is missing', () => {
  withCleanEnv(() => {
    assert.throws(() => getRuntimeConfig(['--api-base-url=https://x.example.com']), /缺少配置项 defaultModel/)
  })
})

test('getRuntimeConfig falls back to default when VISION_TIMEOUT_MS is not a positive number', () => {
  withCleanEnv(
    () => {
      const config = getRuntimeConfig([])
      assert.equal(config.timeoutMs, 60000)
    },
    {
      VISION_API_BASE_URL: 'https://x.example.com',
      VISION_MODEL: 'm',
      VISION_TIMEOUT_MS: 'not-a-number'
    }
  )
})

test('getRuntimeConfig uses defaults for apiPath, serverName, serverVersion when unspecified', () => {
  withCleanEnv(
    () => {
      const config = getRuntimeConfig([])
      assert.equal(config.apiPath, '/v1/chat/completions')
      assert.equal(config.serverName, 'mcp-vision-server')
      assert.equal(config.serverVersion, '0.1.0')
    },
    {
      VISION_API_BASE_URL: 'https://x.example.com',
      VISION_MODEL: 'm'
    }
  )
})

test('isHelpRequested detects --help and -h', () => {
  assert.equal(isHelpRequested(['--help']), true)
  assert.equal(isHelpRequested(['-h']), true)
  assert.equal(isHelpRequested(['--model', 'x']), false)
})

test('getHelpText mentions all main options', () => {
  const text = getHelpText()
  assert.match(text, /--api-base-url/)
  assert.match(text, /--api-path/)
  assert.match(text, /--api-key/)
  assert.match(text, /--model/)
  assert.match(text, /--timeout-ms/)
  assert.match(text, /VISION_API_BASE_URL/)
})
