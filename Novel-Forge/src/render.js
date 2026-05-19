import { dom } from './dom.js';
import { getState, getApiConfig, activeBook, activeBookId, getModules, getModuleName, addActivity } from './state.js';
import { wordCount, escapeHtml, formatDate, highlightSearchTerm } from './utils.js';
import { BOOK_COVER_COLORS, BOOK_STATUS_MAP, VIEW_LABELS, LOGS_STORAGE_KEY } from './constants.js';
import { renderRelationGraph, getSelectedRelationItem } from './relation.js';

const loadLogs = () => {
  try {
    const stored = localStorage.getItem(LOGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveLogs = () => {
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
};

let logFilter = "";
let logs = loadLogs();

export const showToast = (message) => {
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => dom.toast.classList.remove("show"), 2400);
};

export const addLog = (type, message, details = null) => {
  const log = {
    id: `${type}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };
  logs.unshift(log);
  if (logs.length > 100) {
    logs = logs.slice(0, 100);
  }
  saveLogs();
};

export const clearLogs = () => {
  logs = [];
  saveLogs();
  if (getActiveView() === "settings") {
    renderSettings();
  }
};

let activeView = "workspace";
let selectedNoteId = null;
let selectedModuleId = "characters";
let selectedChapterId = null;
let referenceModuleFilters = [];

export const getActiveView = () => activeView;
export const getSelectedNoteId = () => selectedNoteId;
export const getSelectedModuleId = () => selectedModuleId;
export const getSelectedChapterId = () => selectedChapterId;
export const getReferenceModuleFilters = () => referenceModuleFilters;

export const setSelectedNoteId = (id) => { selectedNoteId = id; };
export const setSelectedModuleId = (id) => { selectedModuleId = id; };
export const setSelectedChapterId = (id) => { selectedChapterId = id; };
export const setReferenceModuleFilters = (filters) => { referenceModuleFilters = filters; };
export const toggleReferenceFilter = (moduleId) => {
  if (moduleId === "all") {
    referenceModuleFilters = [];
  } else {
    const index = referenceModuleFilters.indexOf(moduleId);
    if (index > -1) {
      referenceModuleFilters.splice(index, 1);
    } else {
      referenceModuleFilters.push(moduleId);
    }
  }
};

export const switchView = (view) => {
  activeView = view;
  dom.pageTitle.textContent = VIEW_LABELS[view];
  dom.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  dom.views.forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
  render();
};

export const render = () => {
  renderBookSelect();
  renderBooks();
  renderStats();
  renderSuggestions();
  renderActivities();
  renderInbox();
  renderNoteDetail();
  renderModules();
  renderLibrary();
  renderChapters();
  renderEditor();
  renderReferenceModuleFilter();
  renderReferences();
  renderAiMode();
  renderSettings();
  renderRelationView();
};

export const renderRelationView = () => {
  if (!dom.relationView) return;
  if (activeView === 'relation') {
    const selectedItem = getSelectedRelationItem();
    renderRelationGraph(selectedItem);
  }
};

export const renderSettings = () => {
  const settingsContent = document.querySelector("#settingsContent");
  if (!settingsContent) return;
  
  settingsContent.innerHTML = `
    <div class="settings-content">
      <section class="settings-panel">
        <div class="panel-heading">
          <h2>系统日志</h2>
          <button class="ghost-button" data-action="clear-logs" type="button">清空日志</button>
        </div>
        
        <div class="log-filter">
          <button class="filter-chip ${!logFilter ? "active" : ""}" data-action="set-log-filter" data-id="" type="button">全部</button>
          <button class="filter-chip ${logFilter === "api" ? "active" : ""}" data-action="set-log-filter" data-id="api" type="button">API</button>
          <button class="filter-chip ${logFilter === "error" ? "active" : ""}" data-action="set-log-filter" data-id="error" type="button">错误</button>
          <button class="filter-chip ${logFilter === "info" ? "active" : ""}" data-action="set-log-filter" data-id="info" type="button">信息</button>
        </div>
        
        <div class="log-list">
          ${logs.length === 0 ? `<div class="empty-state">暂无日志记录。</div>` : logs
            .filter((log) => !logFilter || log.type === logFilter)
            .map((log) => `
              <div class="log-item log-${log.type}">
                <div class="log-header">
                  <span class="log-time">${formatDate(log.timestamp)}</span>
                  <span class="log-type">${log.type.toUpperCase()}</span>
                </div>
                <div class="log-message">${escapeHtml(log.message)}</div>
                ${log.details ? `
                  <div class="log-details">
                    <button class="expand-details" data-action="toggle-log-details" data-id="${log.id}" type="button">
                      查看详情 ▼
                    </button>
                    <pre class="log-details-content" id="log-details-${log.id}" style="display: none;">${escapeHtml(typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2))}</pre>
                  </div>
                ` : ""}
              </div>
            `).join("")}
        </div>
      </section>
    </div>
  `;
};

export const setLogFilter = (filter) => {
  logFilter = filter;
  renderSettings();
};

export const showModuleDialog = (moduleId = null) => {
  const existingDialog = document.getElementById("moduleDialog");
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const isEdit = !!moduleId;
  const modules = getModules();
  const module = isEdit ? modules.find(m => m.id === moduleId) : null;
  
  const colorValue = isEdit && module && module.color ? module.color : '#4a90d9';
  const dialogHTML = `<dialog id="moduleDialog" class="modal"><form method="dialog" id="moduleForm"><div class="modal-heading"><h2>${isEdit ? "编辑模块" : "添加模块"}</h2><button type="button" class="close-button" onclick="document.getElementById('moduleDialog').close()">✕</button></div><div class="modal-body"><div class="form-group"><label>模块名称 *</label><input type="text" id="moduleNameInput" required placeholder="如：人物、世界观" value="${isEdit && module ? module.name : ''}" /></div><div class="form-group"><label>模块描述（可选）</label><input type="text" id="moduleHintInput" placeholder="简短描述" value="${isEdit && module ? module.hint : ''}" /></div><div class="form-group"><label>模块颜色</label><input type="color" id="moduleColorInput" value="${colorValue}" /></div></div><div class="modal-footer"><button type="submit" value="cancel" class="ghost-button">取消</button><button type="submit" value="save" class="primary-button">保存</button></div></form></dialog>`;
  
  document.body.insertAdjacentHTML("beforeend", dialogHTML);
  
  document.getElementById("moduleForm").addEventListener("submit", function(e) {
    if (e.submitter?.value === "cancel") {
      document.getElementById("moduleDialog").close();
      return;
    }
    e.preventDefault();
    
    const name = document.getElementById("moduleNameInput").value.trim();
    const hint = document.getElementById("moduleHintInput").value.trim();
    const color = document.getElementById("moduleColorInput").value;
    
    if (!name) {
      showToast("请输入模块名称");
      return;
    }
    
    const state = getState();
    const book = state.books.find(b => b.id === activeBookId());
    if (!book) return;
    
    if (moduleId) {
      book.modules = getModules().map(m => m.id === moduleId ? {...m, name, hint: hint || m.hint, color} : m);
      showToast("已更新模块");
    } else {
      book.modules.push({id: `module-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`, name, hint: hint || "暂无描述", color});
      selectedModuleId = book.modules[book.modules.length - 1].id;
      showToast("已添加模块");
    }
    
    book.updatedAt = new Date().toISOString();
    renderModules();
    renderLibrary();
    renderReferenceModuleFilter();
    
    document.getElementById("moduleDialog").close();
  });
  
  document.getElementById("moduleDialog").showModal();
};

export const renderBookSelect = () => {
  const state = getState();
  const allBooksOption = `
    <button class="book-select-item ${!activeBookId() ? "active" : ""}" 
            data-action="select-book" data-id="" type="button">
      <div class="mini-cover">
        <span class="mini-cover-all">📚</span>
      </div>
      <span class="book-select-title">全部作品</span>
    </button>
  `;
  
  const booksHtml = state.books
    .map((book) => {
      const coverHtml = book.coverImage 
        ? `<img src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.title)}" class="mini-cover-image" />`
        : `<span class="mini-cover-color" style="background:${escapeHtml(book.coverColor)}">${escapeHtml(getBookInitial(book))}</span>`;
      return `
        <button class="book-select-item ${book.id === activeBookId() ? "active" : ""}" 
                data-action="select-book" data-id="${book.id}" type="button">
          <div class="mini-cover">${coverHtml}</div>
          <span class="book-select-title">${escapeHtml(book.title)}</span>
        </button>
      `;
    })
    .join("");
  
  dom.bookSelect.innerHTML = allBooksOption + booksHtml;
};

