# 数据库结构草案

当前 demo 仍使用浏览器 `localStorage`，但数据对象已经按未来 SQLite 表结构靠拢。

## BOOKS

- `id`：作品 id
- `title`：书名
- `genre`：类型
- `status`：`planning` / `active` / `paused` / `finished`
- `cover_color`：书目颜色，前端字段为 `coverColor`
- `premise`：一句话核心
- `created_at` / `updated_at`

## NOTES_RAW

- `id`：原始笔记 id
- `content`：用户随手写入的原始内容
- `ai_status`：`pending` / `processing` / `done`，前端字段为 `aiStatus`
- `suggestion`：demo 阶段暂存 AI 建议；落库时可拆入 `IDEAS`
- `created_at` / `updated_at`

## IDEAS

- `id`：想法 id
- `book_id`：所属作品
- `note_id`：来源原始笔记
- `category`：人物、世界观、剧情线、金手指、伏笔、场景片段
- `title`
- `content`
- `tags`
- `ai_confidence`：AI 置信度，前端字段为 `aiConfidence`
- `created_at` / `updated_at`

## CHARACTERS

- `id`
- `book_id`
- `idea_id`
- `name`
- `role`
- `background`
- `personality`
- `abilities`

## WORLDBUILDING

- `id`
- `book_id`
- `idea_id`
- `term`
- `category`
- `description`

## CHAPTERS

- `id`
- `book_id`
- `order_num`
- `title`
- `content`
- `status`
- `created_at` / `updated_at`

## AI_CONFIG

- `id`
- `provider`
- `api_key`
- `model`
- `system_prompt`

正式桌面版里 `api_key` 应交给系统安全存储或本地加密模块，不建议明文写入数据库。
