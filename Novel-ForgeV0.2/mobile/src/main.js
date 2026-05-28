/**
 * 移动端入口:
 *   - initState 后渲染首页
 *   - 绑定 tab / topbar / 抽屉 / sheet / confirm / 全局 data-action 委托
 */

import { mDom } from './dom.js';
import {
  initState, getState, persist, activeBook, activeBookId,
  getModuleName, addActivity, toggleLibraryItemFavorite
} from '../../src/state.js';
import { classifyNote, classifyWithApi, getFriendlyApiError, setAddLog } from '../../src/api.js';
import { uid, nowIso } from '../../src/utils.js';
import { addLog, setLogFilter } from './logs.js';
import {
  render, switchView, getCurrentView, showToast,
  openDrawer, closeDrawer, toggleDrawer, isDrawerOpen,
  openSheet, closeSheet, isSheetOpen, triggerSheetAction,
  openConfirm, closeConfirm,
  openNoteSheet, openLibraryItemSheet, openLibraryItemForm,
  openChapterListSheet, openReferencesSheet, createChapterAndSelect, autoSaveChapter,
  openBookDetailSheet, openBookForm,
  openApiForm, exportData, importData, openLogsSheet,
  setSelectedChapter, setSelectedModule, toggleFavoritesOnlyMobile, renderDrawerBookList
} from './render.js';

const TAB_VIEWS = new Set(['workspace', 'writing', 'inbox', 'library', 'more']);

/* ---------- 业务动作(灵感 / 章节 / 删除等) ---------- */

function createIdea({ review = false } = {}) {
  const titleEl = document.getElementById('mIdeaTitle');
  const contentEl = document.getElementById('mIdeaContent');
  const content = contentEl?.value.trim() || '';
  if (!content) { showToast('先写一点灵感内容。'); return; }
  const title = titleEl?.value.trim() || '未命名灵感';
  const state = getState();
  const note = {
    id: uid('note'),
    bookId: activeBookId(),
    title,
    content,
    status: 'inbox',
    aiStatus: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    suggestion: null
  };
  state.notes.unshift(note);
  addActivity(`捕捉灵感:${title}`);
  if (titleEl) titleEl.value = '';
  if (contentEl) contentEl.value = '';
  persist();
  render();
  if (review) reviewNote(note.id);
  else showToast('已保存到灵感收件箱。');
}

async function reviewNote(noteId) {
  const state = getState();
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return;
  note.status = 'processing';
  note.aiStatus = 'processing';
  note.updatedAt = nowIso();
  persist();
  render();
  try {
    note.suggestion = await classifyNote(note);
    note.status = 'suggested';
    note.aiStatus = 'done';
    addActivity(`AI 审阅灵感:${note.title}`);
    persist();
    render();
    showToast('AI 审阅完成。');
  } catch (e) {
    note.status = 'inbox';
    note.aiStatus = 'pending';
    persist();
    render();
    showToast('审阅失败:' + getFriendlyApiError(e));
  }
}

async function reviewAllNotes() {
  const state = getState();
  const targets = state.notes.filter((n) => n.status === 'inbox');
  if (!targets.length) { showToast('没有新的灵感需要审阅。'); return; }
  showToast(`开始审阅 ${targets.length} 条灵感。`);
  for (const note of targets) {
    note.status = 'processing';
    note.aiStatus = 'processing';
    note.updatedAt = nowIso();
    persist();
    render();
    try {
      note.suggestion = await classifyNote(note);
      note.status = 'suggested';
      note.aiStatus = 'done';
    } catch (e) {
      note.status = 'inbox';
      note.aiStatus = 'pending';
    }
    persist();
    render();
  }
  addActivity(`批量审阅 ${targets.length} 条灵感`);
  persist();
  render();
  showToast('批量审阅完成。');
}

