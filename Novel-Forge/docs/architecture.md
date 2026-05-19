# 架构草案

## 界面层

- 书库：多作品切换，颜色区分书目。
- 快速记录：原始笔记进入 `NOTES_RAW`，支持 `@书名` 指定归属。
- 设定库：展示 `IDEAS`，并逐步拆出 `CHARACTERS` / `WORLDBUILDING` 等专项卡片。
- 正文写作：章节编辑器和右侧相关设定引用。

## 核心逻辑层

- AI 分类引擎：识别作品、分类、提取标题/摘要/标签/置信度。
- 搜索索引：demo 用前端全文匹配，SQLite 版建议使用 FTS5。
- API 代理：demo 已通过 `/api/chat-completion` 代理 DeepSeek 请求。
- 导出模块：当前支持 JSON 备份，后续可加 Markdown、DOCX、PDF。

## 数据层

- Demo：`localStorage`。
- Windows 桌面版：SQLite 主库 + FTS5 搜索索引 + 本地文件目录。
- API Key：用户自控，正式版使用系统凭据库或本地加密存储。
