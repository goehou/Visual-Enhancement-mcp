export interface VisionAnalyzeInput {
  prompt: string
  imageUrl: string
  model?: string
  maxTokens?: number
  detail?: 'auto' | 'low' | 'high'
}

export interface VisionAnalyzeResult {
  text: string
  model: string
  raw: unknown
}

export interface OpenAICompatibleConfig {
  apiBaseUrl: string
  apiPath: string
  apiKey?: string
  defaultModel: string
  timeoutMs: number
}

type ContentPart = { type: 'text'; text: string } | { type: string; text?: unknown }

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | ContentPart[]
      reasoning?: string
      reasoning_content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export class OpenAICompatibleVisionAdapter {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult> {
    const model = input.model || this.config.defaultModel
    if (!model) {
      throw new Error('VISION_MODEL 未配置，且工具调用未传入 model')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    const url = new URL(this.config.apiPath, withTrailingSlash(this.config.apiBaseUrl)).toString()

    try {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            max_tokens: input.maxTokens ?? 1200,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: input.prompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: input.imageUrl,
                      ...(input.detail ? { detail: input.detail } : {})
                    }
                  }
                ]
              }
            ]
          }),
          signal: controller.signal
        })
      } catch (error) {
        throw wrapFetchError(error, this.config.timeoutMs)
      }

      const bodyText = await response.text()
      const data = safeParseJson(bodyText)

      if (!response.ok) {
        const upstreamMessage = data?.error?.message
        const summary = truncate(bodyText, 200)
        if (upstreamMessage) {
          throw new Error(`上游视觉模型请求失败 (HTTP ${response.status}): ${upstreamMessage}`)
        }
        throw new Error(`上游视觉模型请求失败 (HTTP ${response.status}): ${summary}`)
      }

      if (!data) {
        throw new Error(`上游返回非 JSON 响应 (HTTP ${response.status}): ${truncate(bodyText, 200)}`)
      }

      const text = normalizeContent(data)
      if (!text) {
        throw new Error('上游视觉模型返回为空，无法提取识别结果')
      }

      return { text, model, raw: data }
    } finally {
      clearTimeout(timer)
    }
  }
}

export function normalizeContent(data: OpenAICompatibleResponse): string {
  const message = data.choices?.[0]?.message
  const content = message?.content
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n')
  }

  const reasoning = [message?.reasoning, message?.reasoning_content].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
  if (reasoning) {
    return reasoning.trim()
  }

  return ''
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function safeParseJson(text: string): OpenAICompatibleResponse | null {
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as OpenAICompatibleResponse
  } catch {
    return null
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  return `${text.slice(0, max)}…`
}

function wrapFetchError(error: unknown, timeoutMs: number): Error {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new Error(`上游视觉模型请求超时 (${timeoutMs}ms)`)
    }
    if (error instanceof TypeError) {
      return new Error(`无法连接到上游视觉模型 API: ${error.message}`)
    }
    return error
  }
  return new Error(String(error))
}