function acceptSuggestion(noteId) {
  const state = getState();
  const note = state.notes.find((n) => n.id === noteId);
  if (!note?.suggestion) return;
  const s = note.suggestion;
  const item = {
    id: uid('item'),
    bookId: s.bookId || note.bookId,
    module: s.module,
    title: s.title,
    content: s.summary || note.content,
    tags: s.tags || [],
    aiConfidence: s.confidence || 0.7,
    sourceNoteId: note.id,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.libraryItems.unshift(item);
  note.status = 'archived';
  note.updatedAt = nowIso();
  setSelectedModule(s.module);
  addActivity(`归档到${getModuleName(s.module)}:${item.title}`);
  persist();
  render();
  closeSheet();
  showToast('已归档到设定资料库。');
}

function dismissSuggestion(noteId) {
  const state = getState();
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return;
  note.status = 'inbox';
  note.suggestion = null;
  note.updatedAt = nowIso();
  persist();
  render();
  showToast('已退回收件箱。');
}

function archiveNote(noteId) {
  const state = getState();
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return;
  note.status = 'archived';
  note.updatedAt = nowIso();
  persist();
  render();
  closeSheet();
  showToast('已隐藏。');
}

function deleteNote(noteId) {
  openConfirm({
    title: '删除灵感',
    message: '该灵感及其 AI 建议将被永久删除,无法恢复。',
    danger: true,
    onOk: () => {
      const state = getState();
      state.notes = state.notes.filter((n) => n.id !== noteId);
      persist();
      render();
      closeSheet();
      showToast('已删除。');
    }
  });
}

function rollbackLibraryItem(itemId) {
  const state = getState();
  const item = state.libraryItems.find((i) => i.id === itemId);
  if (!item) return;
  state.notes.unshift({
    id: uid('note'),
    bookId: item.bookId,
    title: item.title,
    content: item.content,
    status: 'inbox',
    aiStatus: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    suggestion: null
  });
  state.libraryItems = state.libraryItems.filter((i) => i.id !== itemId);
  addActivity(`回退资料到收件箱:${item.title}`);
  persist();
  render();
  closeSheet();
  showToast('已回退到收件箱。');
}

function deleteLibraryItem(itemId) {
  openConfirm({
    title: '删除资料',
    message: '该条资料将被永久删除。',
    danger: true,
    onOk: () => {
      const state = getState();
      const item = state.libraryItems.find((i) => i.id === itemId);
      state.libraryItems = state.libraryItems.filter((i) => i.id !== itemId);
      addActivity(`删除资料:${item?.title || '未命名'}`);
      persist();
      render();
      closeSheet();
      showToast('已删除。');
    }
  });
}

function selectBook(bookId) {
  const state = getState();
  state.activeBookId = bookId;
  const firstChapter = state.chapters.find((c) => c.bookId === bookId);
  setSelectedChapter(firstChapter?.id || null);
  persist();
  closeSheet();
  closeDrawer();
  render();
  showToast('已切换当前作品。');
}

function deleteBook(bookId) {
  const state = getState();
  if (state.books.length <= 1) { showToast('至少保留一个作品。'); return; }
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  openConfirm({
    title: '删除作品',
    message: `《${book.title}》及其所有灵感、设定、章节都将被删除。无法恢复。`,
    danger: true,
    onOk: () => {
      state.books = state.books.filter((b) => b.id !== bookId);
      state.notes = state.notes.filter((n) => n.bookId !== bookId);
      state.libraryItems = state.libraryItems.filter((i) => i.bookId !== bookId);
      state.chapters = state.chapters.filter((c) => c.bookId !== bookId);
      if (state.activeBookId === bookId) {
        state.activeBookId = state.books[0]?.id || null;
        setSelectedChapter(state.chapters.find((c) => c.bookId === state.activeBookId)?.id || null);
      }
      addActivity(`删除作品《${book.title}》`);
      persist();
      render();
      closeSheet();
      showToast('作品已删除。');
    }
  });
}

function pickBookColor(bookId, color) {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  book.coverColor = color;
  book.updatedAt = nowIso();
  persist();
  // 仅更新当前 sheet 中的色块状态,以及详情卡的封面
  document.querySelectorAll('.m-color-swatch[data-action="pick-book-color"]').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === color);
  });
  render();
}

function deleteChapter(chapterId) {
  openConfirm({
    title: '删除章节',
    message: '本章正文将被删除,无法恢复。',
    danger: true,
    onOk: () => {
      const state = getState();
      const ch = state.chapters.find((c) => c.id === chapterId);
      state.chapters = state.chapters.filter((c) => c.id !== chapterId);
      if (ch) addActivity(`删除章节:${ch.title}`);
      // 选下一个章节
      const next = state.chapters.find((c) => c.bookId === activeBookId());
      setSelectedChapter(next?.id || null);
      persist();
      render();
      showToast('已删除。');
    }
  });
}

async function testApi() {
  try {
    await classifyWithApi({ title: '测试灵感', content: '主角获得一个需要付出代价的系统能力。' });
    showToast('连接成功。');
  } catch (e) {
    showToast('连接失败:' + getFriendlyApiError(e));
  }
}

/* ---------- 事件绑定 ---------- */

function bindTabBar() {
  mDom.tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
}

function bindTopbar() {
  mDom.leftAction?.addEventListener('click', () => toggleDrawer());
  mDom.rightAction?.addEventListener('click', () => {
    // 上下文动作:工作台 + 收件箱 → 新建灵感(滚到顶);写作 → 章节列表;资料库 → 新增资料;书库 → 新建作品
    const view = getCurrentView();
    if (view === 'workspace' || view === 'inbox') {
      switchView('workspace');
      setTimeout(() => document.getElementById('mIdeaContent')?.focus(), 50);
    } else if (view === 'writing') {
      openChapterListSheet();
    } else if (view === 'library') {
      openLibraryItemForm();
    } else if (view === 'books') {
      openBookForm();
    } else {
      showToast('当前页暂无快捷操作。');
    }
  });
}

