# mcp-vision-server

A local `stdio` MCP server that forwards image understanding and OCR requests to an existing vision-capable chat completions API.

## Features

- `vision_analyze`: general image understanding
- `vision_ocr`: text extraction
- Supports `imagePath`, `imageUrl`, and uploaded `imageBase64 + imageMediaType`
- Accepts `http(s)://`, `data:`, and `file://` image URLs
- Works with OpenAI-compatible Chat Completions APIs

## Why the previous attachment flow failed

The old server only accepted:

- `imagePath`
- `imageUrl`

When an MCP client let the user drag an image into chat but did not expose a local file path or URL to the tool call, the server had nothing it could read.

This repo now also supports:

- `imageBase64`
- `imageMediaType`

That gives MCP clients a third transport shape for uploaded files: they can pass attachment bytes directly instead of inventing a path.

## Important limitation

This change makes the server attachment-friendly, but it does **not** force every MCP client to map drag-and-drop uploads into tool arguments automatically.

What is supported now:

- A client can send a local absolute path through `imagePath`
- A client can send a `file://` URL through `imageUrl`
- A client can send uploaded bytes through `imageBase64` plus `imageMediaType`

What still depends on the client:

- Whether dragging an image into the chat UI is automatically converted into one of the fields above

If the host client never forwards attachment data to the MCP tool, the server still cannot see that file.

## Requirements

- Node.js 22+
- A reachable vision / multimodal model API

## Install

```bash
npm install
npm run build
```

## Configuration priority

```text
CLI arguments > environment variables > defaults
```

## CLI options

```text
--api-base-url <url>      Upstream API base URL
--api-path <path>         Upstream API path, default: /v1/chat/completions
--api-key <key>           Upstream API key
--model <name>            Default vision model
--timeout-ms <ms>         Request timeout, default: 60000
--server-name <name>      MCP server name
--server-version <ver>    MCP server version
```

Show help:

```bash
node dist/server.js --help
```

## Environment variables

```bash
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
VISION_API_KEY=sk-xxxx
VISION_MODEL=gpt-4o-mini
VISION_TIMEOUT_MS=60000
```

## Codex example

```powershell
codex mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

## Claude Code example

```powershell
claude mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

## Tool inputs

### `vision_analyze`

Required:

- `prompt`

Exactly one image source:

- `imagePath`: local absolute path
- `imageUrl`: remote URL, `data:` URL, or `file://` URL
- `imageBase64`: base64-encoded image payload

Required with `imageBase64`:

- `imageMediaType`: for example `image/png`, `image/jpeg`

Optional:

- `model`
- `detail`: `auto | low | high`
- `maxTokens`

Example with a local path:

```json
{
  "name": "vision_analyze",
  "arguments": {
    "imagePath": "C:\\\\images\\\\cat.png",
    "prompt": "Describe the main subject and any visible text."
  }
}
```

Example with uploaded bytes:

```json
{
  "name": "vision_analyze",
  "arguments": {
    "imageBase64": "<base64-image>",
    "imageMediaType": "image/png",
    "prompt": "Describe the UI and extract visible labels."
  }
}
```

### `vision_ocr`

Exactly one image source:

- `imagePath`
- `imageUrl`
- `imageBase64`

Required with `imageBase64`:

- `imageMediaType`

Optional:

- `languageHint`
- `model`
- `detail`
- `maxTokens`

Example:

```json
{
  "name": "vision_ocr",
  "arguments": {
    "imageUrl": "file:///C:/images/receipt.png",
    "languageHint": "en"
  }
}
```

## Tests

```bash
npm test
```

## Known limitations

- Single-image input only
- OpenAI-compatible upstream APIs only
- Large images increase latency and token cost
- Some upstream providers may ignore `detail` or `max_tokens`

## 🤝 友情链接

- [Linux Do](https://linux.do/)