export const renderStats = () => {
  const state = getState();
  const bookId = activeBookId();
  dom.bookCount.textContent = state.books.length;
  dom.inboxCount.textContent = state.notes.filter((note) => note.status !== "archived" && note.aiStatus !== "done").length;
  
  if (bookId) {
    dom.libraryCount.textContent = state.libraryItems.filter((item) => item.bookId === bookId).length;
    dom.wordCount.textContent = state.chapters
      .filter((chapter) => chapter.bookId === bookId)
      .reduce((sum, chapter) => sum + wordCount(chapter.body), 0);
  } else {
    dom.libraryCount.textContent = state.libraryItems.length;
    dom.wordCount.textContent = state.chapters.reduce((sum, chapter) => sum + wordCount(chapter.body), 0);
  }
};

export const renderBooks = () => {
  if (!dom.bookGrid || !dom.bookDetail) return;
  
  const state = getState();
  const allBooksCard = `
    <article class="book-card ${!activeBookId() ? "active" : ""}" data-action="select-book-card" data-id="" style="border: 2px dashed var(--border);">
      <div class="book-cover all-books-cover">
        <span class="all-books-icon">📚</span>
      </div>
      <div class="book-info">
        <strong>全部作品</strong>
        <p class="muted small">查看所有作品的汇总</p>
        <div class="book-metrics">
          <span>${state.libraryItems.length} 条设定</span>
          <span>${state.chapters.reduce((sum, ch) => sum + wordCount(ch.body), 0)} 字</span>
        </div>
      </div>
    </article>
  `;
  
  dom.bookGrid.innerHTML = allBooksCard + state.books.map((book) => renderBookCard(book)).join("");
  
  const book = activeBook();
  if (!book) {
    const totalChapters = state.chapters.length;
    const totalWords = state.chapters.reduce((sum, ch) => sum + wordCount(ch.body), 0);
    dom.bookDetail.innerHTML = `
      <div class="book-detail-header">
        <div class="book-detail-cover-wrapper">
          <div class="book-detail-cover-color all-books-detail-cover">📚</div>
        </div>
        <div class="book-detail-title">
          <h2>全部作品</h2>
          <span class="status-pill">汇总视图</span>
        </div>
      </div>
      <div class="book-edit-section">
        <p class="empty-state">已选择全部作品视图，可以查看所有作品的设定资料和灵感。</p>
      </div>
      <div class="book-stats">
        <div class="stat-item">
          <strong>${state.books.length}</strong>
          <span>作品</span>
        </div>
        <div class="stat-item">
          <strong>${totalChapters}</strong>
          <span>章节</span>
        </div>
        <div class="stat-item">
          <strong>${totalWords.toLocaleString()}</strong>
          <span>字数</span>
        </div>
        <div class="stat-item">
          <strong>${state.libraryItems.length}</strong>
          <span>设定资料</span>
        </div>
      </div>
    `;
    return;
  }

  const metrics = getBookMetrics(book.id);
  const bookChars = state.characters.filter((c) => c.bookId === book.id);
  const bookChapters = state.chapters.filter((ch) => ch.bookId === book.id).sort((a, b) => a.order - b.order);
  
  dom.bookDetail.innerHTML = `
    <div class="book-detail-header">
      <div class="book-detail-cover-wrapper">
        ${book.coverImage ? `<img src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.title)}" class="book-detail-cover-image" />` : `<div class="book-detail-cover-color" style="background:${escapeHtml(book.coverColor)}">${escapeHtml(getBookInitial(book))}</div>`}
        <label class="cover-upload-button">
          <input type="file" accept="image/*" data-action="upload-book-cover" data-id="${book.id}" />
          <span>上传封面</span>
        </label>
        ${book.coverImage ? `<button class="cover-remove-button" data-action="remove-book-cover" data-id="${book.id}" type="button">移除封面</button>` : ""}
      </div>
      <div class="book-detail-title">
        <input type="text" value="${escapeHtml(book.title)}" class="book-title-input" data-action="edit-book-title" data-id="${book.id}" />
        <span class="status-pill">${getBookStatusName(book.status)}</span>
      </div>
    </div>
    
    <div class="book-edit-section">
      <h3>基本信息</h3>
      <div class="edit-form">
        <label>
          作品类型
          <input type="text" value="${escapeHtml(book.genre || "")}" placeholder="玄幻、都市、科幻..." data-action="edit-book-genre" data-id="${book.id}" />
        </label>
        <label>
          创作状态
          <select data-action="edit-book-status" data-id="${book.id}">
            <option value="planning" ${book.status === "planning" ? "selected" : ""}>规划中</option>
            <option value="active" ${book.status === "active" ? "selected" : ""}>进行中</option>
            <option value="paused" ${book.status === "paused" ? "selected" : ""}>暂停</option>
            <option value="finished" ${book.status === "finished" ? "selected" : ""}>完结</option>
          </select>
        </label>
        <label>
          默认封面色（无图片时使用）
          <input type="color" value="${escapeHtml(book.coverColor)}" data-action="edit-book-color" data-id="${book.id}" />
        </label>
        <label>
          一句话核心
          <textarea placeholder="这本书最想写的冲突、爽点或情绪..." data-action="edit-book-premise" data-id="${book.id}">${escapeHtml(book.premise || "")}</textarea>
        </label>
      </div>
    </div>
    
    <div class="book-stats-section">
      <h3>数据统计</h3>
      <div class="book-metrics-grid">
        <div class="stat-item"><span>原始笔记</span><strong>${metrics.raw}</strong></div>
        <div class="stat-item"><span>设定资料</span><strong>${metrics.ideas}</strong></div>
        <div class="stat-item"><span>章节</span><strong>${metrics.chapters}</strong></div>
        <div class="stat-item"><span>人物</span><strong>${bookChars.length}</strong></div>
      </div>
    </div>
    
    <div class="book-nav-section">
      <h3>快速导航</h3>
      <div class="nav-grid">
        <button class="nav-card" data-action="navigate-to-writing" data-id="${book.id}">
          <span class="nav-icon">✏️</span>
          <span class="nav-text">正文写作</span>
          <span class="nav-count">${bookChapters.length} 章</span>
        </button>
        <button class="nav-card" data-action="navigate-to-characters" data-id="${book.id}">
          <span class="nav-icon">👤</span>
          <span class="nav-text">人物设定</span>
          <span class="nav-count">${bookChars.length} 人</span>
        </button>
        <button class="nav-card" data-action="navigate-to-library" data-id="${book.id}">
          <span class="nav-icon">📚</span>
          <span class="nav-text">设定资料库</span>
          <span class="nav-count">${metrics.ideas} 条</span>
        </button>
        <button class="nav-card" data-action="navigate-to-inbox" data-id="${book.id}">
          <span class="nav-icon">📥</span>
          <span class="nav-text">灵感收件箱</span>
          <span class="nav-count">${metrics.raw} 条</span>
        </button>
      </div>
    </div>
    
    ${bookChapters.length > 0 ? `
    <div class="book-chapters-section">
      <div class="section-header">
        <h3>最近章节</h3>
        <button class="text-button" data-action="navigate-to-writing" data-id="${book.id}">查看全部</button>
      </div>
      <div class="chapter-list-preview">
        ${bookChapters.slice(0, 5).map((ch, idx) => `
          <article class="mini-chapter-card" data-action="select-chapter" data-id="${ch.id}">
            <span class="chapter-order">第 ${ch.order} 章</span>
            <span class="chapter-title">${escapeHtml(ch.title || "未命名章节")}</span>
            <span class="chapter-words">${wordCount(ch.body)} 字</span>
          </article>
        `).join("")}
      </div>
    </div>
    ` : ""}
    
    <div class="book-actions-section">
      <button class="secondary-button" data-action="navigate-to-writing" data-id="${book.id}">开始写作</button>
      <button class="text-button danger" data-action="delete-book" data-id="${book.id}" type="button">删除作品</button>
    </div>
  `;
};

export const renderBookCard = (book) => {
  const metrics = getBookMetrics(book.id);
  const coverHtml = book.coverImage 
    ? `<img src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.title)}" class="book-cover-image" />`
    : `<div class="book-cover-color" style="background:${escapeHtml(book.coverColor)}">${escapeHtml(getBookInitial(book))}</div>`;
  
  return `
    <article class="book-card ${book.id === activeBookId() ? "active" : ""}" data-action="select-book-card" data-id="${book.id}">
      <div class="book-cover">${coverHtml}</div>
      <div class="book-info">
        <strong>${escapeHtml(book.title)}</strong>
        <p class="muted small">${escapeHtml(book.genre || "未设置类型")} · ${getBookStatusName(book.status)}</p>
        <div class="book-metrics">
          <div class="book-metric"><span>笔记</span><b>${metrics.raw}</b></div>
          <div class="book-metric"><span>设定</span><b>${metrics.ideas}</b></div>
          <div class="book-metric"><span>章节</span><b>${metrics.chapters}</b></div>
        </div>
      </div>
    </article>
  `;
};