function bindDrawer() {
  mDom.drawerClose?.addEventListener('click', closeDrawer);
  mDom.drawerBackdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isSheetOpen()) { closeSheet(); return; }
    if (isDrawerOpen()) { closeDrawer(); return; }
    if (mDom.confirmBackdrop?.classList.contains('show')) { closeConfirm('cancel'); }
  });

  // 抽屉内导航
  mDom.drawerItems?.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view === 'books' || view === 'relation') {
        if (view === 'relation') { showToast('关系图谱(移动端)即将上线。'); }
        else { switchView('books'); }
      } else if (TAB_VIEWS.has(view)) {
        switchView(view);
      }
      closeDrawer();
    });
  });

  // 抽屉新建作品
  mDom.drawerNewBook?.addEventListener('click', () => {
    closeDrawer();
    openBookForm();
  });

  // 抽屉底部 4 个动作:AI 接口 / 导出 / 导入 / 设置
  mDom.drawerFooterBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      closeDrawer();
      if (target === 'api') openApiForm();
      else if (target === 'export') exportData();
      else if (target === 'import') mDom.importFile?.click();
      else if (target === 'settings') openLogsSheet();
      else showToast(`「${btn.textContent.trim()}」· 未实装`);
    });
  });
}

function bindSheet() {
  mDom.sheetClose?.addEventListener('click', closeSheet);
  mDom.sheetBackdrop?.addEventListener('click', closeSheet);
  mDom.sheetAction?.addEventListener('click', () => triggerSheetAction());
}

function bindConfirm() {
  mDom.confirmCancel?.addEventListener('click', () => closeConfirm('cancel'));
  mDom.confirmOk?.addEventListener('click', () => closeConfirm('ok'));
  mDom.confirmBackdrop?.addEventListener('click', (e) => {
    if (e.target === mDom.confirmBackdrop) closeConfirm('cancel');
  });
}

function bindImportFile() {
  mDom.importFile?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });
}

function bindChapterEditor() {
  // 用事件冒泡监听 contenteditable + 标题
  document.addEventListener('input', (e) => {
    if (e.target.id === 'mChapterBody' || e.target.id === 'mChapterTitle') {
      autoSaveChapter();
    }
  });
  // 阻止 contenteditable 默认的 div 包行,统一插入 <br>
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'mChapterBody' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });
}

function bindActionDelegate() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const { action, id } = target.dataset;

    // data-stop=1 表示这个内嵌按钮要阻止外层卡片的点击
    if (target.dataset.stop === '1') e.stopPropagation();

    switch (action) {
      // 工作台
      case 'save-idea':         createIdea({ review: false }); break;
      case 'save-and-review':   createIdea({ review: true }); break;
      case 'review-all':        reviewAllNotes(); break;

      // 灵感
      case 'open-note':         openNoteSheet(id); break;
      case 'accept-suggestion': acceptSuggestion(id); break;
      case 'dismiss-suggestion':dismissSuggestion(id); break;
      case 'rerun-review':      reviewNote(id); break;
      case 'archive-note':      archiveNote(id); break;
      case 'delete-note':       deleteNote(id); break;

      // 资料库
      case 'select-module':           setSelectedModule(id); render(); break;
      case 'toggle-favorites':        toggleFavoritesOnlyMobile(); render(); break;
      case 'open-library-item':       openLibraryItemSheet(id); break;
      case 'open-library-form':       openLibraryItemForm(); break;
      case 'toggle-library-favorite': toggleLibraryItemFavorite(id); render(); break;
      case 'rollback-library-item':   rollbackLibraryItem(id); break;
      case 'delete-library-item':     deleteLibraryItem(id); break;

      // 写作
      case 'open-chapter-list': openChapterListSheet(); break;
      case 'open-references':   openReferencesSheet(); break;
      case 'new-chapter':       createChapterAndSelect(); break;
      case 'select-chapter':    setSelectedChapter(id); closeSheet(); render(); break;
      case 'delete-chapter':    deleteChapter(id); break;

      // 书库
      case 'goto-books':       switchView('books'); break;
      case 'open-book-form':   openBookForm(); break;
      case 'open-book-detail': openBookDetailSheet(id); break;
      case 'select-book':      selectBook(id); break;
      case 'delete-book':      deleteBook(id); break;
      case 'pick-book-color':  pickBookColor(id, target.dataset.color); break;

      // 更多
      case 'open-api-form':   openApiForm(); break;
      case 'export-data':     exportData(); break;
      case 'trigger-import':  mDom.importFile?.click(); break;
      case 'open-logs':       openLogsSheet(); break;
      case 'test-api':        testApi(); break;
      case 'set-log-filter':  setLogFilter(id); openLogsSheet(); break;
    }
  });
}

/* ---------- 启动 ---------- */

async function boot() {
  setAddLog(addLog);
  try {
    await initState();
  } catch (e) {
    console.warn('initState failed', e);
    showToast('数据初始化失败,部分功能可能不可用。');
  }

  bindTabBar();
  bindTopbar();
  bindDrawer();
  bindSheet();
  bindConfirm();
  bindImportFile();
  bindChapterEditor();
  bindActionDelegate();

  // 默认章节
  const state = getState();
  const firstChapter = state.chapters?.find((c) => c.bookId === activeBookId());
  if (firstChapter) setSelectedChapter(firstChapter.id);

  switchView('workspace');
  renderDrawerBookList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
