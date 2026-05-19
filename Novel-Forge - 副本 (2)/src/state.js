import { STORAGE_KEY, API_STORAGE_KEY, DEFAULT_MODULES, BOOK_COVER_COLORS, DEFAULT_RELATION_TYPES } from './constants.js';
import { nowIso, uid } from './utils.js';
import { initDB, saveBooks, saveLibraryItems, saveNotes, saveChapters, saveActivities, loadBooks, loadLibraryItems, loadNotes, loadChapters, loadActivities, clearAllData } from './db.js';

let state = null;
let apiConfig = null;
let dbInitialized = false;

const seedState = () => {
  const bookId = uid("book");
  const chapterId = uid("chapter");
  return {
    activeBookId: bookId,
    books: [
      {
        id: bookId,
        title: "长夜烬明",
        genre: "东方幻想",
        status: "active",
        coverColor: "#41634d",
        coverImage: null,
        premise: "一个失去故乡的少年，用会吞噬记忆的火种改写王朝末年的命运。",
        modules: [...DEFAULT_MODULES],
        relationTypes: [...DEFAULT_RELATION_TYPES],
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    notes: [
      {
        id: uid("note"),
        bookId,
        title: "代价型金手指",
        content: "主角每次用火种复盘失败，都能获得一次更优选择，但会忘记一个和亲近之人有关的小记忆。",
        status: "suggested",
        aiStatus: "done",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        suggestion: {
          bookId,
          module: "power",
          title: "记忆火种",
          summary: "主角通过火种复盘失败换取成长，但代价是遗忘珍贵记忆。",
          tags: ["金手指", "代价", "记忆", "成长"],
          confidence: 0.92,
          reason: "内容集中描述能力机制、收益和代价，适合放入金手指模块。",
          conflicts: ["需要持续记录被遗忘的记忆，避免后续情感线前后矛盾。"]
        }
      },
      {
        id: uid("note"),
        bookId,
        title: "女配真实身份",
        content: "女配表面是商会养女，其实是前朝公主。她帮主角不是因为爱情，而是想借他打碎新朝的神权合法性。",
        status: "inbox",
        aiStatus: "pending",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        suggestion: null
      }
    ],
    libraryItems: [
      {
        id: uid("item"),
        bookId,
        module: "characters",
        category: "characters",
        title: "沈照夜",
        content: "主角。故乡被焚后获得火种，表面冷静，实则害怕自己有一天把所有温柔记忆都交出去。",
        tags: ["主角", "火种", "记忆代价"],
        aiConfidence: 1,
        noteId: null,
        sourceNoteId: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: uid("item"),
        bookId,
        module: "foreshadow",
        category: "foreshadow",
        title: "忘记桂花糖",
        content: "第一卷反复出现主角不记得妹妹爱吃桂花糖。第三卷揭示这是第一次使用火种时被拿走的记忆。",
        tags: ["妹妹", "记忆", "第三卷回收"],
        aiConfidence: 1,
        noteId: null,
        sourceNoteId: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    characters: [
      {
        id: uid("character"),
        bookId,
        ideaId: null,
        name: "沈照夜",
        role: "主角",
        background: "故乡被焚后获得火种。",
        personality: "表面冷静，害怕失去温柔记忆。",
        abilities: "记忆火种",
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    worldbuilding: [],
    chapters: [
      {
        id: chapterId,
        bookId,
        title: "第一章 雨夜火种",
        body: "雨落在废城的青石上，像一封被撕碎的旧信。\n\n沈照夜醒来时，掌心有一簇不会熄灭的火。",
        order: 1,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    activities: [
      { id: uid("act"), text: "创建示例作品《长夜烬明》", createdAt: nowIso() },
      { id: uid("act"), text: "加入人物卡：沈照夜", createdAt: nowIso() }
    ]
  };
};

const mapLegacyNoteStatus = (status) => {
  if (status === "suggested" || status === "archived") return "done";
  if (status === "processing") return "processing";
  return "pending";
};

const upgradeState = (input) => {
  const defaults = seedState();
  const upgraded = {
    activeBookId: input.activeBookId || defaults.activeBookId,
    books: input.books?.length ? input.books : defaults.books,
    notes: input.notes || input.rawNotes || defaults.notes,
    libraryItems: input.libraryItems || input.ideas || defaults.libraryItems,
    characters: input.characters || [],
    worldbuilding: input.worldbuilding || [],
    chapters: input.chapters || defaults.chapters,
    activities: input.activities || defaults.activities
  };

  upgraded.books = upgraded.books.map((book, index) => {
    let relationTypes = book.relationTypes || [...DEFAULT_RELATION_TYPES];
    
    if (relationTypes[0]) {
      relationTypes[0] = {
        id: '0',
        name: '自己',
        color: '#4a90d9',
        editable: false
      };
    }
    
    const seenIds = new Set();
    let maxId = 0;
    relationTypes = relationTypes.map(type => {
      const currentId = parseInt(type.id) || 0;
      maxId = Math.max(maxId, currentId);
      
      if (seenIds.has(type.id)) {
        maxId++;
        return { ...type, id: maxId.toString() };
      }
      
      seenIds.add(type.id);
      return type;
    });
    
    return {
      ...book,
      status: book.status || "planning",
      coverColor: book.coverColor || book.cover_color || BOOK_COVER_COLORS[index % BOOK_COVER_COLORS.length],
      coverImage: book.coverImage || null,
      modules: book.modules || [...DEFAULT_MODULES],
      relationTypes
    };
  });

  upgraded.notes = upgraded.notes.map((note) => ({
    ...note,
    bookId: note.bookId || note.suggestion?.bookId || upgraded.activeBookId,
    aiStatus: note.aiStatus || mapLegacyNoteStatus(note.status)
  }));

  upgraded.libraryItems = upgraded.libraryItems.map((item) => ({
    ...item,
    category: item.category || item.module || "scenes",
    module: item.module || item.category || "scenes",
    aiConfidence: Number(item.aiConfidence ?? item.ai_confidence ?? 1),
    noteId: item.noteId || item.note_id || item.sourceNoteId || null
  }));

  if (!upgraded.books.some((book) => book.id === upgraded.activeBookId)) {
    upgraded.activeBookId = upgraded.books[0]?.id || null;
  }

  return upgraded;
};

const loadState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return upgradeState(seedState());
    const parsed = JSON.parse(stored);
    return upgradeState(parsed);
  } catch {
    return upgradeState(seedState());
  }
};

const normalizeApiConfig = (config = {}) => {
  return {
    endpoint: config.endpoint || "https://api.deepseek.com/chat/completions",
    model: config.model || "deepseek-v4-flash",
    apiKey: config.apiKey || "",
    prompt: config.prompt || ""
  };
};

const loadApiConfig = () => {
  try {
    return normalizeApiConfig(JSON.parse(localStorage.getItem(API_STORAGE_KEY) || "{}"));
  } catch {
    return normalizeApiConfig();
  }
};

export const initState = async () => {
  try {
    await initDB();
    dbInitialized = true;
    const dbBooks = await loadBooks();
    const dbItems = await loadLibraryItems();
    const dbNotes = await loadNotes();
    const dbChapters = await loadChapters();
    const dbActivities = await loadActivities();
    
    if (dbBooks.length > 0 || dbItems.length > 0) {
      state = {
        activeBookId: dbBooks[0]?.id || null,
        books: dbBooks,
        libraryItems: dbItems,
        notes: dbNotes,
        chapters: dbChapters,
        activities: dbActivities,
        characters: [],
        worldbuilding: []
      };
    } else {
      state = loadState();
      await persistToDB();
    }
  } catch (error) {
    console.warn('IndexedDB not available, falling back to localStorage:', error);
    state = loadState();
  }
  apiConfig = loadApiConfig();
};

export const getState = () => state;

export const getApiConfig = () => apiConfig;

export const setState = (newState) => {
  state = newState;
};

export const setApiConfig = (newConfig) => {
  apiConfig = newConfig;
};

const persistToDB = async () => {
  if (!dbInitialized || !state) return;
  try {
    await Promise.all([
      saveBooks(state.books),
      saveLibraryItems(state.libraryItems),
      saveNotes(state.notes),
      saveChapters(state.chapters),
      saveActivities(state.activities)
    ]);
  } catch (error) {
    console.warn('Failed to persist to IndexedDB:', error);
  }
};

export const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  persistToDB();
};

export const persistApiConfig = () => {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify(apiConfig));
};

export const activeBook = () => {
  if (!state.activeBookId) return null;
  return state.books.find((book) => book.id === state.activeBookId) || null;
};

export const activeBookId = () => {
  const book = activeBook();
  return book?.id || null;
};

export const addActivity = (text) => {
  state.activities.unshift({ id: uid("act"), text, createdAt: nowIso() });
  state.activities = state.activities.slice(0, 30);
};

export const getModules = (bookId = activeBookId()) => {
  if (!bookId) {
    const allModules = new Map();
    DEFAULT_MODULES.forEach((module) => {
      allModules.set(module.id, module);
    });
    state.books.forEach((book) => {
      if (book.modules) {
        book.modules.forEach((module) => {
          allModules.set(module.id, module);
        });
      }
    });
    return Array.from(allModules.values());
  }
  const book = state.books.find((b) => b.id === bookId);
  return book?.modules || DEFAULT_MODULES;
};

export const getModuleName = (moduleId) => {
  return getModules().find((module) => module.id === moduleId)?.name || "未分类";
};

export const getRelationTypes = (bookId = activeBookId()) => {
  if (!state) return [...DEFAULT_RELATION_TYPES];
  const book = state.books.find((b) => b.id === bookId);
  return book?.relationTypes || [...DEFAULT_RELATION_TYPES];
};

export const getRelationType = (typeId, bookId = activeBookId()) => {
  const types = getRelationTypes(bookId);
  const stringId = String(typeId);
  return types.find(t => t.id === stringId) || types[0];
};

export const updateRelationType = (typeId, updates, bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book || !book.relationTypes) return false;
  
  const type = book.relationTypes.find(t => t.id === typeId);
  if (!type || !type.editable) return false;
  
  Object.assign(type, updates);
  book.updatedAt = nowIso();
  persist();
  return true;
};

export const addRelationType = (bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return null;
  
  if (!book.relationTypes) {
    book.relationTypes = [...DEFAULT_RELATION_TYPES];
  }
  
  if (book.relationTypes.length >= 100) {
    return null;
  }
  
  const existingIds = new Set(book.relationTypes.map(t => parseInt(t.id) || 0));
  let newId = 1;
  while (existingIds.has(newId) && newId <= 100) {
    newId++;
  }
  
  if (newId > 100) {
    return null;
  }
  
  const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
  
  const newType = {
    id: newId.toString(),
    name: `关系${newId}`,
    color: randomColor,
    editable: true
  };
  
  book.relationTypes.push(newType);
  book.updatedAt = nowIso();
  persist();
  
  return newType;
};

export const isRelationTypeInUse = (typeId, bookId = activeBookId()) => {
  const state = getState();
  const items = state.libraryItems.filter(i => i.bookId === bookId);
  
  for (const item of items) {
    const relations = item.relations || [];
    if (relations.some(r => r.type === typeId)) {
      return true;
    }
  }
  
  return false;
};

export const removeRelationType = (typeId, bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book || !book.relationTypes) return false;
  
  const type = book.relationTypes.find(t => t.id === typeId);
  if (!type || !type.editable) return false;
  
  if (isRelationTypeInUse(typeId, bookId)) {
    return false;
  }
  
  book.relationTypes = book.relationTypes.filter(t => t.id !== typeId);
  book.updatedAt = nowIso();
  persist();
  
  return true;
};

export const removeUnusedRelationTypes = (bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book || !book.relationTypes) return 0;
  
  const initialCount = book.relationTypes.length;
  
  book.relationTypes = book.relationTypes.filter(type => {
    if (!type.editable) return true;
    return isRelationTypeInUse(type.id, bookId);
  });
  
  const removedCount = initialCount - book.relationTypes.length;
  
  if (removedCount > 0) {
    book.updatedAt = nowIso();
    persist();
  }
  
  return removedCount;
};