/**
 * 移动端渲染层。
 *
 * 内容:
 *   - showToast / switchView / 抽屉开关
 *   - sheet 系统(openSheet / closeSheet)
 *   - confirm 系统(openConfirm)
 *   - 各 view 渲染器(workspace / inbox / library / writing / more / books)
 *   - 表单 sheet(book / library item / api / settings / logs / import-export)
 */

import { mDom } from './dom.js';
import {
  getState, getApiConfig, setApiConfig, persist, persistApiConfig,
  activeBook, activeBookId, getModules, getModuleName, addActivity,
  toggleLibraryItemFavorite, getFavoriteLibraryItems
} from '../../src/state.js';
import {
  BOOK_COVER_COLORS, DEFAULT_MODULES, BOOK_STATUS_MAP,
  DEFAULT_API_ENDPOINT, DEFAULT_API_MODEL, DEFAULT_PROMPT
} from '../../src/constants.js';
import { uid, nowIso, wordCount, escapeHtml, formatDate } from '../../src/utils.js';
import { classifyNote, getFriendlyApiError } from '../../src/api.js';
import { getLogs, clearLogs, getLogFilter, setLogFilter } from './logs.js';

/* ============================================================ *
 * 0. 视图切换 + Toast + 抽屉
 * ============================================================ */

const VIEW_TITLES = {
  workspace: '工作台',
  writing:   '正文写作',
  inbox:     '灵感收件箱',
  library:   '设定资料库',
  more:      '更多',
  books:     '书库'
};

let currentView = 'workspace';
export const getCurrentView = () => currentView;

let selectedModuleId = 'characters';
let selectedChapterId = null;
let favoritesOnly = false;
let chapterSaveTimer = null;

export function switchView(view) {
  if (!VIEW_TITLES[view]) return;
  currentView = view;
  mDom.pageTitle.textContent = VIEW_TITLES[view];
  mDom.tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  mDom.views.forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  mDom.drawerItems?.forEach((it) => it.classList.toggle('active', it.dataset.view === view));
  if (mDom.main) mDom.main.scrollTop = 0;
  render();
}

let toastTimer = null;
export function showToast(message, durationMs = 2200) {
  if (!mDom.toast) return;
  mDom.toast.textContent = message;
  mDom.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => mDom.toast.classList.remove('show'), durationMs);
}

export function openDrawer() {
  if (!mDom.drawer) return;
  mDom.drawer.classList.add('open');
  mDom.drawer.setAttribute('aria-hidden', 'false');
  mDom.drawerBackdrop?.classList.add('show');
  mDom.drawerBackdrop?.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  renderDrawerBookList();
}

