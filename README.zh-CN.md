# mcp-vision-server

[English](README.md) | [简体中文](README.zh-CN.md)

`mcp-vision-server` 是一个 MCP `stdio` 服务，用于让 MCP 客户端通过已有的 OpenAI-compatible 视觉 Chat Completions API 进行图片理解和 OCR。

本文只讲项目如何配置与使用，不展开本地开发运行流程。

## 提供什么能力

- `vision_analyze`：按自定义 prompt 做通用图片理解。
- `vision_ocr`：图片文字提取，可附带语言提示和输出格式提示。
- 每次工具调用必须且只能选择一种图片来源：
  - `imagePath`：MCP server 进程可读取的本地绝对路径。
  - `imageUrl`：`http://`、`https://`、`data:` 或 `file://` URL。
  - `imageBase64` + `imageMediaType`：由客户端直接转发的上传附件字节。
- 上游请求兼容 OpenAI Chat Completions：文本内容 + `image_url` 图片内容。
- 除普通文本 `content` 外，还返回 MCP `structuredContent` 结构化结果。

## 必填配置

服务必须知道上游视觉模型 API 在哪里、调用哪个模型。最少需要配置：

| 配置项 | 是否必填 | CLI 参数 | 环境变量 | 含义 | 示例 |
| --- | --- | --- | --- | --- | --- |
| API 基础地址 | 是 | `--api-base-url` | `VISION_API_BASE_URL` | 上游 OpenAI-compatible API 根地址。建议只填协议 + 主机，请求路径放到 `api-path`。 | `https://api.openai.com` |
| 模型名 | 是 | `--model` | `VISION_MODEL` | 上游 API 暴露的默认视觉模型。单次工具调用可用 `model` 覆盖。 | `gpt-4o-mini` |
| API Key | 通常必填 | `--api-key` | `VISION_API_KEY` | 作为 `Authorization: Bearer <key>` 发送给上游；只有无鉴权端点才可省略。 | `sk-xxxx` |

最终上游请求地址由下面两段拼出：

```text
<api-base-url><api-path>
```

示例：

```text
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
=> https://api.openai.com/v1/chat/completions
```

## 完整配置表

配置优先级：

```text
CLI 参数 > 环境变量 > 默认值
```

| 用途 | CLI 参数 | 别名 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 上游 API 基础地址 | `--api-base-url <url>` | `--vision-api-base-url` | `VISION_API_BASE_URL` | 无 | 必填。建议使用 `https://api.openai.com` 这类 API root。 |
| 上游 API 路径 | `--api-path <path>` | `--vision-api-path` | `VISION_API_PATH` | `/v1/chat/completions` | Chat Completions endpoint 路径。 |
| 上游 API Key | `--api-key <key>` | `--vision-api-key` | `VISION_API_KEY` | 无 | 设置后会作为 Bearer token 发送。 |
| 默认模型 | `--model <name>` | `--vision-model` | `VISION_MODEL` | 无 | 必填。模型必须支持图片输入。 |
| 请求超时 | `--timeout-ms <ms>` | `--vision-timeout-ms` | `VISION_TIMEOUT_MS` | `60000` | 毫秒。环境变量为非法值或非正数时回退默认值。 |
| 默认输出 token 上限 | `--max-tokens <n>` | `--vision-max-tokens` | `VISION_MAX_TOKENS` | `4096` | 工具调用未传 `maxTokens` 时，以 `max_tokens` 发送给上游。 |
| MCP server 名称 | `--server-name <name>` | `--mcp-server-name` | `MCP_SERVER_NAME` | `mcp-vision-server` | 展示给 MCP 客户端的元信息。 |
| MCP server 版本 | `--server-version <ver>` | `--mcp-server-version` | `MCP_SERVER_VERSION` | package version | 展示给 MCP 客户端的元信息。 |

环境变量配置示例：

```bash
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
VISION_API_KEY=sk-xxxx
VISION_MODEL=gpt-4o-mini
VISION_TIMEOUT_MS=60000
VISION_MAX_TOKENS=4096
MCP_SERVER_NAME=mcp-vision-server
MCP_SERVER_VERSION=0.1.4
```

## MCP 客户端配置

大多数 MCP 客户端应把本服务注册为一个 `stdio` command。把下面示例里的 URL、key、model 换成你的上游服务配置。

### JSON 配置

适用于 Claude Desktop、Cursor、VS Code 兼容 MCP 配置等使用 `mcpServers` JSON 的客户端：

```json
{
  "mcpServers": {
    "vision": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-vision-server",
        "--api-base-url", "https://your-api.example.com",
        "--api-path", "/v1/chat/completions",
        "--api-key", "sk-xxxx",
        "--model", "your-vision-model",
        "--timeout-ms", "60000",
        "--max-tokens", "4096"
      ]
    }
  }
}
```

