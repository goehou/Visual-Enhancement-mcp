export interface VisionAnalyzeInput {
  prompt: string
  imageUrls: string[]
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
  maxTokens: number
  /** Number of retries on 429/5xx/network/timeout failures. Defaults to 2. */
  maxRetries?: number
  /** Base delay for exponential backoff between retries, in ms. Defaults to 300. */
  retryBaseDelayMs?: number
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

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const MAX_BACKOFF_DELAY_MS = 4000

// Carries whether a failure is safe to retry, so the retry loop doesn't need to re-inspect the error.
class UpstreamRequestError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'UpstreamRequestError'
  }
}

export class OpenAICompatibleVisionAdapter {
  constructor(private readonly config: OpenAICompatibleConfig) {}

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult> {
    const model = input.model || this.config.defaultModel
    if (!model) {
      throw new Error('VISION_MODEL 未配置，且工具调用未传入 model')
    }
    if (!input.imageUrls.length) {
      throw new Error('至少需要一张图片')
    }

    const maxRetries = Math.max(0, this.config.maxRetries ?? 2)
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.performRequest(input, model)
      } catch (error) {
        lastError = error
        const retryable = error instanceof UpstreamRequestError && error.retryable
        if (!retryable || attempt === maxRetries) {
          throw error
        }
        await sleep(this.backoffDelayMs(attempt))
      }
    }

    throw lastError
  }

  private async performRequest(input: VisionAnalyzeInput, model: string): Promise<VisionAnalyzeResult> {
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
            max_tokens: input.maxTokens ?? this.config.maxTokens,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: input.prompt },
                  ...input.imageUrls.map((imageUrl) => ({
                    type: 'image_url',
                    image_url: {
                      url: imageUrl,
                      ...(input.detail ? { detail: input.detail } : {})
                    }
                  }))
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
        const message = upstreamMessage
          ? `上游视觉模型请求失败 (HTTP ${response.status}): ${upstreamMessage}`
          : `上游视觉模型请求失败 (HTTP ${response.status}): ${summary}`
        throw new UpstreamRequestError(message, RETRYABLE_STATUS_CODES.has(response.status))
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

  private backoffDelayMs(attempt: number): number {
    const base = (this.config.retryBaseDelayMs ?? 300) * 2 ** attempt
    const jitter = Math.floor(Math.random() * 100)
    return Math.min(base + jitter, MAX_BACKOFF_DELAY_MS)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeContent(data: OpenAICompatibleResponse): string {
  const message = data.choices?.[0]?.message
  const content = message?.content
  if (typeof content === 'string') {
    const text = content.trim()
    if (text) {
      return text
    }
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n')
    if (text) {
      return text
    }
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

function wrapFetchError(error: unknown, timeoutMs: number): UpstreamRequestError {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new UpstreamRequestError(`上游视觉模型请求超时 (${timeoutMs}ms)`, true)
    }
    if (error instanceof TypeError) {
      return new UpstreamRequestError(`无法连接到上游视觉模型 API: ${error.message}`, true)
    }
    return new UpstreamRequestError(error.message, false)
  }
  return new UpstreamRequestError(String(error), false)
}
