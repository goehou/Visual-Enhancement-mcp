export interface VisionAnalyzeInput {
  prompt: string
  imageUrl: string
  mediaType?: string
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

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
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
      const response = await fetch(url, {
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

      const data = (await response.json()) as OpenAICompatibleResponse
      if (!response.ok) {
        throw new Error(data.error?.message || `上游视觉模型请求失败: HTTP ${response.status}`)
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
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text!.trim())
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
