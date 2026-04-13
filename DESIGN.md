# DESIGN

## 目标

- 在本机提供一个可运行的 `stdio MCP server`
- 把图片识别抽象成 MCP 工具，供 Claude Code / Codex 调用
- 复用现有 vision model，而不是在本地重新实现视觉算法
- 允许在 MCP 启动命令里直接写入 URL、Key、模型名

## 非目标

- 不实现本地 OCR / CV 推理
- 不处理复杂工作流编排
- 不首版支持 Anthropic / Gemini 原生格式

## 架构

```text
MCP Client
  -> stdio MCP server
    -> tool layer
      -> image loader
      -> prompt builder
      -> runtime config
      -> OpenAI-compatible adapter
        -> vision model API
```

## 核心组件

- `src/server.ts`
  - MCP 生命周期与工具注册
- `src/tools/*`
  - 工具输入校验与调用编排
- `src/core/image.ts`
  - 本地路径转 data URL，或透传远程 URL
- `src/core/prompts.ts`
  - 固化通用识别与 OCR prompt
- `src/core/config.ts`
  - 启动参数与环境变量解析
- `src/adapters/openaiCompatible.ts`
  - 上游视觉模型请求与结果归一化

## 关键决策

1. 采用 `stdio` 而不是 HTTP
   - 与 Claude Code / Codex 的本地 MCP 集成路径最短

2. 首版只做 OpenAI-compatible adapter
   - 能最快跑通多数兼容接口
   - 降低首版复杂度

3. 本地图片统一转 `data URL`
   - 避免客户端附件透传问题
   - 让上游请求格式统一

4. 工具拆成 `vision_analyze` 与 `vision_ocr`
   - 保持调用语义明确
   - 便于后续扩展 `vision_extract`

5. 运行配置采用 `CLI > ENV > 默认值`
   - 让 `codex mcp add` 与 `claude mcp add` 可以把 URL、Key、模型名直接写在命令参数中
   - 降低部署时对额外环境文件的依赖

6. npm 发布仅包含运行所需文件
   - 通过 `bin` 暴露 CLI 入口，支持 `npx mcp-vision-server`
   - 通过 `files` 白名单避免把源码、IDE 配置与测试资产打进 npm 包
   - 通过 `prepublishOnly` 在发布前强制执行测试

## 安全边界

- 只读取调用参数指定的图片路径
- 不执行图片中的任何指令
- 不在 stdout 打日志，避免污染 JSON-RPC
- API Key 允许通过启动参数传入，但仍建议仅保存在受控的本地 MCP 配置中

## 已知限制

- 不支持多图对比
- 不支持 schema 化结构提取
- 远程 URL 目前只做透传，不做下载或缓存
- 上游返回格式若明显偏离 OpenAI-compatible 约定，需要新增 adapter

## 后续演进

1. 增加 `vision_extract`
2. 增加多图输入
3. 增加 Anthropic / Gemini adapter
4. 增加图片压缩与尺寸控制
5. 增加结构化输出校验

## 变更历史

- `0.1.0`: 创建初版项目，提供 `vision_analyze` 与 `vision_ocr`
- `0.1.1`: 增加 CLI 配置参数，支持在 Codex / Claude Code 的 MCP 启动命令中直接写入 URL、Key、模型名
- `0.1.2`: 增加 npm 发布元数据、CLI 入口、LICENSE 与面向 `npx` 的接入说明