export const getBookMetrics = (bookId) => {
  const state = getState();
  return {
    raw: state.notes.filter((note) => (note.suggestion?.bookId || note.bookId) === bookId && note.status !== "archived").length,
    ideas: state.libraryItems.filter((item) => item.bookId === bookId).length,
    chapters: state.chapters.filter((chapter) => chapter.bookId === bookId).length
  };
};

export const getBookInitial = (book) => {
  return (book.title || "书").trim().slice(0, 1);
};

export const getBookStatusName = (status) => {
  return BOOK_STATUS_MAP[status] || "规划中";
};

export const renderAiMode = () => {
  const apiConfig = getApiConfig();
  const hasApi = Boolean(apiConfig.endpoint && apiConfig.apiKey && apiConfig.model);
  dom.aiModeBadge.textContent = hasApi ? "API 已配置" : "本地规则";
};

export const renderSuggestions = () => {
  const state = getState();
  const suggestions = state.notes
    .filter((note) => note.status === "suggested" && note.suggestion)
    .slice(0, activeView === "workspace" ? 4 : 100);

  if (!suggestions.length) {
    dom.suggestionList.innerHTML = `<div class="empty-state">暂时没有待确认建议。</div>`;
    return;
  }

  dom.suggestionList.innerHTML = suggestions.map((note) => renderSuggestionCard(note)).join("");
};

