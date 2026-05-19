export const STORAGE_KEY = "novel-forge-demo-state";
export const API_STORAGE_KEY = "novel-forge-api-config";
export const LOGS_STORAGE_KEY = "novel-forge-logs";

export const BOOK_COVER_COLORS = ["#41634d", "#7f77dd", "#1d9e75", "#b17634", "#378add", "#a8473c"];

export const DEFAULT_MODULES = [
  { id: "characters", name: "人物", hint: "角色卡、动机、关系与变化" },
  { id: "world", name: "世界观", hint: "地点、势力、规则、历史" },
  { id: "plot", name: "剧情线", hint: "主线、支线、冲突、转折" },
  { id: "power", name: "金手指", hint: "能力、系统、限制、代价" },
  { id: "foreshadow", name: "伏笔", hint: "埋线、回收、悬念" },
  { id: "scenes", name: "场景片段", hint: "桥段、台词、氛围" }
];

export const DEFAULT_PROMPT = `你是小说创作资料整理助手。请把用户的零散灵感整理成严格的 JSON 格式，字段必须包含：

{
  "bookId": "最匹配的作品 id，如果无法判断则用当前作品 id",
  "module": "{{MODULES}} 中的一个",
  "title": "12 字以内的简洁标题",
  "summary": "简短摘要，不超过100字",
  "tags": ["3到6个中文标签"],
  "confidence": 0到1之间的数字，表示分类置信度",
  "reason": "分类理由，说明为什么归类到该模块",
  "conflicts": ["可能与已有设定冲突的提醒"]
}

注意：
1. 必须返回有效的JSON格式，不能有多余内容
2. module字段必须是指定的模块ID之一
3. 请根据用户提供的作品信息和已有资料库内容进行分类`;

export const DEFAULT_API_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEFAULT_API_MODEL = "deepseek-v4-flash";

export const VIEW_LABELS = {
  workspace: "工作台",
  books: "书库",
  inbox: "灵感收件箱",
  library: "设定资料库",
  relation: "关系图谱",
  writing: "正文写作",
  focus: "沉浸写作",
  settings: "设置"
};

export const RELATION_TYPE_COLORS = [
  '#4a90d9', // 0: 自己（天蓝色，不可更改）
  '#6366f1', // 1: 默认关系1
  '#22c55e', // 2: 默认关系2
  '#f59e0b', // 3: 默认关系3
  '#ec4899', // 4: 默认关系4
  '#8b5cf6', // 5: 默认关系5
  '#06b6d4', // 6: 默认关系6
  '#84cc16', // 7: 默认关系7
  '#f97316', // 8: 默认关系8
  '#d946ef', // 9: 默认关系9
];

export const DEFAULT_RELATION_TYPES = [
  {
    id: '0',
    name: '自己',
    color: '#4a90d9',
    editable: false
  }
];

export const BOOK_STATUS_MAP = {
  planning: "规划中",
  active: "进行中",
  paused: "暂停",
  finished: "完结"
};