import { getState, getApiConfig, activeBookId, getModules } from './state.js';
import { DEFAULT_PROMPT } from './constants.js';

let addLog = () => {};

export const setAddLog = (fn) => {
  addLog = fn;
};

const getPromptWithModules = () => {
  const modules = getModules();
  const moduleList = modules.map((m) => `"${m.id}"`).join(", ");
  const moduleNames = modules.map((m) => `${m.id}（${m.name}：${m.hint}）`).join("\n- ");
  
  return DEFAULT_PROMPT
    .replace("{{MODULES}}", moduleList)
    + `\n\n当前可用模块：\n- ${moduleNames}`;
};

const shouldDisableDeepSeekThinking = (config) => {
  return config.endpoint?.includes("deepseek") && !config.endpoint?.includes("/v1/chat/completions");
};

const sendChatCompletion = async (body) => {
  const config = getApiConfig();

  if (typeof window !== "undefined" && window.electronAPI?.chatCompletion) {
    const result = await window.electronAPI.chatCompletion(config.endpoint, config.apiKey, body);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => JSON.parse(result.body || "{}"),
      text: async () => result.body
    };
  }

  return fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });
};

const readApiError = async (response) => {
  try {
    const data = await response.json();
    return data.error?.message || data.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const getFriendlyApiError = (error) => {
  if (error.message?.includes("401")) return "API Key 无效";
  if (error.message?.includes("403")) return "API 权限不足";
  if (error.message?.includes("429")) return "请求过于频繁，请稍后再试";
  if (error.message?.includes("network")) return "网络连接失败";
  return error.message || "未知错误";
};

const normalizeSuggestion = (parsed, note) => {
  const moduleIds = getModules().map(m => m.id);
  const validModule = moduleIds.includes(parsed.module) ? parsed.module : "scenes";
  
  return {
    bookId: parsed.bookId || activeBookId(),
    module: validModule,
    title: String(parsed.title || note.title).slice(0, 30),
    summary: String(parsed.summary || note.content).slice(0, 200),
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    reason: String(parsed.reason || "").slice(0, 500),
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.slice(0, 5) : []
  };
};

const classifyLocally = (note) => {
  const keywords = {
    characters: ["人物", "角色", "主角", "配角", "性格", "身世", "背景"],
    world: ["世界", "设定", "规则", "势力", "地点", "历史", "大陆"],
    plot: ["剧情", "故事", "主线", "支线", "冲突", "转折", "结局"],
    power: ["能力", "技能", "金手指", "系统", "魔法", "天赋"],
    foreshadow: ["伏笔", "线索", "悬念", "回收", "暗示"],
    scenes: ["场景", "桥段", "对话", "氛围", "描写", "片段"]
  };
  
  const text = `${note.title} ${note.content}`.toLowerCase();
  let bestModule = "scenes";
  let bestScore = 0;
  
  Object.entries(keywords).forEach(([module, terms]) => {
    const score = terms.filter(term => text.includes(term)).length;
    if (score > bestScore) {
      bestScore = score;
      bestModule = module;
    }
  });
  
  const tags = [];
  if (text.includes("主角")) tags.push("主角");
  if (text.includes("能力") || text.includes("金手指")) tags.push("能力");
  if (text.includes("记忆")) tags.push("记忆");
  if (text.includes("代价")) tags.push("代价");
  
  return {
    bookId: activeBookId(),
    module: bestModule,
    title: note.title.slice(0, 30),
    summary: note.content.slice(0, 100),
    tags: tags.slice(0, 4),
    confidence: Math.min(1, 0.5 + bestScore * 0.1),
    reason: `本地规则匹配：内容包含相关关键词`,
    conflicts: []
  };
};

export const classifyNote = async (note) => {
  const config = getApiConfig();
  
  if (config.endpoint && config.apiKey && config.model) {
    try {
      return await classifyWithApi(note);
    } catch (error) {
      console.warn(error);
      return classifyLocally(note);
    }
  }
  return classifyLocally(note);
};

export const classifyWithApi = async (note) => {
  const startTime = Date.now();
  addLog("info", `开始 AI 分类：${note.title.slice(0, 20)}...`);
  
  const state = getState();
  const books = state.books.map(({ id, title, genre, premise }) => ({ id, title, genre, premise }));
  const library = state.libraryItems
    .filter((item) => item.bookId === activeBookId())
    .slice(0, 30)
    .map(({ title, module, content, tags }) => ({ title, module, content, tags }));
  
  const requestBody = {
    model: getApiConfig().model,
    temperature: 0.2,
    messages: [
      { role: "system", content: getPromptWithModules() },
      {
        role: "user",
        content: JSON.stringify({
          currentBookId: activeBookId(),
          books,
          existingLibrary: library,
          note: { title: note.title, content: note.content }
        })
      }
    ],
    response_format: { type: "json_object" }
  };

  if (shouldDisableDeepSeekThinking(getApiConfig())) {
    requestBody.thinking = { type: "disabled" };
  }

  try {
    addLog("api", `调用 API: ${getApiConfig().endpoint}`);
    
    const response = await sendChatCompletion(requestBody);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await readApiError(response);
      addLog("error", `API 调用失败: ${error}`, { status: response.status, duration });
      throw new Error(error);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    addLog("api", `API 调用成功，耗时 ${duration}ms`, { duration, tokens: data.usage });
    
    const parsed = JSON.parse(content || "{}");
    return normalizeSuggestion(parsed, note);
    
  } catch (error) {
    addLog("error", `API 调用异常: ${error.message}`);
    throw error;
  }
};

export const analyzeNewSettings = async (chapterContent, chapterTitle = "") => {
  const startTime = Date.now();
  addLog("info", `开始分析新设定资源`);
  
  const config = getApiConfig();
  
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("请先配置 AI 接口");
  }

  const state = getState();
  const bookId = activeBookId();
  
  const existingLibrary = state.libraryItems
    .filter((item) => item.bookId === bookId)
    .map(({ title, module, content, tags }) => ({ title, module, content, tags }));

  const modules = getModules();
  const moduleList = modules.map((m) => `${m.id}（${m.name}）`).join("、");
  const moduleIds = modules.map((m) => m.id).join(", ");

  const analysisPrompt = `
你是一位小说设定分析专家。请分析以下正文内容，识别其中可能包含的新设定资源。

当前作品已有设定：
${JSON.stringify(existingLibrary, null, 2)}

当前作品可用模块：${moduleList}

需要分析的正文内容：
标题：${chapterTitle}
内容：${chapterContent}

请找出正文中出现的、但尚未在现有设定中记录的新设定元素。每个新设定应包含：
- title: 设定名称（简洁描述）
- module: 所属模块（必须从以下列表选择：${moduleIds}）
- content: 设定详情描述
- tags: 相关标签（最多3个）
- reason: 为什么认为这是新设定

请以 JSON 数组格式返回，例如：
[
  {
    "title": "神秘老者",
    "module": "characters",
    "content": "一位隐居在山林中的神秘老者，似乎知晓主角的身世秘密",
    "tags": ["神秘", "身世"],
    "reason": "正文中首次出现，之前设定中没有相关人物"
  }
]

如果没有发现新设定，请返回空数组 []。
  `.trim();

  const requestBody = {
    model: config.model,
    temperature: 0.3,
    messages: [
      { role: "system", content: "你是一位专业的小说设定分析助手，擅长从正文中识别新的设定元素。" },
      { role: "user", content: analysisPrompt }
    ],
    response_format: { type: "json_object" }
  };

  if (shouldDisableDeepSeekThinking(config)) {
    requestBody.thinking = { type: "disabled" };
  }

  try {
    addLog("api", `调用 API 分析新设定: ${getApiConfig().endpoint}`);
    
    const response = await sendChatCompletion(requestBody);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await readApiError(response);
      addLog("error", `设定分析失败: ${error}`, { status: response.status, duration });
      throw new Error(error);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    addLog("api", `设定分析成功，耗时 ${duration}ms`, { duration, tokens: data.usage });
    
    try {
      const result = JSON.parse(content || "[]");
      const settings = Array.isArray(result) ? result : [];
      addLog("info", `发现 ${settings.length} 个新设定资源`);
      return settings;
    } catch (parseError) {
      addLog("error", `解析响应失败: ${parseError.message}`);
      return [];
    }
    
  } catch (error) {
    addLog("error", `设定分析异常: ${error.message}`);
    throw error;
  }
};

export { getFriendlyApiError };