如果客户端支持 `env` 块，建议把密钥放进环境变量，避免暴露在 `args` 中：

```json
{
  "mcpServers": {
    "vision": {
      "command": "npx",
      "args": ["-y", "mcp-vision-server"],
      "env": {
        "VISION_API_BASE_URL": "https://your-api.example.com",
        "VISION_API_PATH": "/v1/chat/completions",
        "VISION_API_KEY": "sk-xxxx",
        "VISION_MODEL": "your-vision-model",
        "VISION_TIMEOUT_MS": "60000",
        "VISION_MAX_TOKENS": "4096"
      }
    }
  }
}
```

### Codex

```powershell
codex mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000 `
  --max-tokens 4096
```

### Claude Code

```powershell
claude mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000 `
  --max-tokens 4096
```

## 上游 API 契约

服务会向配置好的 Chat Completions URL 发起 `POST`：

```json
{
  "model": "your-vision-model",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Describe this image." },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,...",
            "detail": "auto"
          }
        }
      ]
    }
  ]
}
```

响应解析支持：

- `choices[0].message.content` 为字符串。
- `choices[0].message.content` 为 text parts 数组。
- 兼容部分 provider 的 `choices[0].message.reasoning` 或 `reasoning_content` 兜底文本。

## 图片来源处理规则

每次工具调用必须且只能传一种图片来源。

| 字段 | 适用场景 | 处理方式 |
| --- | --- | --- |
| `imagePath` | MCP server 进程能读取本地绝对路径。 | 读取文件，按扩展名推断 MIME，转成 `data:` URL 后发给上游。 |
| `imageUrl` | 图片已有 `http(s)://`、`data:` 或 `file://` 地址。 | `file://` 会像 `imagePath` 一样读取；远程 URL 直接传给上游。 |
| `imageBase64` + `imageMediaType` | MCP 客户端能直接转发上传附件字节。 | 包装为 `data:<imageMediaType>;base64,<imageBase64>`。 |

本地文件 MIME 推断支持扩展名：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.bmp`。

拖拽图片是否可用取决于宿主 MCP 客户端：如果客户端没有把附件转成 `imagePath`、`imageUrl` 或 `imageBase64` 传给工具，服务就无法读取该图片。

## 工具说明

### `vision_analyze`

用于通用图片理解。

必填：

- `prompt`：传给视觉模型的指令。
- `imagePath`、`imageUrl`、`imageBase64` 三选一且只能选一。

使用 `imageBase64` 时额外必填：

- `imageMediaType`：例如 `image/png` 或 `image/jpeg`。

可选：

- `model`：覆盖配置中的默认模型，仅对本次调用生效。
- `detail`：`auto`、`low` 或 `high`；转发给支持图片 detail 的 provider。
- `maxTokens`：正整数，最大 `32768`；覆盖本次调用的默认输出 token 上限。

示例：

```json
{
  "name": "vision_analyze",
  "arguments": {
    "imageUrl": "https://example.com/cat.png",
    "prompt": "Describe the main subject and extract any visible text.",
    "detail": "high",
    "maxTokens": 2048
  }
}
```

### `vision_ocr`

用于图片文字提取。

必填：

- `imagePath`、`imageUrl`、`imageBase64` 三选一且只能选一。

使用 `imageBase64` 时额外必填：

- `imageMediaType`。

可选：

- `languageHint`：语言提示，例如 `en`、`zh-CN`、`ja`。
- `outputFormat`：`plain`、`markdown` 或 `json`；默认 `plain`。
- `model`：覆盖配置中的默认模型，仅对本次调用生效。
- `detail`：`auto`、`low` 或 `high`。
- `maxTokens`：正整数，最大 `32768`。

示例：

```json
{
  "name": "vision_ocr",
  "arguments": {
    "imageBase64": "<base64-image>",
    "imageMediaType": "image/png",
    "languageHint": "en",
    "outputFormat": "markdown"
  }
}
```

## 工具输出

两个工具都会返回 MCP 普通文本 `content`，并在 `structuredContent` 中返回结构化数据：

```json
{
  "text": "recognized or analyzed text",
  "model": "model-used",
  "sourceLabel": "resolved image source",
  "mediaType": "image/png"
}
```

## Provider 注意事项

- 上游 API 必须支持 OpenAI-compatible Chat Completions 图片输入。
- 部分 provider 可能忽略 `detail` 或 `max_tokens`；实际行为以上游为准。
- 大图会增加延迟、token 消耗和 provider 侧请求体积。
- 单次工具调用只支持一张图片。

## 友情链接

- [Linux Do](https://linux.do/)
