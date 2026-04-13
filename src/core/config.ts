import { OpenAICompatibleVisionAdapter } from '../adapters/openaiCompatible.js'

interface RuntimeConfig {
  apiBaseUrl: string
  apiPath: string
  apiKey?: string
  defaultModel: string
  timeoutMs: number
  serverName: string
  serverVersion: string
}

interface CliOptions {
  apiBaseUrl?: string
  apiPath?: string
  apiKey?: string
  defaultModel?: string
  timeoutMs?: number
  serverName?: string
  serverVersion?: string
  helpRequested: boolean
}

function requireValue(name: string, value?: string): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error(`缺少配置项 ${name}`)
  }
  return trimmed
}

function readEnv(name: string): string | undefined {
  return process.env[name]?.trim()
}

function readNumberValue(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = { helpRequested: false }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.helpRequested = true
      continue
    }

    const [flag, inlineValue] = arg.split('=', 2)
    const nextValue = inlineValue ?? argv[index + 1]

    const consumeValue = () => {
      if (inlineValue === undefined) {
        index += 1
      }
      return requireValue(flag, nextValue)
    }

    switch (flag) {
      case '--api-base-url':
      case '--vision-api-base-url':
        options.apiBaseUrl = consumeValue()
        break
      case '--api-path':
      case '--vision-api-path':
        options.apiPath = consumeValue()
        break
      case '--api-key':
      case '--vision-api-key':
        options.apiKey = consumeValue()
        break
      case '--model':
      case '--vision-model':
        options.defaultModel = consumeValue()
        break
      case '--timeout-ms':
      case '--vision-timeout-ms':
        options.timeoutMs = readNumberValue(consumeValue(), 60000)
        break
      case '--server-name':
      case '--mcp-server-name':
        options.serverName = consumeValue()
        break
      case '--server-version':
      case '--mcp-server-version':
        options.serverVersion = consumeValue()
        break
      default:
        break
    }
  }

  return options
}

export function isHelpRequested(argv = process.argv.slice(2)): boolean {
  return parseCliArgs(argv).helpRequested
}

export function getHelpText(): string {
  return [
    'mcp-vision-server',
    '',
    'Usage:',
    '  node dist/server.js [options]',
    '',
    'Options:',
    '  --api-base-url <url>      上游视觉模型 API 根地址',
    '  --api-path <path>         上游 API 路径，默认 /v1/chat/completions',
    '  --api-key <key>           上游 API Key',
    '  --model <name>            默认视觉模型名',
    '  --timeout-ms <ms>         请求超时，默认 60000',
    '  --server-name <name>      MCP server 名称',
    '  --server-version <ver>    MCP server 版本',
    '  -h, --help                显示帮助',
    '',
    'Priority:',
    '  CLI 参数 > 环境变量 > 默认值',
    '',
    'Environment fallback:',
    '  VISION_API_BASE_URL, VISION_API_PATH, VISION_API_KEY, VISION_MODEL, VISION_TIMEOUT_MS'
  ].join('\n')
}

export function getRuntimeConfig(argv = process.argv.slice(2)): RuntimeConfig {
  const cli = parseCliArgs(argv)

  return {
    apiBaseUrl: requireValue('apiBaseUrl', cli.apiBaseUrl || readEnv('VISION_API_BASE_URL')),
    apiPath: cli.apiPath || readEnv('VISION_API_PATH') || '/v1/chat/completions',
    apiKey: cli.apiKey || readEnv('VISION_API_KEY'),
    defaultModel: requireValue('defaultModel', cli.defaultModel || readEnv('VISION_MODEL')),
    timeoutMs: cli.timeoutMs || readNumberValue(readEnv('VISION_TIMEOUT_MS'), 60000),
    serverName: cli.serverName || readEnv('MCP_SERVER_NAME') || 'mcp-vision-server',
    serverVersion: cli.serverVersion || readEnv('MCP_SERVER_VERSION') || '0.1.0'
  }
}

export function createVisionAdapter(config = getRuntimeConfig()) {
  return new OpenAICompatibleVisionAdapter({
    apiBaseUrl: config.apiBaseUrl,
    apiPath: config.apiPath,
    apiKey: config.apiKey,
    defaultModel: config.defaultModel,
    timeoutMs: config.timeoutMs
  })
}

export function getServerMeta(config = getRuntimeConfig()) {
  return {
    name: config.serverName,
    version: config.serverVersion
  }
}
