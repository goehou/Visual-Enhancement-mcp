# mcp-vision-server

[English](README.md) | [简体中文](README.zh-CN.md)

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

### Run from npm (recommended)

The package is published to npm, so you do not need to clone the repo. Run it directly with `npx`, passing your upstream API base URL, key, and model name:

```bash
npx -y mcp-vision-server \
  --api-base-url https://your-api.example.com \
  --api-path /v1/chat/completions \
  --api-key sk-xxxx \
  --model your-vision-model
```

Just checking the CLI help:

```bash
npx -y mcp-vision-server --help
```

Or install it globally:

```bash
npm install -g mcp-vision-server
mcp-vision-server --help
```

Most MCP clients (Codex, Claude Code, etc.) launch the server via `npx -y mcp-vision-server` automatically — see the examples below.

### Build from source (development)

```bash
git clone https://github.com/goehou/mcp-vision-server.git
cd mcp-vision-server
npm install
npm run build
node dist/server.js --help
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
--max-tokens <n>          Default max_tokens, default: 4096
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
VISION_MAX_TOKENS=4096
```

## Required configuration

At minimum you must tell the server where the upstream vision API lives and which model to call:

| Option | Required | What to put | Example |
| --- | --- | --- | --- |
| `--api-base-url` | Yes | Root URL of your upstream OpenAI-compatible API (scheme + host, no path) | `https://api.openai.com` or `https://your-proxy.example.com` |
| `--api-path` | No | Chat completions path appended to the base URL | `/v1/chat/completions` (default) |
| `--api-key` | Yes* | Bearer key for the upstream API. *Optional only if your endpoint needs no auth | `sk-xxxx` |
| `--model` | Yes | Name of a vision-capable model the upstream API exposes | `gpt-4o-mini`, `qwen-vl-max`, `your-vision-model` |
| `--timeout-ms` | No | Request timeout in milliseconds | `60000` (default) |
| `--max-tokens` | No | Default `max_tokens` sent upstream when a tool call omits `maxTokens` | `4096` (default) |

The final request goes to `<api-base-url><api-path>`. For example `--api-base-url https://api.openai.com --api-path /v1/chat/completions` calls `https://api.openai.com/v1/chat/completions`.

## Codex example

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

## Claude Code example

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

## MCP client config (JSON)

Clients that use a JSON config file (Claude Desktop, VS Code, Cursor, etc.) can register the server like this. Replace the URL, key, and model with your own:

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

If your client prefers environment variables over CLI flags, you can instead pass an `env` block (`VISION_API_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL`, ...) and drop the matching `args`.

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
- `outputFormat`: `plain | markdown | json`, default: `plain`
- `model`
- `detail`
- `maxTokens`

Example:

```json
{
  "name": "vision_ocr",
  "arguments": {
    "imageUrl": "file:///C:/images/receipt.png",
    "languageHint": "en",
    "outputFormat": "markdown"
  }
}
```

## Tool outputs

Both tools return the model text in `content` for compatibility, and also expose structured output for clients that support MCP `structuredContent`:

```json
{
  "text": "recognized or analyzed text",
  "model": "model-used",
  "sourceLabel": "resolved image source",
  "mediaType": "image/png"
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

## Links

- [Linux Do](https://linux.do/)
