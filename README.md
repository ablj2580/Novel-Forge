# 墨匣 Novel Forge Demo

一个给小说作者使用的 AI 辅助创意整理与正文写作原型。

## 当前实现

- 作品库：多本小说独立管理。
- 书库：多本小说独立管理，支持书目颜色和写作状态。
- 灵感收件箱：随手写入零散想法，并记录 `pending` / `processing` / `done` 的 AI 状态。
- AI 审阅：默认使用 DeepSeek 的 OpenAI 兼容 Chat Completions 接口；未配置 API Key 时使用本地规则模拟分类。
- 设定资料库：人物、世界观、剧情线、金手指、伏笔、场景片段，并保留 AI 置信度。
- 正文写作：章节编辑、自动保存、字数统计、右侧相关设定引用。
- 本地数据：使用浏览器 `localStorage` 保存，支持 JSON 导入/导出。

## 设计文档

- [数据库结构草案](docs/database-schema.md)
- [架构草案](docs/architecture.md)

## 运行

```bash
npm start
```

打开：

```text
http://localhost:4173
```

## AI 接口

在应用左下角打开“AI 接口设置”，默认会填入 DeepSeek 的 OpenAI 兼容接口：

- 接口地址：`https://api.deepseek.com/chat/completions`
- 模型名：`deepseek-v4-flash`
- API Key：你的 DeepSeek API Key
- 分类提示词

当前 demo 会通过本地 `server.js` 的 `/api/chat-completion` 代理转发到 DeepSeek，避免浏览器直连第三方 API 时遇到跨域限制。正式桌面版建议对 API Key 做系统级安全存储。