export function closeDrawer() {
  if (!mDom.drawer) return;
  mDom.drawer.classList.remove('open');
  mDom.drawer.setAttribute('aria-hidden', 'true');
  mDom.drawerBackdrop?.classList.remove('show');
  mDom.drawerBackdrop?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export const toggleDrawer = () => {
  if (mDom.drawer?.classList.contains('open')) closeDrawer();
  else openDrawer();
};
export const isDrawerOpen = () => !!mDom.drawer?.classList.contains('open');

/* ============================================================ *
 * 1. Sheet 系统(全屏滑出)
 * ============================================================ */

let sheetState = null; // { onAction, onClose }

export function openSheet({ title = '', body = '', footer = '', action = '', onAction = null, onClose = null }) {
  if (!mDom.sheet) return;
  mDom.sheetTitle.textContent = title;

  if (typeof body === 'string') {
    mDom.sheetBody.innerHTML = body;
  } else {
    mDom.sheetBody.innerHTML = '';
    mDom.sheetBody.appendChild(body);
  }

  if (footer) {
    mDom.sheetFooter.innerHTML = footer;
    mDom.sheetFooter.hidden = false;
  } else {
    mDom.sheetFooter.innerHTML = '';
    mDom.sheetFooter.hidden = true;
  }

  if (action) {
    mDom.sheetAction.textContent = action;
    mDom.sheetAction.hidden = false;
  } else {
    mDom.sheetAction.textContent = '';
    mDom.sheetAction.hidden = true;
  }

  sheetState = { onAction, onClose };
  mDom.sheet.classList.add('open');
  mDom.sheet.setAttribute('aria-hidden', 'false');
  mDom.sheetBackdrop.classList.add('show');
  mDom.sheetBackdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeSheet() {
  if (!mDom.sheet?.classList.contains('open')) return;
  const onClose = sheetState?.onClose;
  sheetState = null;
  mDom.sheet.classList.remove('open');
  mDom.sheet.setAttribute('aria-hidden', 'true');
  mDom.sheetBackdrop.classList.remove('show');
  mDom.sheetBackdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (typeof onClose === 'function') onClose();
}

export const isSheetOpen = () => !!mDom.sheet?.classList.contains('open');

// 暴露给 main.js 用,触发当前 sheet 的 action 按钮回调
export const triggerSheetAction = () => {
  if (typeof sheetState?.onAction === 'function') sheetState.onAction();
};

/* ============================================================ *
 * 2. Confirm
 * ============================================================ */

let confirmHandlers = null;
export function openConfirm({ title = '确认', message = '', okText = '确定', cancelText = '取消', danger = false, onOk = null, onCancel = null }) {
  if (!mDom.confirmBackdrop) return;
  mDom.confirmTitle.textContent = title;
  mDom.confirmMessage.textContent = message;
  mDom.confirmOk.textContent = okText;
  mDom.confirmCancel.textContent = cancelText;
  mDom.confirmOk.classList.toggle('m-btn-danger', !!danger);
  mDom.confirmOk.classList.toggle('m-btn-primary', !danger);
  confirmHandlers = { onOk, onCancel };
  mDom.confirmBackdrop.classList.add('show');
  mDom.confirmBackdrop.setAttribute('aria-hidden', 'false');
}

export function closeConfirm(via = 'cancel') {
  if (!mDom.confirmBackdrop?.classList.contains('show')) return;
  mDom.confirmBackdrop.classList.remove('show');
  mDom.confirmBackdrop.setAttribute('aria-hidden', 'true');
  const handlers = confirmHandlers;
  confirmHandlers = null;
  if (handlers) {
    if (via === 'ok' && typeof handlers.onOk === 'function') handlers.onOk();
    if (via === 'cancel' && typeof handlers.onCancel === 'function') handlers.onCancel();
  }
}

/* ============================================================ *
 * 3. 总渲染派发
 * ============================================================ */

export function render() {
  renderDrawerBookList();
  switch (currentView) {
    case 'workspace': renderWorkspace(); break;
    case 'inbox':     renderInbox(); break;
    case 'library':   renderLibrary(); break;
    case 'writing':   renderWriting(); break;
    case 'books':     renderBooksView(); break;
    case 'more':      /* more 是静态的列表;无需重渲 */ break;
  }
}

/* ============================================================ *
 * 4. 抽屉书目列表
 * ============================================================ */

export function renderDrawerBookList() {
  if (!mDom.drawerBookList) return;
  const state = getState();
  const books = state.books || [];
  if (!books.length) {
    mDom.drawerBookList.innerHTML = '<div class="m-drawer-book-empty">暂无作品</div>';
    return;
  }
  const activeId = activeBookId();
  mDom.drawerBookList.innerHTML = books.map((b) => `
    <button class="m-drawer-book-item ${b.id === activeId ? 'active' : ''}" data-action="select-book" data-id="${b.id}" type="button">
      ${bookCoverHtml(b, 'm-drawer-book-cover')}
      <div class="m-drawer-book-info">
        <div class="m-drawer-book-info-title">${escapeHtml(b.title || '未命名')}</div>
        <div class="m-drawer-book-info-meta">${escapeHtml(b.genre || '')} · ${BOOK_STATUS_MAP[b.status] || b.status || ''}</div>
      </div>
    </button>
  `).join('');
}

function bookCoverHtml(book, extraClass = 'm-book-cover') {
  if (book.coverImage) {
    return `<div class="${extraClass}" style="background-image:url('${book.coverImage}');"></div>`;
  }
  const color = book.coverColor || BOOK_COVER_COLORS[0];
  const letter = (book.title || '墨').slice(0, 1);
  return `<div class="${extraClass}" style="background:${color};">${escapeHtml(letter)}</div>`;
}

/* ============================================================ *
 * 5. 工作台
 * ============================================================ */

export function renderWorkspace() {
  const state = getState();
  const book = activeBook();
  const inboxNotes = (state.notes || []).filter((n) => n.status === 'inbox' || n.status === 'processing');
  const suggestNotes = (state.notes || []).filter((n) => n.status === 'suggested' && (!book || n.bookId === book.id));
  const totalWords = (state.chapters || [])
    .filter((c) => !book || c.bookId === book.id)
    .reduce((sum, c) => sum + wordCount(c.body || ''), 0);

  mDom.workspaceView.innerHTML = `
    <section class="m-section">
      <div class="m-section-head">
        <div>
          <span class="m-eyebrow">Current Book</span>
          <h2>${escapeHtml(book?.title || '尚未选择作品')}</h2>
        </div>
        <button class="m-section-action" data-action="open-book-form" type="button">新建作品</button>
      </div>
      ${book ? `<p class="m-helper-text">${escapeHtml(book.genre || '')}${book.genre ? ' · ' : ''}${BOOK_STATUS_MAP[book.status] || ''}</p>` : '<p class="m-helper-text">点击左上角 ≡ 打开抽屉,新建或选择一部作品。</p>'}
    </section>

    <section class="m-section">
      <div class="m-section-head"><div><span class="m-eyebrow">Quick Capture</span><h2>随手写入</h2></div></div>
      <div class="m-capture">
        <input id="mIdeaTitle" class="m-input" type="text" placeholder="给这条想法起个短标题" />
        <textarea id="mIdeaContent" class="m-textarea" placeholder="把灵感丢进来,例如:主角的金手指是把失败变成经验,代价是会遗忘一次温柔的记忆。"></textarea>
        <div class="m-btn-row">
          <button class="m-btn m-btn-secondary" data-action="save-idea" type="button">保存到收件箱</button>
          <button class="m-btn m-btn-primary" data-action="save-and-review" type="button">保存并 AI 审阅</button>
        </div>
        <p class="m-helper-text">支持 @书名 指定归属,例如:@长夜烬明 这个金手指的代价是失去一段记忆。</p>
      </div>
    </section>

    <section class="m-section">
      <div class="m-section-head"><div><span class="m-eyebrow">Stats</span><h2>速览</h2></div></div>
      <div class="m-stats-grid">
        <div class="m-stat"><span class="m-stat-label">作品</span><strong class="m-stat-value">${state.books.length}</strong></div>
        <div class="m-stat"><span class="m-stat-label">待整理</span><strong class="m-stat-value">${inboxNotes.length}</strong></div>
        <div class="m-stat"><span class="m-stat-label">资料条目</span><strong class="m-stat-value">${state.libraryItems.length}</strong></div>
        <div class="m-stat"><span class="m-stat-label">正文字数</span><strong class="m-stat-value">${totalWords}</strong></div>
      </div>
    </section>

    <section class="m-section">
      <div class="m-section-head">
        <div><span class="m-eyebrow">AI Review Queue</span><h2>待确认建议</h2></div>
        <button class="m-section-action" data-action="review-all" type="button">审阅全部</button>
      </div>
      ${suggestNotes.length === 0 ? '<p class="m-helper-text">还没有待确认的建议。</p>' : suggestNotes.map(renderSuggestionCard).join('')}
    </section>

    <section class="m-section">
      <div class="m-section-head"><div><span class="m-eyebrow">Recent</span><h2>最近活动</h2></div></div>
      ${(state.activities || []).slice(0, 12).map((a) => `
        <div class="m-activity-item">
          <span class="m-activity-time">${formatDate(a.createdAt)}</span>
          <span class="m-activity-text">${escapeHtml(a.text)}</span>
        </div>
      `).join('') || '<p class="m-helper-text">暂无活动。</p>'}
    </section>
  `;
}

function renderSuggestionCard(note) {
  const s = note.suggestion || {};
  const confidence = typeof s.confidence === 'number' ? `${Math.round(s.confidence * 100)}%` : '—';
  const tagsHtml = (s.tags || []).map((t) => `<span class="m-tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="m-suggestion">
      <div>
        <div class="m-card-title">${escapeHtml(s.title || note.title)}</div>
        <div class="m-suggestion-meta">
          <span class="m-pill m-pill-active">${escapeHtml(getModuleName(s.module) || s.module || '未知')}</span>
          <span class="m-suggestion-confidence">置信 ${confidence}</span>
        </div>
      </div>
      ${s.summary ? `<div class="m-card-body m-card-body-clip">${escapeHtml(s.summary)}</div>` : ''}
      ${tagsHtml ? `<div class="m-tag-row">${tagsHtml}</div>` : ''}
      ${s.reason ? `<div class="m-helper-text">理由:${escapeHtml(s.reason)}</div>` : ''}
      <div class="m-card-actions">
        <button class="m-btn m-btn-primary" data-action="accept-suggestion" data-id="${note.id}" type="button">归档</button>
        <button class="m-btn m-btn-ghost" data-action="dismiss-suggestion" data-id="${note.id}" type="button">退回</button>
        <button class="m-btn m-btn-ghost" data-action="rerun-review" data-id="${note.id}" type="button">重审</button>
      </div>
    </div>
  `;
}

/* ============================================================ *
 * 6. 收件箱
 * ============================================================ */

export function renderInbox() {
  const state = getState();
  const book = activeBook();
  const notes = (state.notes || [])
    .filter((n) => !book || n.bookId === book.id)
    .filter((n) => n.status !== 'archived');

  if (!notes.length) {
    mDom.inboxView.innerHTML = `
      <section class="m-section">
        <div class="m-section-head"><div><span class="m-eyebrow">Inbox</span><h2>灵感收件箱</h2></div></div>
        <p class="m-helper-text">还没有灵感。回到工作台写入第一条吧。</p>
      </section>
    `;
    return;
  }

  mDom.inboxView.innerHTML = `
    <section class="m-section">
      <div class="m-section-head">
        <div><span class="m-eyebrow">Inbox</span><h2>灵感收件箱(${notes.length})</h2></div>
        <button class="m-section-action" data-action="review-all" type="button">批量审阅</button>
      </div>
      ${notes.map(renderNoteItem).join('')}
    </section>
  `;
}

function renderNoteItem(note) {
  return `
    <div class="m-note-item" data-action="open-note" data-id="${note.id}">
      <div class="m-note-head">
        <span class="m-note-title">${escapeHtml(note.title || '未命名灵感')}</span>
        <span class="m-note-status ${note.status}">${noteStatusLabel(note.status)}</span>
      </div>
      <div class="m-note-snippet">${escapeHtml(note.content || '')}</div>
      <div class="m-card-meta">
        <span>${formatDate(note.updatedAt || note.createdAt)}</span>
      </div>
    </div>
  `;
}

function noteStatusLabel(status) {
  return { inbox: '待审', processing: '审阅中', suggested: '已建议', archived: '已归档' }[status] || status;
}

export function openNoteSheet(noteId) {
  const state = getState();
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return;
  const isProcessing = note.status === 'processing';
  const hasSuggestion = note.status === 'suggested' && note.suggestion;
  const s = note.suggestion || {};

  const bookOpts = state.books.map((b) =>
    `<option value="${b.id}" ${b.id === (s.bookId || note.bookId) ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
  ).join('');
  const moduleOpts = getModules(note.bookId).map((m) =>
    `<option value="${m.id}" ${m.id === s.module ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
  ).join('');

  const body = `
    <div class="m-field">
      <label class="m-field-label">标题</label>
      <input id="mNoteTitle" class="m-input" type="text" value="${escapeHtml(note.title)}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">内容</label>
      <textarea id="mNoteContent" class="m-textarea" rows="6">${escapeHtml(note.content)}</textarea>
    </div>
    ${hasSuggestion ? `
      <div class="m-field">
        <label class="m-field-label">归属作品</label>
        <select id="mNoteBook" class="m-select">${bookOpts}</select>
      </div>
      <div class="m-field">
        <label class="m-field-label">归类模块</label>
        <select id="mNoteModule" class="m-select">${moduleOpts}</select>
      </div>
      <div class="m-field">
        <label class="m-field-label">标签(逗号分隔)</label>
        <input id="mNoteTags" class="m-input" type="text" value="${escapeHtml((s.tags || []).join(', '))}" />
      </div>
      ${s.reason ? `<p class="m-helper-text">AI 理由:${escapeHtml(s.reason)}</p>` : ''}
    ` : ''}
    <div class="m-card-actions" style="margin-top:16px">
      ${hasSuggestion
        ? `<button class="m-btn m-btn-primary" data-action="accept-suggestion" data-id="${note.id}" type="button">采纳建议并归档</button>`
        : `<button class="m-btn m-btn-primary" data-action="rerun-review" data-id="${note.id}" type="button">${isProcessing ? '审阅中...' : 'AI 审阅'}</button>`
      }
      <button class="m-btn m-btn-ghost" data-action="archive-note" data-id="${note.id}" type="button">隐藏</button>
      <button class="m-btn m-btn-ghost m-btn-danger" data-action="delete-note" data-id="${note.id}" type="button" style="color:var(--paper-2)">删除</button>
    </div>
  `;

  openSheet({
    title: '灵感详情',
    body,
    action: '保存',
    onAction: () => {
      const newTitle = document.getElementById('mNoteTitle')?.value.trim() || '未命名';
      const newContent = document.getElementById('mNoteContent')?.value.trim() || '';
      note.title = newTitle;
      note.content = newContent;
      if (hasSuggestion) {
        note.suggestion.bookId = document.getElementById('mNoteBook')?.value || note.bookId;
        note.suggestion.module = document.getElementById('mNoteModule')?.value || s.module;
        note.suggestion.tags = (document.getElementById('mNoteTags')?.value || '')
          .split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      }
      note.updatedAt = nowIso();
      persist();
      render();
      closeSheet();
      showToast('已保存修改。');
    }
  });
}

/* ============================================================ *
 * 7. 资料库
 * ============================================================ */

export function renderLibrary() {
  const state = getState();
  const book = activeBook();
  if (!book) {
    mDom.libraryView.innerHTML = `<section class="m-section"><p class="m-helper-text">请先在抽屉里选择一部作品。</p></section>`;
    return;
  }
  const modules = getModules(book.id);
  if (!modules.find((m) => m.id === selectedModuleId)) selectedModuleId = modules[0]?.id || 'characters';
  let items = state.libraryItems.filter((i) => i.bookId === book.id && i.module === selectedModuleId);
  if (favoritesOnly) items = items.filter((i) => i.isFavorite);

  const tabsHtml = modules.map((m) => {
    const count = state.libraryItems.filter((i) => i.bookId === book.id && i.module === m.id).length;
    return `<button class="m-module-tab ${m.id === selectedModuleId ? 'active' : ''}" data-action="select-module" data-id="${m.id}" type="button">${escapeHtml(m.name)} · ${count}</button>`;
  }).join('');

  mDom.libraryView.innerHTML = `
    <div class="m-module-tabs">${tabsHtml}</div>
    <div class="m-favorite-toggle">
      <button class="m-pill ${favoritesOnly ? 'm-pill-active' : ''}" data-action="toggle-favorites" type="button">${favoritesOnly ? '★ 只看收藏' : '☆ 只看收藏'}</button>
    </div>
    <div class="m-section-head">
      <div><span class="m-eyebrow">${escapeHtml(book.title)}</span><h2>${escapeHtml(modules.find((m) => m.id === selectedModuleId)?.name || '')}</h2></div>
      <button class="m-section-action" data-action="open-library-form" type="button">+ 新增</button>
    </div>
    ${items.length === 0 ? '<p class="m-helper-text">该模块下还没有资料。</p>' : items.map(renderLibraryItem).join('')}
  `;
}

function renderLibraryItem(item) {
  return `
    <div class="m-card" data-action="open-library-item" data-id="${item.id}">
      <div class="m-note-head">
        <span class="m-card-title">${escapeHtml(item.title || '未命名')}</span>
        <span class="m-section-action" data-action="toggle-library-favorite" data-id="${item.id}" data-stop="1">${item.isFavorite ? '★' : '☆'}</span>
      </div>
      <div class="m-card-body m-card-body-clip">${escapeHtml(item.content || '')}</div>
      ${(item.tags && item.tags.length) ? `<div class="m-tag-row">${item.tags.map((t) => `<span class="m-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    </div>
  `;
}

export function openLibraryItemSheet(itemId) {
  const state = getState();
  const item = state.libraryItems.find((i) => i.id === itemId);
  if (!item) return;
  const body = `
    <div class="m-field">
      <label class="m-field-label">标题</label>
      <input id="mLibTitle" class="m-input" type="text" value="${escapeHtml(item.title)}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">内容</label>
      <textarea id="mLibContent" class="m-textarea" rows="8">${escapeHtml(item.content)}</textarea>
    </div>
    <div class="m-field">
      <label class="m-field-label">标签(逗号分隔)</label>
      <input id="mLibTags" class="m-input" type="text" value="${escapeHtml((item.tags || []).join(', '))}" />
    </div>
    <div class="m-card-actions" style="margin-top:16px">
      <button class="m-btn m-btn-ghost" data-action="rollback-library-item" data-id="${item.id}" type="button">回退到收件箱</button>
      <button class="m-btn m-btn-danger" data-action="delete-library-item" data-id="${item.id}" type="button">删除</button>
    </div>
  `;
  openSheet({
    title: '编辑资料',
    body,
    action: '保存',
    onAction: () => {
      item.title = document.getElementById('mLibTitle')?.value.trim() || '未命名';
      item.content = document.getElementById('mLibContent')?.value.trim() || '';
      item.tags = (document.getElementById('mLibTags')?.value || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      item.updatedAt = nowIso();
      persist();
      render();
      closeSheet();
      showToast('已保存。');
    }
  });
}

export function openLibraryItemForm() {
  const book = activeBook();
  if (!book) { showToast('请先选择作品。'); return; }
  const modules = getModules(book.id);
  const moduleOpts = modules.map((m) => `<option value="${m.id}" ${m.id === selectedModuleId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('');
  const body = `
    <div class="m-field">
      <label class="m-field-label">归类模块</label>
      <select id="mNewLibModule" class="m-select">${moduleOpts}</select>
    </div>
    <div class="m-field">
      <label class="m-field-label">标题</label>
      <input id="mNewLibTitle" class="m-input" type="text" placeholder="资料标题" />
    </div>
    <div class="m-field">
      <label class="m-field-label">内容</label>
      <textarea id="mNewLibContent" class="m-textarea" rows="8" placeholder="设定详情"></textarea>
    </div>
    <div class="m-field">
      <label class="m-field-label">标签(逗号分隔)</label>
      <input id="mNewLibTags" class="m-input" type="text" placeholder="例如:主角, 能力" />
    </div>
  `;
  openSheet({
    title: '新增资料',
    body,
    action: '保存',
    onAction: () => {
      const title = document.getElementById('mNewLibTitle')?.value.trim();
      const content = document.getElementById('mNewLibContent')?.value.trim();
      if (!title || !content) { showToast('请填写标题和内容。'); return; }
      const moduleId = document.getElementById('mNewLibModule')?.value || selectedModuleId;
      const state = getState();
      state.libraryItems.unshift({
        id: uid('item'),
        bookId: book.id,
        module: moduleId,
        title,
        content,
        tags: (document.getElementById('mNewLibTags')?.value || '').split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        sourceNoteId: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      addActivity(`手动新增${getModuleName(moduleId)}:${title}`);
      persist();
      selectedModuleId = moduleId;
      render();
      closeSheet();
      showToast('已加入资料库。');
    }
  });
}

/* ============================================================ *
 * 8. 正文写作
 * ============================================================ */

export function renderWriting() {
  const state = getState();
  const book = activeBook();
  if (!book) {
    mDom.writingView.innerHTML = `<section class="m-section"><p class="m-helper-text">请先在抽屉里选择一部作品。</p></section>`;
    return;
  }
  const chapters = state.chapters.filter((c) => c.bookId === book.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (chapters.length && !chapters.find((c) => c.id === selectedChapterId)) {
    selectedChapterId = chapters[0].id;
  }
  const chapter = chapters.find((c) => c.id === selectedChapterId);
  const refItems = state.libraryItems.filter((i) => i.bookId === book.id).slice(0, 30);

  mDom.writingView.innerHTML = `
    <div class="m-writing-shell">
      <div class="m-chapter-bar">
        <button class="m-chapter-pick" data-action="open-chapter-list" type="button">${chapter ? escapeHtml(chapter.title || '未命名章节') : '尚无章节'}</button>
        <button class="m-btn m-btn-secondary" data-action="new-chapter" type="button">+</button>
        <button class="m-btn m-btn-ghost" data-action="open-references" type="button">📚</button>
      </div>

      ${chapter ? `
        <input id="mChapterTitle" class="m-chapter-title-input" type="text" value="${escapeHtml(chapter.title || '')}" placeholder="章节标题" />
        <div id="mChapterBody" class="m-editor" contenteditable="true" data-placeholder="开始写正文。点击 📚 查看相关设定。"></div>
        <div class="m-editor-footer">
          <span id="mChapterWords">${wordCount(chapter.body || '')} 字</span>
          <span id="mSaveState">已自动保存</span>
        </div>
        <button class="m-btn m-btn-ghost m-btn-block" data-action="delete-chapter" data-id="${chapter.id}" type="button">删除本章</button>
      ` : `
        <p class="m-helper-text">还没有章节,点击 + 新建。</p>
      `}
    </div>
  `;
  if (chapter) {
    const editor = document.getElementById('mChapterBody');
    if (editor) editor.textContent = chapter.body || '';
  }
}

export function openChapterListSheet() {
  const state = getState();
  const book = activeBook();
  if (!book) return;
  const chapters = state.chapters.filter((c) => c.bookId === book.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  const body = chapters.length === 0
    ? '<p class="m-helper-text">还没有章节。</p>'
    : chapters.map((c) => `
        <div class="m-chapter-list-row ${c.id === selectedChapterId ? 'active' : ''}" data-action="select-chapter" data-id="${c.id}">
          <span class="m-chapter-list-row-title">${escapeHtml(c.title || '未命名')}</span>
          <span class="m-chapter-list-row-words">${wordCount(c.body || '')} 字</span>
        </div>
      `).join('');
  openSheet({
    title: '章节列表',
    body: `${body}<button class="m-btn m-btn-primary m-btn-block" data-action="new-chapter" type="button" style="margin-top:16px">+ 新建章节</button>`,
    action: ''
  });
}

export function openReferencesSheet() {
  const state = getState();
  const book = activeBook();
  if (!book) return;
  const refs = state.libraryItems.filter((i) => i.bookId === book.id);
  const body = refs.length === 0
    ? '<p class="m-helper-text">该作品还没有设定资料。</p>'
    : `<div class="m-ref-list">${refs.map((r) => `
        <div class="m-ref-item">
          <span class="m-ref-item-title">${escapeHtml(r.title)}</span>
          <span class="m-ref-item-meta">${escapeHtml(getModuleName(r.module))}</span>
          <div class="m-card-body m-card-body-clip">${escapeHtml(r.content || '')}</div>
        </div>
      `).join('')}</div>`;
  openSheet({ title: '相关设定', body });
}

export function createChapterAndSelect() {
  const state = getState();
  const book = activeBook();
  if (!book) { showToast('请先选择作品。'); return; }
  const chapters = state.chapters.filter((c) => c.bookId === book.id);
  const chapter = {
    id: uid('chapter'),
    bookId: book.id,
    title: `第 ${chapters.length + 1} 章`,
    body: '',
    order: chapters.length + 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.chapters.push(chapter);
  selectedChapterId = chapter.id;
  addActivity(`新建章节:${chapter.title}`);
  persist();
  render();
  closeSheet();
  showToast('章节已创建。');
}

export function autoSaveChapter() {
  const chapter = getState().chapters.find((c) => c.id === selectedChapterId);
  if (!chapter) return;
  const titleEl = document.getElementById('mChapterTitle');
  const bodyEl = document.getElementById('mChapterBody');
  const wordsEl = document.getElementById('mChapterWords');
  const saveEl = document.getElementById('mSaveState');
  if (titleEl) chapter.title = titleEl.value;
  if (bodyEl) chapter.body = bodyEl.innerText || bodyEl.textContent || '';
  chapter.updatedAt = nowIso();
  if (wordsEl) wordsEl.textContent = `${wordCount(chapter.body || '')} 字`;
  if (saveEl) saveEl.textContent = '保存中...';
  if (chapterSaveTimer) clearTimeout(chapterSaveTimer);
  chapterSaveTimer = setTimeout(() => {
    persist();
    if (saveEl) saveEl.textContent = '已自动保存';
  }, 360);
}

export function setSelectedChapter(id) { selectedChapterId = id; }
export function setSelectedModule(id) { selectedModuleId = id; }
export function getSelectedChapterIdMobile() { return selectedChapterId; }
export function toggleFavoritesOnlyMobile() { favoritesOnly = !favoritesOnly; }

/* ============================================================ *
 * 9. 书库 view(完整列表 + 详情)
 * ============================================================ */

export function renderBooksView() {
  if (!mDom.booksView) return;
  const state = getState();
  const books = state.books || [];
  const activeId = activeBookId();
  mDom.booksView.innerHTML = `
    <div class="m-section-head">
      <div><span class="m-eyebrow">Books</span><h2>书库</h2></div>
      <button class="m-section-action" data-action="open-book-form" type="button">+ 新建</button>
    </div>
    ${books.length === 0 ? '<p class="m-helper-text">还没有任何作品。点击右上角新建。</p>' : books.map((b) => `
      <div class="m-book-card ${b.id === activeId ? 'active' : ''}" data-action="open-book-detail" data-id="${b.id}">
        ${bookCoverHtml(b)}
        <div class="m-book-body">
          <div class="m-book-title">${escapeHtml(b.title)}</div>
          <div class="m-book-meta">${escapeHtml(b.genre || '')}${b.genre ? ' · ' : ''}${BOOK_STATUS_MAP[b.status] || ''}</div>
          ${b.premise ? `<div class="m-card-body m-card-body-clip">${escapeHtml(b.premise)}</div>` : ''}
        </div>
        <div class="m-card-actions">
          ${b.id === activeId ? '<span class="m-pill m-pill-active">当前</span>' : `<button class="m-btn m-btn-secondary" data-action="select-book" data-id="${b.id}" data-stop="1" type="button">设为当前</button>`}
        </div>
      </div>
    `).join('')}
  `;
}

export function openBookDetailSheet(bookId) {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  const statusOpts = Object.entries(BOOK_STATUS_MAP).map(([v, l]) =>
    `<option value="${v}" ${v === book.status ? 'selected' : ''}>${l}</option>`).join('');
  const colorRow = BOOK_COVER_COLORS.map((c) => `
    <span class="m-color-swatch ${c === book.coverColor ? 'active' : ''}" style="background:${c};" data-action="pick-book-color" data-id="${book.id}" data-color="${c}"></span>
  `).join('');
  const body = `
    <div class="m-field">
      <label class="m-field-label">书名</label>
      <input id="mBookTitle" class="m-input" type="text" value="${escapeHtml(book.title)}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">类型</label>
      <input id="mBookGenre" class="m-input" type="text" value="${escapeHtml(book.genre || '')}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">状态</label>
      <select id="mBookStatus" class="m-select">${statusOpts}</select>
    </div>
    <div class="m-field">
      <label class="m-field-label">封面色</label>
      <div class="m-color-row">${colorRow}</div>
    </div>
    <div class="m-field">
      <label class="m-field-label">简介 / 立意</label>
      <textarea id="mBookPremise" class="m-textarea" rows="6">${escapeHtml(book.premise || '')}</textarea>
    </div>
    <div class="m-card-actions" style="margin-top:16px">
      <button class="m-btn m-btn-secondary" data-action="select-book" data-id="${book.id}" type="button">设为当前</button>
      <button class="m-btn m-btn-danger" data-action="delete-book" data-id="${book.id}" type="button">删除作品</button>
    </div>
  `;
  openSheet({
    title: '作品详情',
    body,
    action: '保存',
    onAction: () => {
      book.title = document.getElementById('mBookTitle')?.value.trim() || book.title;
      book.genre = document.getElementById('mBookGenre')?.value.trim() || '';
      book.status = document.getElementById('mBookStatus')?.value || 'planning';
      book.premise = document.getElementById('mBookPremise')?.value.trim() || '';
      book.updatedAt = nowIso();
      persist();
      render();
      closeSheet();
      showToast('已保存。');
    }
  });
}

export function openBookForm() {
  const colorRow = BOOK_COVER_COLORS.map((c, i) => `
    <span class="m-color-swatch ${i === 0 ? 'active' : ''}" style="background:${c};" data-pick-color="${c}"></span>
  `).join('');
  const body = `
    <div class="m-field">
      <label class="m-field-label">书名</label>
      <input id="mNewBookTitle" class="m-input" type="text" placeholder="例如:长夜烬明" />
    </div>
    <div class="m-field">
      <label class="m-field-label">类型</label>
      <input id="mNewBookGenre" class="m-input" type="text" placeholder="玄幻 / 都市 / 科幻 / 言情..." />
    </div>
    <div class="m-field">
      <label class="m-field-label">状态</label>
      <select id="mNewBookStatus" class="m-select">
        ${Object.entries(BOOK_STATUS_MAP).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
    </div>
    <div class="m-field">
      <label class="m-field-label">封面色</label>
      <div class="m-color-row" id="mNewBookColors">${colorRow}</div>
      <input id="mNewBookColor" type="hidden" value="${BOOK_COVER_COLORS[0]}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">简介 / 立意</label>
      <textarea id="mNewBookPremise" class="m-textarea" rows="4" placeholder="一句话讲清这部作品的核心。"></textarea>
    </div>
  `;
  openSheet({
    title: '新建作品',
    body,
    action: '创建',
    onAction: () => {
      const title = document.getElementById('mNewBookTitle')?.value.trim();
      if (!title) { showToast('请填写书名。'); return; }
      const state = getState();
      const book = {
        id: uid('book'),
        title,
        genre: document.getElementById('mNewBookGenre')?.value.trim() || '',
        status: document.getElementById('mNewBookStatus')?.value || 'planning',
        coverColor: document.getElementById('mNewBookColor')?.value || BOOK_COVER_COLORS[0],
        coverImage: null,
        premise: document.getElementById('mNewBookPremise')?.value.trim() || '',
        modules: [...DEFAULT_MODULES],
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      state.books.unshift(book);
      state.activeBookId = book.id;
      selectedChapterId = null;
      addActivity(`创建作品《${book.title}》`);
      persist();
      render();
      closeSheet();
      showToast('作品已创建。');
    }
  });

  // 颜色选择交互(局部)
  const colorWrap = document.getElementById('mNewBookColors');
  const colorHidden = document.getElementById('mNewBookColor');
  colorWrap?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-pick-color]');
    if (!target) return;
    colorWrap.querySelectorAll('.m-color-swatch').forEach((s) => s.classList.remove('active'));
    target.classList.add('active');
    colorHidden.value = target.dataset.pickColor;
  });
}

/* ============================================================ *
 * 10. AI 接口设置 / 导出 / 导入 / 日志(更多页入口)
 * ============================================================ */

export function openApiForm() {
  const config = getApiConfig();
  const body = `
    <div class="m-field">
      <label class="m-field-label">Endpoint</label>
      <input id="mApiEndpoint" class="m-input" type="text" value="${escapeHtml(config.endpoint || DEFAULT_API_ENDPOINT)}" />
      <span class="m-field-hint">DeepSeek / OpenAI 兼容的 chat completions 端点</span>
    </div>
    <div class="m-field">
      <label class="m-field-label">Model</label>
      <input id="mApiModel" class="m-input" type="text" value="${escapeHtml(config.model || DEFAULT_API_MODEL)}" />
    </div>
    <div class="m-field">
      <label class="m-field-label">API Key</label>
      <input id="mApiKey" class="m-input" type="password" value="${escapeHtml(config.apiKey || '')}" placeholder="sk-..." />
    </div>
    <div class="m-field">
      <label class="m-field-label">系统提示词</label>
      <textarea id="mApiPrompt" class="m-textarea" rows="8">${escapeHtml(config.prompt || DEFAULT_PROMPT)}</textarea>
    </div>
    <div class="m-card-actions" style="margin-top:8px">
      <button class="m-btn m-btn-ghost" data-action="test-api" type="button">测试连接</button>
    </div>
  `;
  openSheet({
    title: 'AI 接口设置',
    body,
    action: '保存',
    onAction: () => {
      setApiConfig({
        endpoint: document.getElementById('mApiEndpoint')?.value.trim() || DEFAULT_API_ENDPOINT,
        model:    document.getElementById('mApiModel')?.value.trim() || DEFAULT_API_MODEL,
        apiKey:   document.getElementById('mApiKey')?.value.trim() || '',
        prompt:   document.getElementById('mApiPrompt')?.value.trim() || DEFAULT_PROMPT
      });
      persistApiConfig();
      closeSheet();
      showToast('AI 接口已保存。');
    }
  });
}

export function exportData() {
  const payload = {
    exportedAt: nowIso(),
    state: getState(),
    apiConfig: { ...getApiConfig(), apiKey: '' }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novel-forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('已下载备份。');
}

export async function importData(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload.state?.books || !payload.state?.notes) {
      showToast('备份格式不正确。');
      return;
    }
    const state = getState();
    Object.assign(state, payload.state);
    selectedChapterId = state.chapters.find((c) => c.bookId === state.activeBookId)?.id || null;
    persist();
    render();
    showToast('备份已导入。');
  } catch (e) {
    console.warn(e);
    showToast('导入失败:' + (e.message || '无效 JSON'));
  }
}

export function openLogsSheet() {
  const logs = getLogs();
  const filter = getLogFilter();
  const filtered = filter ? logs.filter((l) => l.type === filter) : logs;
  const filterChips = ['', 'api', 'error', 'info'].map((f) => `
    <span class="m-pill ${f === filter ? 'm-pill-active' : ''}" data-action="set-log-filter" data-id="${f}">${f ? f.toUpperCase() : '全部'}</span>
  `).join('');
  const body = `
    <div class="m-log-filter">${filterChips}</div>
    ${filtered.length === 0 ? '<p class="m-helper-text">暂无日志。</p>' : filtered.map((l) => `
      <div class="m-log-item log-${l.type}">
        <div class="m-log-header"><span>${formatDate(l.timestamp)}</span><span>${l.type.toUpperCase()}</span></div>
        <div class="m-log-message">${escapeHtml(l.message)}</div>
        ${l.details ? `<pre class="m-log-details">${escapeHtml(typeof l.details === 'string' ? l.details : JSON.stringify(l.details, null, 2))}</pre>` : ''}
      </div>
    `).join('')}
  `;
  openSheet({
    title: '系统日志',
    body,
    action: '清空',
    onAction: () => {
      openConfirm({
        title: '确认清空',
        message: '所有日志将被删除,无法恢复。',
        danger: true,
        onOk: () => {
          clearLogs();
          openLogsSheet(); // 重渲
          showToast('日志已清空。');
        }
      });
    }
  });
}