export const renderSuggestionCard = (note) => {
  const suggestion = note.suggestion;
  const state = getState();
  const targetBook = state.books.find((book) => book.id === suggestion.bookId) || activeBook();
  const confidence = Math.round((suggestion.confidence || 0.7) * 100);
  const conflicts = suggestion.conflicts?.length
    ? `<p class="small muted">提醒：${escapeHtml(suggestion.conflicts.join("；"))}</p>`
    : "";

  return `
    <article class="suggestion-card">
      <div class="card-title-row">
        <strong>${escapeHtml(suggestion.title || note.title)}</strong>
        <span class="status-pill">${confidence}%</span>
      </div>
      <p class="card-text">${escapeHtml(suggestion.summary || note.content)}</p>
      <div class="tag-row">
        <span class="module-pill">${escapeHtml(targetBook?.title || "通用灵感池")}</span>
        <span class="module-pill">${getModuleName(suggestion.module)}</span>
        ${(suggestion.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      ${conflicts}
      <div class="card-actions">
        <button class="primary-button" data-action="accept-suggestion" data-id="${note.id}" type="button">确认归档</button>
        <button class="secondary-button" data-action="rerun-review" data-id="${note.id}" type="button">重新审阅</button>
        <button class="text-button" data-action="dismiss-suggestion" data-id="${note.id}" type="button">先放回收件箱</button>
      </div>
    </article>
  `;
};

