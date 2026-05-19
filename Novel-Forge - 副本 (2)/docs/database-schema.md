# 数据库结构草案

当前 demo 仍使用浏览器 `localStorage`，但数据对象已经按未来 SQLite 表结构靠拢。

## BOOKS

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 作品 id（主键） |
| `title` | TEXT | 书名 |
| `genre` | TEXT | 类型 |
| `status` | TEXT | `planning` / `active` / `paused` / `finished` |
| `cover_color` | TEXT | 书目颜色，前端字段为 `coverColor` |
| `premise` | TEXT | 一句话核心 |
| `created_at` | TEXT | 创建时间（ISO 格式） |
| `updated_at` | TEXT | 更新时间（ISO 格式） |

## NOTES_RAW（灵感收件箱）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 原始笔记 id（主键） |
| `bookId` | TEXT | 归属作品 id |
| `content` | TEXT | 用户随手写入的原始内容 |
| `ai_status` | TEXT | `pending` / `processing` / `done`，前端字段为 `aiStatus` |
| `status` | TEXT | `inbox` / `suggested` / `archived` |
| `suggestion` | JSON | AI 建议（包含 title、module、tags、summary、confidence、bookId） |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## IDEAS（设定资料库）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 想法 id（主键） |
| `bookId` | TEXT | 所属作品 |
| `module` | TEXT | 模块：人物、世界观、剧情线、金手指、伏笔、场景片段、道具、境界等 |
| `category` | TEXT | 分类（与 module 一致） |
| `title` | TEXT | 设定名称 |
| `content` | TEXT | 设定详情 |
| `tags` | JSON | 标签数组 |
| `ai_confidence` | REAL | AI 置信度（0-1），前端字段为 `aiConfidence` |
| `noteId` | TEXT | 来源原始笔记 id |
| `sourceNoteId` | TEXT | 来源笔记 id（冗余字段） |
| `relations` | JSON | 关联关系数组（{targetId, relationTypeId}） |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## CHARACTERS（人物专项卡片）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 人物 id（主键） |
| `bookId` | TEXT | 所属作品 |
| `ideaId` | TEXT | 关联的 IDEAS id |
| `name` | TEXT | 人物名称 |
| `role` | TEXT | `主角` / `反派` / `待定` |
| `background` | TEXT | 背景故事 |
| `personality` | TEXT | 性格描述 |
| `abilities` | TEXT | 能力特长 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## WORLDBUILDING（世界观专项卡片）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 世界观 id（主键） |
| `bookId` | TEXT | 所属作品 |
| `ideaId` | TEXT | 关联的 IDEAS id |
| `term` | TEXT | 术语名称 |
| `category` | TEXT | 分类标签 |
| `description` | TEXT | 详细描述 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## CHAPTERS（章节）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 章节 id（主键） |
| `bookId` | TEXT | 所属作品 |
| `order_num` | INTEGER | 章节顺序号 |
| `title` | TEXT | 章节标题 |
| `content` | TEXT | 章节内容 |
| `status` | TEXT | 状态标记 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## RELATION_TYPES（关系类型）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 关系类型 id |
| `bookId` | TEXT | 所属作品（空表示全局类型） |
| `name` | TEXT | 关系名称（如：兄弟、师徒、对立） |
| `color` | TEXT | 关系颜色 |
| `editable` | INTEGER | 是否可编辑（0/1） |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## RELATIONS（关系实例）

**说明**：当前 Demo 中关系存储在 IDEAS.relations 字段中，正式版建议拆分为独立表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 关系 id（主键） |
| `fromId` | TEXT | 源设定资料 id |
| `toId` | TEXT | 目标设定资料 id |
| `relationTypeId` | TEXT | 关系类型 id |
| `bookId` | TEXT | 所属作品 |
| `created_at` | TEXT | 创建时间 |

## MODULES（模块定义）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 模块 id |
| `bookId` | TEXT | 所属作品（空表示全局模块） |
| `name` | TEXT | 模块名称 |
| `color` | TEXT | 模块颜色 |
| `icon` | TEXT | 模块图标 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## AI_CONFIG（AI 接口配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 配置 id |
| `provider` | TEXT | 提供商名称 |
| `api_key` | TEXT | API Key（建议加密存储） |
| `model` | TEXT | 模型名称 |
| `system_prompt` | TEXT | 系统提示词 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |

## ACTIVITIES（活动日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 日志 id |
| `bookId` | TEXT | 关联作品 |
| `action` | TEXT | 操作类型 |
| `message` | TEXT | 操作描述 |
| `created_at` | TEXT | 创建时间 |

---

**安全注意事项**：正式桌面版里 `api_key` 应交给系统安全存储或本地加密模块，不建议明文写入数据库。