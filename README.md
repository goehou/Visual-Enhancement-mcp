# mcp-vision-server

[English](README.md) | [简体中文](README.zh-CN.md)

`mcp-vision-server` is an MCP `stdio` server that lets MCP clients analyze images and run OCR through an existing OpenAI-compatible vision Chat Completions API.

This document focuses on how to configure and use the server from an MCP client.

## What it provides

- `vision_analyze`: general image understanding with a custom prompt.
- `vision_ocr`: OCR extraction with optional language and output-format hints.
- Image input through exactly one of:
  - `imagePath`: a local absolute image path available to the MCP server process.
  - `imageUrl`: `http://`, `https://`, `data:`, or `file://` URL.
  - `imageBase64` + `imageMediaType`: uploaded attachment bytes forwarded by the client.
- OpenAI-compatible upstream request shape: Chat Completions with text plus `image_url` content.
- Structured MCP output in addition to plain text content.

## Required configuration

The server needs an upstream vision model endpoint. At minimum configure:

| Setting | Required | CLI option | Environment variable | Description | Example |
| --- | --- | --- | --- | --- | --- |
| API base URL | Yes | `--api-base-url` | `VISION_API_BASE_URL` | Root URL of the upstream OpenAI-compatible API. Prefer scheme + host only; keep the request path in `api-path`. | `https://api.openai.com` |
| Model | Yes | `--model` | `VISION_MODEL` | Default vision-capable model exposed by the upstream API. A tool call can override it with `model`. | `gpt-4o-mini` |
| API key | Usually | `--api-key` | `VISION_API_KEY` | Bearer token sent as `Authorization: Bearer <key>`. Omit only when your endpoint does not require authentication. | `sk-xxxx` |

The final upstream URL is built from:

```text
<api-base-url><api-path>
```

Example:

```text
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
=> https://api.openai.com/v1/chat/completions
```

## Full configuration reference

Configuration priority:

```text
CLI arguments > environment variables > defaults
```

| Purpose | CLI option | Alias | Environment variable | Default | Notes |
| --- | --- | --- | --- | --- | --- |
| Upstream API base URL | `--api-base-url <url>` | `--vision-api-base-url` | `VISION_API_BASE_URL` | none | Required. Use the API root such as `https://api.openai.com`. |
| Upstream API path | `--api-path <path>` | `--vision-api-path` | `VISION_API_PATH` | `/v1/chat/completions` | Chat Completions endpoint path. |
| Upstream API key | `--api-key <key>` | `--vision-api-key` | `VISION_API_KEY` | none | Added as a Bearer token when set. |
| Default model | `--model <name>` | `--vision-model` | `VISION_MODEL` | none | Required. Must support image input. |
| Request timeout | `--timeout-ms <ms>` | `--vision-timeout-ms` | `VISION_TIMEOUT_MS` | `60000` | Invalid or non-positive environment values fall back to default. |
| Default output token limit | `--max-tokens <n>` | `--vision-max-tokens` | `VISION_MAX_TOKENS` | `4096` | Sent upstream as `max_tokens` when a tool call omits `maxTokens`. |
| MCP server name | `--server-name <name>` | `--mcp-server-name` | `MCP_SERVER_NAME` | `mcp-vision-server` | Metadata shown to the MCP client. |
| MCP server version | `--server-version <ver>` | `--mcp-server-version` | `MCP_SERVER_VERSION` | `0.1.4` | Metadata shown to the MCP client. |

Environment-style configuration example:

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

## MCP client configuration

Most MCP clients should register this server as a `stdio` command. Replace the URL, key, and model with your provider values.

### JSON config

Use this shape for clients that accept `mcpServers` JSON, such as Claude Desktop, Cursor, VS Code-compatible MCP configs, and similar clients:

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

If your client supports an `env` block, you can keep secrets out of `args`:

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

## Upstream API contract

The server sends a `POST` request to the configured Chat Completions URL:

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

Response parsing supports:

- `choices[0].message.content` as a string.
- `choices[0].message.content` as an array of text parts.
- `choices[0].message.reasoning` or `reasoning_content` as fallback text for compatible providers.

## Image source behavior

Exactly one image source must be supplied per tool call.

| Field | Use when | Handling |
| --- | --- | --- |
| `imagePath` | The MCP server process can read an absolute local file path. | The file is read, MIME type is inferred from extension, and the image is sent upstream as a `data:` URL. |
| `imageUrl` | The image is already addressable as `http(s)://`, `data:`, or `file://`. | `file://` is read like `imagePath`; remote URLs are passed upstream as URLs. |
| `imageBase64` + `imageMediaType` | The MCP client can pass uploaded attachment bytes directly. | The payload is wrapped as `data:<imageMediaType>;base64,<imageBase64>`. |

Supported local file extensions for MIME inference: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`.

Drag-and-drop support depends on the host MCP client. If the client does not forward attachment data as `imagePath`, `imageUrl`, or `imageBase64`, the server cannot access that image.

## Tools

### `vision_analyze`

Use this tool for general image understanding.

Required:

- `prompt`: instruction passed to the vision model.
- Exactly one of `imagePath`, `imageUrl`, or `imageBase64`.

Required with `imageBase64`:

- `imageMediaType`: for example `image/png` or `image/jpeg`.

Optional:

- `model`: override the configured default model for this call.
- `detail`: `auto`, `low`, or `high`; forwarded to providers that support image detail.
- `maxTokens`: positive integer up to `32768`; overrides the configured default for this call.

Example:

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

Use this tool for text extraction.

Required:

- Exactly one of `imagePath`, `imageUrl`, or `imageBase64`.

Required with `imageBase64`:

- `imageMediaType`.

Optional:

- `languageHint`: language hint such as `en`, `zh-CN`, or `ja`.
- `outputFormat`: `plain`, `markdown`, or `json`; default is `plain`.
- `model`: override the configured default model for this call.
- `detail`: `auto`, `low`, or `high`.
- `maxTokens`: positive integer up to `32768`.

Example:

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

## Tool output

Both tools return plain text in MCP `content` and structured data in `structuredContent`:

```json
{
  "text": "recognized or analyzed text",
  "model": "model-used",
  "sourceLabel": "resolved image source",
  "mediaType": "image/png"
}
```

## Provider notes

- The upstream API must accept OpenAI-compatible Chat Completions image input.
- Some providers ignore `detail` or `max_tokens`; behavior then follows the provider.
- Large images may increase latency, token usage, and provider-side request size.
- Only one image is accepted per tool call.

## Links

- [Linux Do](https://linux.do/)
