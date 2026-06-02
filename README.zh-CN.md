# mcp-vision-server

[English](README.md) | [简体中文](README.zh-CN.md)

一个本地 `stdio` MCP 服务器，用于把图片理解和 OCR 请求转发到已有的、支持视觉能力的 Chat Completions API。

## 功能

- `vision_analyze`：通用图片理解
- `vision_ocr`：文本提取
- 支持 `imagePath`、`imageUrl`，以及上传的 `imageBase64 + imageMediaType`
- 支持 `http(s)://`、`data:` 和 `file://` 图片 URL
- 兼容 OpenAI 风格的 Chat Completions API

## 为什么之前的附件流程会失败

旧版服务器只接受：

- `imagePath`
- `imageUrl`

当 MCP 客户端允许用户把图片拖进聊天窗口，但没有把本地文件路径或 URL 暴露给工具调用时，服务器就没有可读取的图片来源。

现在这个仓库也支持：

- `imageBase64`
- `imageMediaType`

这给 MCP 客户端提供了第三种上传文件传输方式：客户端可以直接传附件字节，而不是临时构造一个路径。

## 重要限制

这个改动让服务器更适合处理附件，但它**不会强制**所有 MCP 客户端自动把拖拽上传的图片映射成工具参数。

现在支持：

- 客户端通过 `imagePath` 发送本地绝对路径
- 客户端通过 `imageUrl` 发送 `file://` URL
- 客户端通过 `imageBase64` 加 `imageMediaType` 发送上传字节

仍然取决于客户端：

- 聊天 UI 中拖入图片后，是否会自动转换成上面任意一种字段

如果宿主客户端从不把附件数据传给 MCP 工具，服务器仍然无法看到该文件。

## 要求

- Node.js 22+
- 可访问的视觉/多模态模型 API

## 安装

### 从 npm 运行（推荐）

本包已发布到 npm，无需克隆仓库，直接用 `npx` 运行，传入你的上游 API 地址、密钥和模型名：

```bash
npx -y mcp-vision-server \
  --api-base-url https://your-api.example.com \
  --api-path /v1/chat/completions \
  --api-key sk-xxxx \
  --model your-vision-model
```

仅查看 CLI 帮助：

```bash
npx -y mcp-vision-server --help
```

或全局安装：

```bash
npm install -g mcp-vision-server
mcp-vision-server --help
```

大多数 MCP 客户端（Codex、Claude Code 等）会通过 `npx -y mcp-vision-server` 自动拉起服务器 —— 见下方示例。

### 从源码构建（开发）

```bash
git clone https://github.com/goehou/mcp-vision-server.git
cd mcp-vision-server
npm install
npm run build
node dist/server.js --help
```

## 配置优先级

```text
CLI 参数 > 环境变量 > 默认值
```

## CLI 选项

```text
--api-base-url <url>      上游 API 基础 URL
--api-path <path>         上游 API 路径，默认：/v1/chat/completions
--api-key <key>           上游 API key
--model <name>            默认视觉模型
--timeout-ms <ms>         请求超时时间，默认：60000
--server-name <name>      MCP server 名称
--server-version <ver>    MCP server 版本
```

查看帮助：

```bash
node dist/server.js --help
```

## 环境变量

```bash
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
VISION_API_KEY=sk-xxxx
VISION_MODEL=gpt-4o-mini
VISION_TIMEOUT_MS=60000
```

## 必填配置

至少需要告诉服务器上游视觉 API 在哪里、调用哪个模型：

| 选项 | 是否必填 | 填什么 | 示例 |
| --- | --- | --- | --- |
| `--api-base-url` | 是 | 上游 OpenAI 风格 API 的根地址（协议+主机，不含路径） | `https://api.openai.com` 或 `https://your-proxy.example.com` |
| `--api-path` | 否 | 拼在根地址后的 chat completions 路径 | `/v1/chat/completions`（默认） |
| `--api-key` | 是* | 上游 API 的 Bearer 密钥。*仅当端点无需鉴权时可省 | `sk-xxxx` |
| `--model` | 是 | 上游 API 提供的、具备视觉能力的模型名 | `gpt-4o-mini`、`qwen-vl-max`、`your-vision-model` |
| `--timeout-ms` | 否 | 请求超时（毫秒） | `60000`（默认） |

最终请求发往 `<api-base-url><api-path>`。例如 `--api-base-url https://api.openai.com --api-path /v1/chat/completions` 会调用 `https://api.openai.com/v1/chat/completions`。

## Codex 示例

```powershell
codex mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

## Claude Code 示例

```powershell
claude mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

## MCP 客户端配置（JSON）

使用 JSON 配置文件的客户端（Claude Desktop、VS Code、Cursor 等）可以这样注册服务器。把 URL、密钥和模型名换成你自己的：

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
        "--timeout-ms", "60000"
      ]
    }
  }
}
```

如果你的客户端更习惯用环境变量而非 CLI 参数，可以改用 `env` 块（`VISION_API_BASE_URL`、`VISION_API_KEY`、`VISION_MODEL` 等），并去掉对应的 `args`。

## 工具输入

### `vision_analyze`

必填：

- `prompt`

必须且只能提供一种图片来源：

- `imagePath`：本地绝对路径
- `imageUrl`：远程 URL、`data:` URL 或 `file://` URL
- `imageBase64`：base64 编码的图片内容

使用 `imageBase64` 时必填：

- `imageMediaType`：例如 `image/png`、`image/jpeg`

可选：

- `model`
- `detail`：`auto | low | high`
- `maxTokens`

本地路径示例：

```json
{
  "name": "vision_analyze",
  "arguments": {
    "imagePath": "C:\\\\images\\\\cat.png",
    "prompt": "Describe the main subject and any visible text."
  }
}
```

上传字节示例：

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

必须且只能提供一种图片来源：

- `imagePath`
- `imageUrl`
- `imageBase64`

使用 `imageBase64` 时必填：

- `imageMediaType`

可选：

- `languageHint`
- `outputFormat`：`plain | markdown | json`，默认：`plain`
- `model`
- `detail`
- `maxTokens`

示例：

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

## 工具输出

两个工具都会在 `content` 中返回模型文本以保持兼容；同时也会为支持 MCP `structuredContent` 的客户端提供结构化输出：

```json
{
  "text": "recognized or analyzed text",
  "model": "model-used",
  "sourceLabel": "resolved image source",
  "mediaType": "image/png"
}
```

## 测试

```bash
npm test
```

## 已知限制

- 仅支持单图输入
- 仅支持 OpenAI-compatible 上游 API
- 大图片会增加延迟和 token 成本
- 部分上游服务可能会忽略 `detail` 或 `max_tokens`

## 友情链接

- [Linux Do](https://linux.do/)