export const renderActivities = () => {
  const state = getState();
  if (!state.activities.length) {
    dom.activityList.innerHTML = `<div class="empty-state">还没有活动记录。</div>`;
    return;
  }

  dom.activityList.innerHTML = state.activities
    .slice(0, 8)
    .map(
      (activity) => `
        <article class="activity-card">
          <strong>${escapeHtml(activity.text)}</strong>
          <p class="muted small">${formatDate(activity.createdAt)}</p>
        </article>
      `
    )
    .join("");
};

export const noteMatchesSearch = (note, query) => {
  if (!query) return true;
  const suggestion = note.suggestion || {};
  return [note.title, note.content, suggestion.summary, ...(suggestion.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(query);
};

export const renderInbox = () => {
  const state = getState();
  const query = dom.searchInput.value.trim().toLowerCase();
  const notes = state.notes.filter((note) => note.status !== "archived" && noteMatchesSearch(note, query));

  if (!notes.length) {
    const message = query ? `未找到包含「${query}」的灵感。` : "还没有灵感记录。点击下方按钮记录新想法。";
    dom.inboxList.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  const stats = query ? `<div class="search-stats">找到 ${notes.length} 条匹配结果</div>` : "";

  dom.inboxList.innerHTML = stats + notes
    .map((note) => {
      const statusText = getRawNoteStatusName(note);
      const contentPreview = note.content.slice(0, 150) + (note.content.length > 150 ? "..." : "");
      return `
        <article class="note-card ${selectedNoteId === note.id ? "selected" : ""}" data-action="select-note" data-id="${note.id}">
          <div class="card-title-row">
            <strong>${highlightSearchTerm(note.title, query)}</strong>
            <span class="status-pill">${statusText}</span>
          </div>
          <p class="card-text">${highlightSearchTerm(contentPreview, query)}</p>
          <p class="muted small">${formatDate(note.updatedAt)}</p>
        </article>
      `;
    })
    .join("");
};

export const getRawNoteStatusName = (note) => {
  if (note.aiStatus === "processing") return "处理中";
  if (note.status === "suggested" || note.aiStatus === "done") return "待确认";
  return "未审阅";
};

export const renderNoteDetail = () => {
  const state = getState();
  const note = state.notes.find((item) => item.id === selectedNoteId);
  if (!note) {
    dom.noteDetail.innerHTML = `<div class="empty-state">选择一条灵感查看详情。</div>`;
    return;
  }

  const suggestion = note.suggestion;
  dom.noteDetail.innerHTML = `
    <article>
      <h2>${escapeHtml(note.title)}</h2>
      <p class="card-text">${escapeHtml(note.content)}</p>
      <p class="muted small">更新于 ${formatDate(note.updatedAt)}</p>
      ${
        suggestion
          ? `
            <div class="tag-row">
              <span class="module-pill">${getModuleName(suggestion.module)}</span>
              ${(suggestion.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            </div>
            <p class="card-text">${escapeHtml(suggestion.reason || "")}</p>
          `
          : `<p class="muted">这条灵感还没有经过 AI 审阅。</p>`
      }
      <div class="card-actions">
        <button class="secondary-button" data-action="rerun-review" data-id="${note.id}" type="button">AI 审阅</button>
        ${
          suggestion
            ? `<button class="primary-button" data-action="accept-suggestion" data-id="${note.id}" type="button">确认归档</button>`
            : ""
        }
        <button class="text-button" data-action="archive-note" data-id="${note.id}" type="button">归档隐藏</button>
      </div>
    </article>
  `;
};

export const renderModules = () => {
  const state = getState();
  const bookId = activeBookId();
  dom.moduleTabs.innerHTML = getModules().map((module) => {
    let count;
    if (bookId) {
      count = state.libraryItems.filter((item) => item.bookId === bookId && item.module === module.id).length;
    } else {
      count = state.libraryItems.filter((item) => item.module === module.id).length;
    }
    return `
      <div class="module-tab-wrapper">
        <button class="module-tab ${selectedModuleId === module.id ? "active" : ""}" data-action="select-module" data-id="${module.id}" type="button">
          <strong>${module.name}</strong>
          <span>${count} 条 · ${module.hint}</span>
        </button>
        <div class="module-tab-actions">
          <button class="icon-button" data-action="edit-module" data-id="${module.id}" title="编辑模块" type="button">✏️</button>
          <button class="icon-button" data-action="delete-module" data-id="${module.id}" title="删除模块" type="button">🗑️</button>
        </div>
      </div>
    `;
  }).join("") + `
    <button class="module-tab add-module" data-action="add-module" type="button">
      <strong>+ 添加模块</strong>
    </button>
  `;
  dom.moduleTitle.textContent = getModuleName(selectedModuleId);
};

export const libraryMatchesSearch = (item, query) => {
  if (!query) return true;
  return [item.title, item.content, ...(item.tags || [])].join(" ").toLowerCase().includes(query);
};

export const renderLibrary = () => {
  const state = getState();
  const query = dom.searchInput.value.trim().toLowerCase();
  const bookId = activeBookId();
  
  let items = state.libraryItems
    .filter((item) => item.module === selectedModuleId);
  
  if (bookId) {
    items = items.filter((item) => item.bookId === bookId);
  }
  
  items = items.filter((item) => libraryMatchesSearch(item, query));

  if (!items.length) {
    const message = query ? `未找到包含「${query}」的资料。` : "这个模块还没有资料。可以从收件箱确认归档，也可以手动新增。";
    dom.libraryList.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  const stats = query ? `<div class="search-stats">找到 ${items.length} 条匹配结果</div>` : "";

  dom.libraryList.innerHTML = stats + items
    .map(
      (item) => `
        <article class="library-card">
          <div class="card-title-row">
            <strong>${highlightSearchTerm(item.title, query)}</strong>
            <span class="muted small">${formatDate(item.updatedAt)}</span>
          </div>
          <p class="card-text">${highlightSearchTerm(item.content, query)}</p>
          <div class="tag-row">${(item.tags || []).map((tag) => `<span class="tag">${highlightSearchTerm(tag, query)}</span>`).join("")}</div>
          <div class="card-actions">
            <button class="text-button" data-action="view-relations" data-id="${item.id}" type="button">查看关系</button>
            <button class="text-button" data-action="edit-library-item" data-id="${item.id}" type="button">编辑</button>
            <button class="text-button" data-action="rollback-library-item" data-id="${item.id}" type="button">回退到收件箱</button>
            <button class="text-button" data-action="delete-library-item" data-id="${item.id}" type="button">删除</button>
          </div>
        </article>
      `
    )
    .join("");
};

export const renderChapters = () => {
  const state = getState();
  const chapters = state.chapters
    .filter((chapter) => chapter.bookId === activeBookId())
    .sort((a, b) => a.order - b.order);

  if (!selectedChapterId && chapters[0]) selectedChapterId = chapters[0].id;

  if (!chapters.length) {
    dom.chapterList.innerHTML = `<div class="empty-state">还没有章节。</div>`;
    return;
  }

  dom.chapterList.innerHTML = chapters
    .map(
      (chapter) => `
        <article class="chapter-card ${selectedChapterId === chapter.id ? "active" : ""}" data-action="select-chapter" data-id="${chapter.id}">
          <strong>${escapeHtml(chapter.title || "未命名章节")}</strong>
          <p class="muted small">${wordCount(chapter.body)} 字 · ${formatDate(chapter.updatedAt)}</p>
        </article>
      `
    )
    .join("");
};

export const currentChapter = () => {
  const state = getState();
  return state.chapters.find((chapter) => chapter.id === selectedChapterId) || null;
};

export const renderEditor = () => {
  const chapter = currentChapter();
  const state = getState();
  if (!chapter || chapter.bookId !== activeBookId()) {
    const fallback = state.chapters.find((item) => item.bookId === activeBookId());
    selectedChapterId = fallback?.id || null;
  }

  const activeChapter = currentChapter();
  dom.chapterTitleInput.disabled = !activeChapter;
  dom.chapterBodyInput.disabled = !activeChapter;
  dom.chapterTitleInput.value = activeChapter?.title || "";
  dom.chapterBodyInput.value = activeChapter?.body || "";
  dom.chapterWordCount.textContent = `${wordCount(activeChapter?.body || "")} 字`;
};

export const renderReferenceModuleFilter = () => {
  if (!dom.referenceModuleFilter) return;
  
  const modules = getModules();
  const state = getState();
  const bookId = activeBookId();
  
  let allCount;
  if (bookId) {
    allCount = state.libraryItems.filter((item) => item.bookId === bookId).length;
  } else {
    allCount = state.libraryItems.length;
  }
  
  dom.referenceModuleFilter.innerHTML = `
    <button class="filter-chip ${referenceModuleFilters.length === 0 ? "active" : ""}" 
            data-action="toggle-reference-filter" data-id="all" type="button">
      全部 (${allCount})
    </button>
    ${modules.map((module) => {
      let count;
      if (bookId) {
        count = state.libraryItems.filter((item) => item.bookId === bookId && item.module === module.id).length;
      } else {
        count = state.libraryItems.filter((item) => item.module === module.id).length;
      }
      const isActive = referenceModuleFilters.includes(module.id);
      return `
        <button class="filter-chip ${isActive ? "active" : ""}" 
                data-action="toggle-reference-filter" data-id="${module.id}" type="button">
          ${module.name} (${count})
        </button>
      `;
    }).join("")}
  `;
};

export const renderReferences = () => {
  const chapter = currentChapter();
  const text = `${chapter?.title || ""} ${chapter?.body || ""} ${dom.searchInput.value}`.toLowerCase();
  const state = getState();
  const bookId = activeBookId();
  
  let bookItems;
  if (bookId) {
    bookItems = state.libraryItems.filter((item) => item.bookId === bookId);
  } else {
    bookItems = [...state.libraryItems];
  }

  if (referenceModuleFilters.length > 0) {
    bookItems = bookItems.filter((item) => referenceModuleFilters.includes(item.module));
  }

  const scored = bookItems
    .map((item) => {
      const terms = [item.title, ...(item.tags || [])].filter(Boolean);
      const score = terms.reduce((sum, term) => {
        const normalized = String(term).toLowerCase();
        return sum + (normalized && text.includes(normalized) ? 2 : 0);
      }, 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, 8);

  const modules = getModules();
  
  const filterBar = `
    <div class="reference-filter-bar">
      <button class="filter-chip ${referenceModuleFilters.length === 0 ? "active" : ""}" data-action="toggle-reference-filter" data-id="all" type="button">全部</button>
      ${modules.map((module) => {
        const count = bookItems.filter((item) => item.module === module.id).length;
        const isActive = referenceModuleFilters.includes(module.id);
        return `
          <button class="filter-chip ${isActive ? "active" : ""}" 
                  data-action="toggle-reference-filter" 
                  data-id="${module.id}" 
                  type="button"
                  style="--chip-color: ${module.color}">
            ${module.name} (${count})
          </button>
        `;
      }).join("")}
    </div>
  `;

  if (!scored.length) {
    dom.referenceList.innerHTML = `${filterBar}<div class="empty-state">当前作品暂无可引用设定。</div>`;
    return;
  }

  const analyzeButton = `
    <div class="analyze-button-wrapper">
      <button class="secondary-button" data-action="analyze-new-settings" type="button">
        🤖 AI 分析新设定
      </button>
    </div>
  `;

  dom.referenceList.innerHTML = analyzeButton + filterBar + scored
    .map(({ item, score }) => {
      const scoreText = score > 0 ? "相关" : getModuleName(item.module);
      return `
        <article class="reference-card">
          <div class="card-title-row">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="status-pill">${scoreText}</span>
          </div>
          <p class="card-text">${escapeHtml(item.content.slice(0, 130))}${item.content.length > 130 ? "..." : ""}</p>
          <div class="tag-row">${(item.tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
      `;
    })
    .join("");
};

export const updateSearchUI = () => {
  const hasValue = dom.searchInput.value.trim().length > 0;
  dom.clearSearchButton.style.display = hasValue ? "block" : "none";
};

export const renderSearchSuggestions = () => {
  const query = dom.searchInput.value.trim().toLowerCase();
  
  if (!query) {
    hideSearchSuggestions();
    return;
  }
  
  const state = getState();
  const allItems = state.libraryItems;
  const matches = allItems.filter((item) => {
    const text = `${item.title} ${item.content} ${(item.tags || []).join(" ")}`.toLowerCase();
    return text.includes(query);
  }).slice(0, 6);
  
  if (!matches.length) {
    dom.searchSuggestions.innerHTML = `<div class="suggestion-item no-results">未找到匹配的设定资料</div>`;
    dom.searchSuggestions.style.display = "block";
    return;
  }
  
  dom.searchSuggestions.innerHTML = matches.map((item) => {
    const book = state.books.find((b) => b.id === item.bookId);
    const moduleName = getModuleName(item.module);
    const title = highlightSearchTerm(item.title, query);
    return `
      <div class="suggestion-item" data-action="jump-to-library-item" data-id="${item.id}" data-bookid="${item.bookId}" data-moduleid="${item.module}">
        <div class="suggestion-title">${title}</div>
        <div class="suggestion-meta">${book?.title || "未知作品"} · ${moduleName}</div>
      </div>
    `;
  }).join("");
  
  dom.searchSuggestions.style.display = "block";
};

export const hideSearchSuggestions = () => {
  dom.searchSuggestions.style.display = "none";
};

export const switchToFocusMode = () => {
  activeView = "focus";
  dom.views.forEach((panel) => {
    if (panel.id === "focusView") {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });
  renderFocusMode();
};

export const exitFocusMode = () => {
  activeView = "writing";
  dom.views.forEach((panel) => {
    if (panel.id === "writingView") {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });
  dom.focusChaptersPanel.classList.remove("open");
  dom.focusReferencesPanel.classList.remove("open");
  render();
};

export const toggleFocusChaptersPanel = () => {
  dom.focusChaptersPanel.classList.toggle("open");
  dom.focusReferencesPanel.classList.remove("open");
};

export const toggleFocusReferencesPanel = () => {
  dom.focusReferencesPanel.classList.toggle("open");
  dom.focusChaptersPanel.classList.remove("open");
};

export const renderFocusMode = () => {
  renderFocusChapters();
  renderFocusEditor();
  renderFocusReferences();
};

export const renderFocusChapters = () => {
  const state = getState();
  const chapters = state.chapters
    .filter((chapter) => chapter.bookId === activeBookId())
    .sort((a, b) => a.order - b.order);

  if (!selectedChapterId && chapters[0]) selectedChapterId = chapters[0].id;

  if (!chapters.length) {
    dom.focusChapterList.innerHTML = `<div class="empty-state">还没有章节。</div>`;
    return;
  }

  dom.focusChapterList.innerHTML = chapters
    .map(
      (chapter) => `
        <article class="chapter-card ${selectedChapterId === chapter.id ? "active" : ""}" data-action="focus-select-chapter" data-id="${chapter.id}">
          <strong>${escapeHtml(chapter.title || "未命名章节")}</strong>
          <p class="muted small">${wordCount(chapter.body)} 字 · ${formatDate(chapter.updatedAt)}</p>
        </article>
      `
    )
    .join("");
};

export const renderFocusEditor = () => {
  const chapter = currentChapter();
  const state = getState();
  if (!chapter || chapter.bookId !== activeBookId()) {
    const fallback = state.chapters.find((item) => item.bookId === activeBookId());
    selectedChapterId = fallback?.id || null;
  }

  const activeChapter = currentChapter();
  dom.focusChapterTitleInput.disabled = !activeChapter;
  dom.focusChapterBodyInput.disabled = !activeChapter;
  dom.focusChapterTitleInput.value = activeChapter?.title || "";
  dom.focusChapterBodyInput.value = activeChapter?.body || "";
  dom.focusChapterWordCount.textContent = `${wordCount(activeChapter?.body || "")} 字`;
};

export const renderFocusReferences = () => {
  const text = dom.focusChapterBodyInput.value;
  const state = getState();
  const bookId = activeBookId();
  
  let bookItems = bookId 
    ? state.libraryItems.filter((item) => item.bookId === bookId)
    : state.libraryItems;

  if (referenceModuleFilters.length > 0) {
    bookItems = bookItems.filter((item) => referenceModuleFilters.includes(item.module));
  }

  const scored = bookItems
    .map((item) => {
      const terms = [item.title, ...(item.tags || [])].filter(Boolean);
      const textLower = text.toLowerCase();
      const score = terms.reduce((sum, term) => {
        const normalized = String(term).toLowerCase();
        return sum + (normalized && textLower.includes(normalized) ? 2 : 0);
      }, 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, 8);

  const modules = getModules();
  
  const filterBar = `
    <div class="reference-filter-bar">
      <button class="filter-chip ${referenceModuleFilters.length === 0 ? "active" : ""}" data-action="focus-toggle-reference-filter" data-id="all" type="button">全部</button>
      ${modules.map((module) => {
        const count = bookItems.filter((item) => item.module === module.id).length;
        const isActive = referenceModuleFilters.includes(module.id);
        return `
          <button class="filter-chip ${isActive ? "active" : ""}" 
                  data-action="focus-toggle-reference-filter" 
                  data-id="${module.id}" 
                  type="button"
                  style="--chip-color: ${module.color}">
            ${module.name} (${count})
          </button>
        `;
      }).join("")}
    </div>
  `;

  if (!scored.length) {
    dom.focusReferenceList.innerHTML = `${filterBar}<div class="empty-state">当前作品暂无可引用设定。</div>`;
    return;
  }

  dom.focusReferenceModuleFilter.innerHTML = filterBar;
  dom.focusReferenceList.innerHTML = scored
    .map(({ item, score }) => {
      const scoreText = score > 0 ? "相关" : getModuleName(item.module);
      return `
        <article class="reference-card">
          <div class="card-title-row">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="status-pill">${scoreText}</span>
          </div>
          <p class="card-text">${escapeHtml(item.content.slice(0, 130))}${item.content.length > 130 ? "..." : ""}</p>
          <div class="tag-row">${(item.tags || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
      `;
    })
    .join("");
};