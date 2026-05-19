import { STORAGE_KEY, API_STORAGE_KEY, DEFAULT_MODULES, BOOK_COVER_COLORS, DEFAULT_RELATION_TYPES } from './constants.js';
import { nowIso, uid } from './utils.js';
import { initDB, saveBooks, saveLibraryItems, saveNotes, saveChapters, saveActivities, saveFavoriteRelations, loadBooks, loadLibraryItems, loadNotes, loadChapters, loadActivities, loadFavoriteRelations, clearAllData } from './db.js';

let state = null;
let apiConfig = null;
let dbInitialized = false;

const defaultState = () => ({
  activeBookId: null,
  books: [],
  libraryItems: [],
  notes: [],
  chapters: [],
  activities: [],
  favoriteRelations: [],
  highlightedReferences: [],
  characters: [],
  worldbuilding: [],
});

const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaultState(), ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage:', e);
  }
  return defaultState();
};

const normalizeApiConfig = () => ({
  endpoint: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1024,
});

export const loadApiConfig = () => {
  try {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    if (saved) {
      return { ...normalizeApiConfig(), ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load API config:', e);
  }
  return normalizeApiConfig();
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
    const dbFavoriteRelations = await loadFavoriteRelations();
    
    if (dbBooks.length > 0 || dbItems.length > 0) {
      state = {
        activeBookId: dbBooks[0]?.id || null,
        books: dbBooks,
        libraryItems: dbItems,
        notes: dbNotes,
        chapters: dbChapters,
        activities: dbActivities,
        favoriteRelations: dbFavoriteRelations,
        highlightedReferences: [],
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
  persist();
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
      saveActivities(state.activities),
      saveFavoriteRelations(state.favoriteRelations || [])
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
  const bookId = activeBookId();
  return state.books.find((book) => book.id === bookId);
};

export const activeBookId = () => state.activeBookId;

export const addActivity = (text) => {
  state.activities.unshift({
    id: uid('act'),
    text,
    createdAt: nowIso(),
  });
  if (state.activities.length > 100) {
    state.activities.pop();
  }
  persist();
};

export const getModules = (bookId = activeBookId()) => {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return DEFAULT_MODULES;
  return book.modules || DEFAULT_MODULES;
};

export const getModuleName = (moduleId) => {
  const modules = getModules();
  const module = modules.find((m) => m.id === moduleId);
  return module ? module.name : moduleId;
};

export const getRelationTypes = (bookId = activeBookId()) => {
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return DEFAULT_RELATION_TYPES;
  return book.relationTypes || DEFAULT_RELATION_TYPES;
};

export const getRelationType = (typeId, bookId = activeBookId()) => {
  const types = getRelationTypes(bookId);
  return types.find((t) => t.id === typeId);
};

export const updateRelationType = (typeId, updates, bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  const type = book.relationTypes?.find((t) => t.id === typeId);
  if (type) {
    Object.assign(type, updates);
    persist();
  }
};

export const addRelationType = (bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  if (!book.relationTypes) {
    book.relationTypes = [];
  }
  const newType = {
    id: uid('rt'),
    name: '新关系',
    color: '#6b7280',
    bookId,
  };
  book.relationTypes.push(newType);
  persist();
  return newType;
};

export const isRelationTypeInUse = (typeId, bookId = activeBookId()) => {
  const state = getState();
  const items = state.libraryItems.filter(i => i.bookId === bookId);
  return items.some(item => {
    if (!item.relations) return false;
    return item.relations.some(r => r.typeId === typeId);
  });
};

export const removeRelationType = (typeId, bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  if (!book.relationTypes) return;
  
  const index = book.relationTypes.findIndex((t) => t.id === typeId);
  if (index >= 0) {
    book.relationTypes.splice(index, 1);
    persist();
  }
};

export const removeUnusedRelationTypes = (bookId = activeBookId()) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book || !book.relationTypes) return;
  
  book.relationTypes = book.relationTypes.filter(t => {
    return !isRelationTypeInUse(t.id, bookId);
  });
  persist();
};

export const toggleLibraryItemFavorite = (itemId) => {
  const state = getState();
  const item = state.libraryItems.find(i => i.id === itemId);
  if (!item) return;
  item.isFavorite = !item.isFavorite;
  persist();
};

export const getFavoriteLibraryItems = (bookId = activeBookId()) => {
  const state = getState();
  let items = state.libraryItems.filter(i => i.isFavorite);
  if (bookId) {
    items = items.filter(i => i.bookId === bookId);
  }
  return items;
};

export const toggleRelationFavorite = (itemId) => {
  const state = getState();
  const bookId = activeBookId();
  
  if (!state.favoriteRelations) {
    state.favoriteRelations = [];
  }
  
  const existingIndex = state.favoriteRelations.findIndex(
    f => f.itemId === itemId && f.bookId === bookId
  );
  
  if (existingIndex >= 0) {
    state.favoriteRelations.splice(existingIndex, 1);
    persist();
    return false;
  } else {
    const item = state.libraryItems.find(i => i.id === itemId);
    if (!item) return false;
    
    state.favoriteRelations.push({
      id: uid("fav"),
      itemId,
      bookId,
      title: item.title,
      createdAt: nowIso()
    });
    persist();
    return true;
  }
};

export const getFavoriteRelations = (bookId = activeBookId()) => {
  const state = getState();
  if (!state.favoriteRelations) return [];
  if (!bookId) return state.favoriteRelations;
  return state.favoriteRelations.filter(f => f.bookId === bookId);
};

export const isRelationFavorite = (itemId) => {
  const state = getState();
  const bookId = activeBookId();
  if (!state.favoriteRelations) return false;
  return state.favoriteRelations.some(
    f => f.itemId === itemId && f.bookId === bookId
  );
};

// 参考词条高亮相关
export const toggleReferenceHighlight = (itemId) => {
  const state = getState();
  if (!state.highlightedReferences) {
    state.highlightedReferences = [];
  }
  
  const index = state.highlightedReferences.indexOf(itemId);
  if (index >= 0) {
    state.highlightedReferences.splice(index, 1);
  } else {
    state.highlightedReferences.push(itemId);
  }
  persist();
};

export const isReferenceHighlighted = (itemId) => {
  const state = getState();
  if (!state.highlightedReferences) return false;
  return state.highlightedReferences.includes(itemId);
};

export const getHighlightedReferences = () => {
  const state = getState();
  return state.highlightedReferences || [];
};