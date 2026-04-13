# Visual-Enhancement-mcp

一个本地运行的 `stdio MCP server`。它把本地图片或图片 URL 包装成 multimodal 请求，交给你已有的 vision model 识别，再把结果返回给 Claude Code / Codex。

## 当前能力

- `vision_analyze`: 通用图片理解
- `vision_ocr`: OCR 文本提取
- 支持 `imagePath` 或 `imageUrl`
- 当前适配 `OpenAI-compatible Chat Completions` 接口

## 配置优先级

```text
CLI 参数 > 环境变量 > 默认值
```

这意味着你可以在 `claude mcp add` 或 `codex mcp add` 时，直接把视觉模型的 URL、Key、模型名写进命令参数，不必依赖单独的环境变量文件。

## 运行要求

- Node.js 22+
- 一个可用的 vision / multimodal model API

## 安装与构建

```bash
npm install
npm run build
```

## 启动参数

```text
--api-base-url <url>      上游视觉模型 API 根地址
--api-path <path>         上游 API 路径，默认 /v1/chat/completions
--api-key <key>           上游 API Key
--model <name>            默认视觉模型名
--timeout-ms <ms>         请求超时，默认 60000
--server-name <name>      MCP server 名称
--server-version <ver>    MCP server 版本
```

查看帮助：

```bash
node dist/server.js --help
```

## 环境变量兜底

如果你不想把参数写在命令行，也可以继续使用环境变量：

```bash
VISION_API_BASE_URL=https://api.openai.com
VISION_API_PATH=/v1/chat/completions
VISION_API_KEY=sk-xxxx
VISION_MODEL=gpt-4o-mini
VISION_TIMEOUT_MS=60000
```

## 配置到 Codex

### 命令式添加

```powershell
codex mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

### 配置文件写法

修改本机的 `config.toml`：

```toml
[mcp_servers.vision]
type = "stdio"
command = "npx"
args = [
  "-y",
  "mcp-vision-server",
  "--api-base-url", "https://your-api.example.com",
  "--api-path", "/v1/chat/completions",
  "--api-key", "sk-xxxx",
  "--model", "your-vision-model",
  "--timeout-ms", "60000"
]
```

查看是否成功：

```powershell
codex mcp list
codex mcp get vision --json
```

## 配置到 Claude Code

### 命令式添加

```powershell
claude mcp add vision -- `
  npx -y mcp-vision-server `
  --api-base-url https://your-api.example.com `
  --api-path /v1/chat/completions `
  --api-key sk-xxxx `
  --model your-vision-model `
  --timeout-ms 60000
```

### 说明

- `claude mcp add` 在 `--` 后面跟的是完整子进程命令
- 所以你可以把 URL、Key、模型名直接作为 MCP server 的启动参数写进去
- 如果你更喜欢环境变量，也可以继续用 `-e`

查看是否成功：

```powershell
claude mcp list
claude mcp get vision
```

## 工具说明

### `vision_analyze`

输入：

- `imagePath`: 本地绝对路径，与 `imageUrl` 二选一
- `imageUrl`: 远程 URL 或 data URL，与 `imagePath` 二选一
- `prompt`: 分析指令
- `model?`: 可选，覆盖默认模型
- `detail?`: `auto | low | high`
- `maxTokens?`: 返回 token 上限

### `vision_ocr`

输入：

- `imagePath` 或 `imageUrl`
- `languageHint?`
- `model?`
- `detail?`
- `maxTokens?`

## 使用示例

通用识图：

```json
{
  "name": "vision_analyze",
  "arguments": {
    "imagePath": "<absolute-path-to-image>",
    "prompt": "识别这张图里的主要内容和可见文字"
  }
}
```

OCR：

```json
{
  "name": "vision_ocr",
  "arguments": {
    "imagePath": "<absolute-path-to-image>",
    "languageHint": "zh-CN"
  }
}
```

## 已知限制

- 当前只支持单图输入
- 当前只适配 OpenAI-compatible 接口
- 大图会带来更高延迟和 token 成本
- 某些上游对 `detail`、`max_tokens` 的支持不完全一致

