import { initState, getState, getApiConfig, setApiConfig, persist, persistApiConfig, activeBookId, getModules, getModuleName, addActivity, toggleLibraryItemFavorite, toggleRelationFavorite, getFavoriteRelations, toggleReferenceHighlight } from './state.js';
import { dom } from './dom.js';
import { wordCount, nowIso, uid, clamp, escapeHtml } from './utils.js';
import { BOOK_COVER_COLORS, DEFAULT_MODULES, DEFAULT_API_ENDPOINT, DEFAULT_API_MODEL, DEFAULT_PROMPT } from './constants.js';
import { classifyNote, classifyWithApi, getFriendlyApiError, analyzeNewSettings, setAddLog } from './api.js';
import { showToast, addLog, clearLogs, switchView, render, getSelectedNoteId, setSelectedNoteId, setSelectedModuleId, setSelectedChapterId, getSelectedChapterId, setReferenceModuleFilters, getReferenceModuleFilters, toggleReferenceFilter, setLogFilter, showModuleDialog, currentChapter, updateSearchUI, renderSearchSuggestions, hideSearchSuggestions, switchToFocusMode, exitFocusMode, toggleFocusChaptersPanel, toggleFocusReferencesPanel, renderFocusMode, renderFocusChapters, renderFocusEditor, renderFocusReferences, renderReferences, toggleFavoritesOnly, renderChapterHighlight } from './render.js';
import { renderRelationGraph, setSelectedRelationItem, addRelation, showAddRelationModal, getSelectedRelationItem } from './relation.js';

let saveTimer = null;

export const createIdea = ({ review = false } = {}) => {
  const title = dom.ideaTitleInput.value.trim() || "未命名灵感";
  const content = dom.ideaContentInput.value.trim();
  if (!content) {
    showToast("先写一点灵感内容。");
    return null;
  }

  const note = {
    id: uid("note"),
    bookId: activeBookId(),
    title,
    content,
    status: "inbox",
    aiStatus: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    suggestion: null
  };
  const state = getState();
  state.notes.unshift(note);
  addActivity(`捕捉灵感：${title}`);
  dom.ideaTitleInput.value = "";
  dom.ideaContentInput.value = "";
  persist();
  render();

  if (review) reviewNote(note.id);
  else showToast("已保存到灵感收件箱。");
  return note;
};

export const reviewNote = async (noteId) => {
  const state = getState();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;

  note.status = "processing";
  note.aiStatus = "processing";
  note.updatedAt = nowIso();
  persist();
  render();
  note.suggestion = await classifyNote(note);
  note.status = "suggested";
  note.aiStatus = "done";
  addActivity(`AI 审阅灵感：${note.title}`);
  persist();
  render();
  showToast("AI 审阅完成，等待你确认。");
};

export const reviewAllNotes = async () => {
  const state = getState();
  const targets = state.notes.filter((note) => note.status === "inbox");
  if (!targets.length) {
    showToast("没有新的灵感需要审阅。");
    return;
  }

  showToast(`开始审阅 ${targets.length} 条灵感。`);
  for (const note of targets) {
    note.status = "processing";
    note.aiStatus = "processing";
    note.updatedAt = nowIso();
    persist();
    render();
    note.suggestion = await classifyNote(note);
    note.status = "suggested";
    note.aiStatus = "done";
  }
  addActivity(`批量审阅 ${targets.length} 条灵感`);
  persist();
  render();
  showToast("批量审阅完成。");
};

export const acceptSuggestion = (noteId) => {
  const state = getState();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note?.suggestion) return;

  const suggestion = note.suggestion;
  const item = {
    id: uid("item"),
    bookId: suggestion.bookId,
    module: suggestion.module,
    category: suggestion.module,
    title: suggestion.title,
    content: suggestion.summary || note.content,
    tags: suggestion.tags || [],
    aiConfidence: suggestion.confidence || 0.7,
    noteId: note.id,
    sourceNoteId: note.id,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  state.libraryItems.unshift(item);
  createStructuredItemFromIdea(item);
  note.status = "archived";
  note.aiStatus = "done";
  note.updatedAt = nowIso();
  
  if (getSelectedNoteId() === noteId) {
    setSelectedNoteId(null);
  }
  
  setSelectedModuleId(suggestion.module);
  addActivity(`归档到${getModuleName(suggestion.module)}：${item.title}`);
  persist();
  render();
  showToast("已归档到设定资料库。");
};

const createStructuredItemFromIdea = (item) => {
  const state = getState();
  if (item.module === "characters") {
    state.characters.unshift({
      id: uid("character"),
      bookId: item.bookId,
      ideaId: item.id,
      name: item.title,
      role: item.tags?.includes("反派") ? "反派" : item.tags?.includes("主角") ? "主角" : "待定",
      background: item.content,
      personality: "",
      abilities: "",
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  if (item.module === "world") {
    state.worldbuilding.unshift({
      id: uid("world"),
      bookId: item.bookId,
      ideaId: item.id,
      term: item.title,
      category: item.tags?.[0] || "世界观",
      description: item.content,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
};

export const dismissSuggestion = (noteId) => {
  const state = getState();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  note.status = "inbox";
  note.suggestion = null;
  note.updatedAt = nowIso();
  persist();
  render();
};

export const archiveNote = (noteId) => {
  const state = getState();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;
  note.status = "archived";
  note.updatedAt = nowIso();
  if (getSelectedNoteId() === noteId) setSelectedNoteId(null);
  persist();
  render();
  showToast("已隐藏这条灵感。");
};

export const editNote = (noteId) => {
  const titleInput = document.getElementById('noteTitleInput');
  const contentInput = document.getElementById('noteContentInput');
  const bookSelect = document.getElementById('noteBookSelect');
  const moduleSelect = document.getElementById('noteModuleSelect');
  const tagsInput = document.getElementById('noteTagsInput');
  const tagsDisplay = document.getElementById('noteTagsDisplay');
  const editBtn = document.querySelector('[data-action="edit-note"]');
  
  if (!titleInput || !contentInput || !editBtn) return;
  
  if (titleInput.readOnly) {
    titleInput.readOnly = false;
    contentInput.readOnly = false;
    if (bookSelect) {
      bookSelect.disabled = false;
    }
    if (moduleSelect) {
      moduleSelect.disabled = false;
    }
    if (tagsInput) {
      tagsInput.readOnly = false;
    }
    if (tagsDisplay) {
      tagsDisplay.style.display = 'none';
    }
    titleInput.focus();
    editBtn.textContent = '保存';
    editBtn.classList.remove('secondary-button');
    editBtn.classList.add('primary-button');
  } else {
    const state = getState();
    const note = state.notes.find((item) => item.id === noteId);
    if (!note) return;
    
    note.title = titleInput.value.trim() || "未命名";
    note.content = contentInput.value.trim();
    
    if (bookSelect && note.suggestion) {
      note.suggestion.bookId = bookSelect.value;
    }
    
    if (moduleSelect && note.suggestion) {
      note.suggestion.module = moduleSelect.value;
    }
    
    if (tagsInput && note.suggestion) {
      const tags = tagsInput.value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      note.suggestion.tags = tags;
    }
    
    note.updatedAt = nowIso();
    
    persist();
    render();
    showToast("已保存修改。");
  }
};

export const createBook = () => {
  const title = dom.bookTitleInput.value.trim();
  if (!title) return;
  const book = {
    id: uid("book"),
    title,
    genre: dom.bookGenreInput.value.trim(),
    status: dom.bookStatusInput.value,
    coverColor: dom.bookColorInput.value || BOOK_COVER_COLORS[getState().books.length % BOOK_COVER_COLORS.length],
    coverImage: null,
    premise: dom.bookPremiseInput.value.trim(),
    modules: [...DEFAULT_MODULES],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const state = getState();
  state.books.unshift(book);
  state.activeBookId = book.id;
  setSelectedChapterId(null);
  addActivity(`创建作品《${book.title}》`);
  persist();
  dom.bookForm.reset();
  dom.bookColorInput.value = BOOK_COVER_COLORS[state.books.length % BOOK_COVER_COLORS.length];
  render();
  showToast("作品已创建。");
};

export const deleteBook = (bookId) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  
  if (state.books.length <= 1) {
    showToast("至少保留一个作品。");
    return;
  }

  if (!confirm(`确定要删除作品《${book.title}》吗？此操作无法撤销，相关的笔记、设定和章节都将被删除。`)) {
    return;
  }

  state.books = state.books.filter((b) => b.id !== bookId);
  state.notes = state.notes.filter((note) => note.bookId !== bookId);
  state.libraryItems = state.libraryItems.filter((item) => item.bookId !== bookId);
  state.characters = state.characters.filter((char) => char.bookId !== bookId);
  state.worldbuilding = state.worldbuilding.filter((wb) => wb.bookId !== bookId);
  state.chapters = state.chapters.filter((ch) => ch.bookId !== bookId);

  if (state.activeBookId === bookId) {
    state.activeBookId = state.books[0]?.id || null;
    setSelectedChapterId(state.chapters.find((chapter) => chapter.bookId === state.activeBookId)?.id || null);
  }

  addActivity(`删除作品《${book.title}》`);
  persist();
  render();
  showToast("作品已删除。");
};

export const changeBookColor = (bookId, color) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  book.coverColor = color;
  book.updatedAt = nowIso();
  persist();
  render();
};

export const editBookField = (bookId, field, value) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  book[field] = value;
  book.updatedAt = nowIso();
  persist();
  render();
};

export const uploadBookCover = (bookId, file) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    showCropDialog(e.target.result, bookId);
  };
  reader.onerror = () => {
    showToast("上传失败，请选择有效的图片文件。");
  };
  reader.readAsDataURL(file);
};

const showCropDialog = (imageSrc, bookId) => {
  const dialog = document.createElement("dialog");
  dialog.className = "modal wide";
  dialog.id = "cropDialog";
  dialog.innerHTML = `
    <div class="crop-container">
      <div class="modal-heading">
        <h2>裁剪封面图片</h2>
        <button class="icon-button crop-close-btn" type="button">×</button>
      </div>
      <div class="crop-area">
        <div class="crop-frame" id="cropFrame">
          <img id="cropImage" src="${imageSrc}" alt="待裁剪图片" />
        </div>
        <div class="crop-hint">拖动图片调整裁剪区域</div>
        <div class="crop-controls">
          <input type="range" id="cropZoom" min="1" max="4" step="0.1" value="1.5" />
          <div class="crop-actions">
            <button class="secondary-button crop-cancel-btn" type="button">取消</button>
            <button class="primary-button crop-apply-btn" type="button">应用裁剪</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  
  const cropImage = document.getElementById("cropImage");
  const cropFrame = document.getElementById("cropFrame");
  const cropZoom = document.getElementById("cropZoom");
  const closeBtn = dialog.querySelector(".crop-close-btn");
  const cancelBtn = dialog.querySelector(".crop-cancel-btn");
  const applyBtn = dialog.querySelector(".crop-apply-btn");
  
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  
  const updateImagePosition = () => {
    const scale = parseFloat(cropZoom.value);
    const scaledWidth = cropImage.naturalWidth * scale;
    const scaledHeight = cropImage.naturalHeight * scale;
    
    const centerX = (cropFrame.offsetWidth - scaledWidth) / 2;
    const centerY = (cropFrame.offsetHeight - scaledHeight) / 2;
    
    cropImage.style.transform = `translate(${centerX + offsetX}px, ${centerY + offsetY}px) scale(${scale})`;
  };
  
  cropImage.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    cropImage.style.cursor = "grabbing";
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    updateImagePosition();
  });
  
  document.addEventListener("mouseup", () => {
    isDragging = false;
    cropImage.style.cursor = "grab";
  });
  
  cropZoom.addEventListener("input", updateImagePosition);
  
  const closeDialog = () => {
    dialog.close();
  };
  
  const handleApply = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    const coverWidth = 1920;
    const coverHeight = 1080;
    
    canvas.width = coverWidth;
    canvas.height = coverHeight;
    
    const img = cropImage;
    
    if (img.naturalWidth <= coverWidth && img.naturalHeight <= coverHeight) {
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const coverRatio = coverWidth / coverHeight;
      
      if (imgRatio >= coverRatio) {
        const scale = coverHeight / img.naturalHeight;
        const scaledWidth = img.naturalWidth * scale;
        const offsetX = (coverWidth - scaledWidth) / 2;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, offsetX, 0, scaledWidth, coverHeight);
      } else {
        const scale = coverWidth / img.naturalWidth;
        const scaledHeight = img.naturalHeight * scale;
        const offsetY = (coverHeight - scaledHeight) / 2;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, offsetY, coverWidth, scaledHeight);
      }
    } else {
      const scale = parseFloat(cropZoom.value);
      const frameWidth = cropFrame.offsetWidth;
      const frameHeight = cropFrame.offsetHeight;
      
      const scaledWidth = img.naturalWidth * scale;
      const scaledHeight = img.naturalHeight * scale;
      
      const centerX = (frameWidth - scaledWidth) / 2;
      const centerY = (frameHeight - scaledHeight) / 2;
      
      const sourceX = (-centerX - offsetX) / scale;
      const sourceY = (-centerY - offsetY) / scale;
      const sourceWidth = frameWidth / scale;
      const sourceHeight = frameHeight / scale;
      
      const actualSourceX = Math.max(0, Math.min(sourceX, img.naturalWidth - sourceWidth));
      const actualSourceY = Math.max(0, Math.min(sourceY, img.naturalHeight - sourceHeight));
      const actualSourceWidth = Math.min(sourceWidth, img.naturalWidth);
      const actualSourceHeight = Math.min(sourceHeight, img.naturalHeight);
      
      ctx.drawImage(
        img,
        actualSourceX,
        actualSourceY,
        actualSourceWidth,
        actualSourceHeight,
        0,
        0,
        coverWidth,
        coverHeight
      );
    }
    
    const croppedImage = canvas.toDataURL("image/jpeg", 0.95);
    
    const state = getState();
    const book = state.books.find((b) => b.id === bookId);
    if (book) {
      book.coverImage = croppedImage;
      book.updatedAt = nowIso();
      persist();
      render();
      showToast("封面上传成功。");
    }
    
    closeDialog();
  };
  
  closeBtn.addEventListener("click", closeDialog);
  cancelBtn.addEventListener("click", closeDialog);
  applyBtn.addEventListener("click", handleApply);
  
  dialog.showModal();
  
  dialog.addEventListener("close", () => {
    dialog.remove();
    document.removeEventListener("mousemove", () => {});
    document.removeEventListener("mouseup", () => {});
  });
  
  cropImage.onload = () => {
    const frameRatio = cropFrame.offsetWidth / cropFrame.offsetHeight;
    const imgRatio = cropImage.naturalWidth / cropImage.naturalHeight;
    
    let scale;
    if (imgRatio >= frameRatio) {
      scale = cropFrame.offsetWidth / cropImage.naturalWidth;
    } else {
      scale = cropFrame.offsetHeight / cropImage.naturalHeight;
    }
    
    offsetX = 0;
    offsetY = 0;
    cropZoom.value = scale;
    updateImagePosition();
  };
  
  cropImage.style.cursor = "grab";
};

export const removeBookCover = (bookId) => {
  const state = getState();
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return;
  book.coverImage = null;
  book.updatedAt = nowIso();
  persist();
  render();
  showToast("已恢复为默认封面。");
};

export const createLibraryItem = () => {
  const title = dom.manualItemTitleInput.value.trim();
  const content = dom.manualItemContentInput.value.trim();
  if (!title || !content) return;

  const state = getState();
  state.libraryItems.unshift({
    id: uid("item"),
    bookId: activeBookId(),
    module: getSelectedModuleId(),
    title,
    content,
    tags: dom.manualItemTagsInput.value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    sourceNoteId: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  addActivity(`手动新增${getModuleName(getSelectedModuleId())}：${title}`);
  persist();
  dom.manualItemForm.reset();
  render();
  showToast("资料已加入当前模块。");
};

export const deleteLibraryItem = (itemId) => {
  const state = getState();
  const item = state.libraryItems.find((entry) => entry.id === itemId);
  state.libraryItems = state.libraryItems.filter((entry) => entry.id !== itemId);
  addActivity(`删除资料：${item?.title || "未命名"}`);
  persist();
  render();
};

export const showFavoriteRelationsDialog = () => {
  const favorites = getFavoriteRelations();
  document.getElementById('addRelationMenu')?.classList.add('hidden');
  
  if (!favorites.length) {
    showToast('暂无收藏的关系图谱');
    return;
  }
  
  const itemsHtml = favorites.map(fav => `
    <div class="favorite-relation-item" data-item-id="${fav.itemId}">
      <span class="favorite-relation-title">${escapeHtml(fav.title)}</span>
      <span class="favorite-relation-date">收藏于 ${new Date(fav.createdAt).toLocaleDateString()}</span>
    </div>
  `).join('');
  
  const dialogHtml = `
    <div id="favoriteRelationsDialog" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>★ 收藏的图谱</h3>
          <button class="modal-close-btn" type="button">✕</button>
        </div>
        <div class="modal-body">
          ${itemsHtml}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', dialogHtml);
  
  const dialog = document.getElementById('favoriteRelationsDialog');
  const closeBtn = dialog.querySelector('.modal-close-btn');
  
  closeBtn.addEventListener('click', () => {
    dialog.remove();
  });
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });
  
  dialog.querySelectorAll('.favorite-relation-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.itemId;
      dialog.remove();
      setSelectedRelationItem(itemId);
      renderRelationGraph(itemId);
    });
  });
};

export const rollbackLibraryItem = (itemId) => {
  const state = getState();
  const item = state.libraryItems.find((entry) => entry.id === itemId);
  if (!item) return;

  const note = {
    id: uid("note"),
    bookId: item.bookId,
    title: item.title,
    content: item.content,
    status: "inbox",
    aiStatus: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    suggestion: null
  };

  state.notes.unshift(note);
  state.libraryItems = state.libraryItems.filter((entry) => entry.id !== itemId);
  
  addActivity(`回退资料到收件箱：${item.title}`);
  persist();
  render();
  showToast("已回退到收件箱。");
};

export const analyzeNewSettingsFromChapter = async () => {
  const chapter = currentChapter();
  if (!chapter) {
    showToast("请先选择或创建一个章节。");
    return;
  }

  const content = chapter.body || "";
  const title = chapter.title || "";

  if (!content.trim()) {
    showToast("章节内容为空，无需分析。");
    return;
  }

  showToast("正在分析新设定资源...");

  try {
    const newSettings = await analyzeNewSettings(content, title);
    
    if (!newSettings || newSettings.length === 0) {
      showToast("未发现新的设定资源。");
      return;
    }

    const state = getState();
    const bookId = activeBookId();
    
    newSettings.forEach((setting) => {
      const note = {
        id: uid("note"),
        bookId: bookId,
        title: setting.title || "未命名设定",
        content: setting.content || "",
        status: "inbox",
        aiStatus: "reviewing",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        suggestion: {
          bookId: bookId,
          module: setting.module || "scenes",
          title: setting.title || "未命名设定",
          summary: setting.content || "",
          tags: setting.tags || [],
          confidence: 0.8,
          reason: setting.reason || "AI分析发现的新设定",
          conflicts: []
        }
      };
      state.notes.unshift(note);
    });

    addActivity(`AI分析发现 ${newSettings.length} 个新设定资源`);
    persist();
    render();
    showToast(`发现 ${newSettings.length} 个新设定资源，已放入待确认建议。`);
    
  } catch (error) {
    console.warn(error);
    showToast(`分析失败：${getFriendlyApiError(error)}`);
  }
};

export const editLibraryItem = (itemId) => {
  const existingDialog = document.getElementById("editLibraryItemDialog");
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const state = getState();
  const item = state.libraryItems.find((i) => i.id === itemId);
  if (!item) return;
  
  const isProtagonist = item.tags?.includes("主角") || false;
  
  const dialogHTML = `
    <dialog id="editLibraryItemDialog" class="modal wide">
      <form method="dialog" id="editLibraryItemForm">
        <div class="modal-heading">
          <h2>编辑设定资料</h2>
          <button type="button" class="close-button" onclick="document.getElementById('editLibraryItemDialog').close()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>标题</label>
            <input type="text" id="editItemTitleInput" value="${escapeHtml(item.title)}" placeholder="输入标题" />
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea id="editItemContentInput" rows="8" placeholder="输入内容">${escapeHtml(item.content)}</textarea>
          </div>
          <div class="form-group">
            <label>标签（用逗号分隔）</label>
            <input type="text" id="editItemTagsInput" value="${(item.tags || []).filter(t => t !== "主角").join(", ")}" placeholder="标签1, 标签2, 标签3" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="editItemIsProtagonist" ${isProtagonist ? "checked" : ""} />
              <span>设为本书主角</span>
              <span class="checkbox-hint">每本书只能有一个主角</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="submit" value="cancel" class="ghost-button">取消</button>
          <button type="submit" value="save" class="primary-button">保存</button>
        </div>
      </form>
    </dialog>
  `;
  
  document.body.insertAdjacentHTML("beforeend", dialogHTML);
  
  document.getElementById("editLibraryItemForm").addEventListener("submit", function(e) {
    if (e.submitter?.value === "cancel") {
      document.getElementById("editLibraryItemDialog").close();
      return;
    }
    e.preventDefault();
    
    const title = document.getElementById("editItemTitleInput").value.trim();
    const content = document.getElementById("editItemContentInput").value.trim();
    const tags = document.getElementById("editItemTagsInput").value.split(",").map((t) => t.trim()).filter(Boolean);
    const setAsProtagonist = document.getElementById("editItemIsProtagonist").checked;
    
    if (!content) {
      showToast("请输入内容");
      return;
    }
    
    const bookId = activeBookId();
    
    if (setAsProtagonist) {
      state.libraryItems.forEach(item => {
        if (item.bookId === bookId && item.tags?.includes("主角")) {
          item.tags = item.tags.filter(t => t !== "主角");
          item.updatedAt = nowIso();
        }
      });
      tags.push("主角");
    }
    
    const updatedItem = state.libraryItems.find((i) => i.id === itemId);
    if (updatedItem) {
      updatedItem.title = title || "未命名";
      updatedItem.content = content;
      updatedItem.tags = tags;
      updatedItem.updatedAt = nowIso();
    }
    
    persist();
    render();
    showToast("已保存");
    
    document.getElementById("editLibraryItemDialog").close();
  });
  
  document.getElementById("editLibraryItemDialog").showModal();
};

export const createChapter = () => {
  const state = getState();
  const chapters = state.chapters.filter((chapter) => chapter.bookId === activeBookId());
  const chapter = {
    id: uid("chapter"),
    bookId: activeBookId(),
    title: `第 ${chapters.length + 1} 章`,
    body: "",
    order: chapters.length + 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.chapters.push(chapter);
  setSelectedChapterId(chapter.id);
  addActivity(`新建章节：${chapter.title}`);
  persist();
  render();
  dom.chapterTitleInput.focus();
};

export const updateChapter = () => {
  const chapter = currentChapter();
  if (!chapter) return;

  chapter.title = dom.chapterTitleInput.value;
  chapter.body = dom.chapterBodyInput.innerText || dom.chapterBodyInput.textContent || "";
  chapter.updatedAt = nowIso();
  dom.chapterWordCount.textContent = `${wordCount(chapter.body)} 字`;
  dom.saveState.textContent = "保存中...";

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persist();
    dom.saveState.textContent = "已自动保存";
  }, 360);
};

export const updateFocusChapter = () => {
  const chapter = currentChapter();
  if (!chapter) return;

  chapter.title = dom.focusChapterTitleInput.value;
  chapter.body = dom.focusChapterBodyInput.innerText || dom.focusChapterBodyInput.textContent || "";
  chapter.updatedAt = nowIso();
  dom.focusChapterWordCount.textContent = `${wordCount(chapter.body)} 字`;
  dom.focusSaveState.textContent = "保存中...";

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persist();
    dom.focusSaveState.textContent = "已自动保存";
  }, 360);
};

export const updateChapterHighlightOnInput = () => {
  const text = dom.chapterBodyInput.innerText || dom.chapterBodyInput.textContent || "";
  renderChapterHighlight(text, false);
};

export const updateFocusChapterHighlightOnInput = () => {
  const text = dom.focusChapterBodyInput.innerText || dom.focusChapterBodyInput.textContent || "";
  renderChapterHighlight(text, true);
};

export const exportData = () => {
  const payload = {
    exportedAt: nowIso(),
    state: getState(),
    apiConfig: { ...getApiConfig(), apiKey: "" }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `novel-forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const importData = async (file) => {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload.state?.books || !payload.state?.notes) {
    showToast("备份格式不正确。");
    return;
  }
  const state = getState();
  Object.assign(state, payload.state);
  setSelectedChapterId(state.chapters.find((chapter) => chapter.bookId === activeBookId())?.id || null);
  setSelectedNoteId(null);
  persist();
  render();
  showToast("备份已导入。");
};

export const fillApiForm = () => {
  const config = getApiConfig();
  dom.apiEndpointInput.value = config.endpoint || DEFAULT_API_ENDPOINT;
  dom.apiModelInput.value = config.model || DEFAULT_API_MODEL;
  dom.apiKeyInput.value = config.apiKey || "";
  dom.apiPromptInput.value = config.prompt || DEFAULT_PROMPT;
};

export const testApi = async () => {
  const config = {
    endpoint: dom.apiEndpointInput.value.trim() || DEFAULT_API_ENDPOINT,
    model: dom.apiModelInput.value.trim() || DEFAULT_API_MODEL,
    apiKey: dom.apiKeyInput.value.trim(),
    prompt: dom.apiPromptInput.value.trim() || DEFAULT_PROMPT
  };
  try {
    const testNote = { title: "测试灵感", content: "主角获得一个需要付出代价的系统能力。" };
    await classifyWithApi(testNote);
    showToast("连接成功。");
  } catch (error) {
    console.warn(error);
    showToast(`连接失败：${getFriendlyApiError(error)}`);
  }
};

const bindEvents = () => {
  dom.navItems.forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  dom.newBookButton.addEventListener("click", () => dom.bookDialog.showModal());
  dom.newBookButtonMain.addEventListener("click", () => dom.bookDialog.showModal());
  dom.bookDialogClose?.addEventListener("click", () => dom.bookDialog.close());
  dom.apiButton.addEventListener("click", () => {
    fillApiForm();
    dom.apiDialog.showModal();
  });
  dom.exportButton.addEventListener("click", exportData);
  dom.importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importData(file).catch(() => showToast("导入失败。"));
    event.target.value = "";
  });
  dom.settingsButton?.addEventListener("click", () => switchView("settings"));
  dom.saveIdeaButton.addEventListener("click", () => createIdea());
  dom.saveAndReviewButton.addEventListener("click", () => createIdea({ review: true }));
  dom.quickReviewButton.addEventListener("click", reviewAllNotes);
  dom.reviewAllButton.addEventListener("click", reviewAllNotes);
  dom.inboxReviewButton.addEventListener("click", reviewAllNotes);
  dom.searchInput.addEventListener("input", () => {
    render();
    updateSearchUI();
    renderSearchSuggestions();
  });
  
  dom.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      dom.searchInput.blur();
      hideSearchSuggestions();
    } else if (event.key === "Escape") {
      hideSearchSuggestions();
    }
  });
  
  dom.searchButton?.addEventListener("click", () => {
    render();
    dom.searchInput.focus();
    renderSearchSuggestions();
  });
  
  dom.clearSearchButton?.addEventListener("click", () => {
    dom.searchInput.value = "";
    render();
    updateSearchUI();
    hideSearchSuggestions();
  });
  
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action='jump-to-library-item']");
    if (target) {
      const { id, bookid, moduleid } = target.dataset;
      const state = getState();
      state.activeBookId = bookid;
      setSelectedModuleId(moduleid);
      switchView("library");
      dom.searchInput.value = "";
      updateSearchUI();
      hideSearchSuggestions();
      persist();
      render();
      
      setTimeout(() => {
        const element = document.querySelector(`[data-action="edit-library-item"][data-id="${id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  });
  
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrapper")) {
      hideSearchSuggestions();
    }
  });

  dom.newLibraryItemButton.addEventListener("click", () => dom.manualItemDialog.showModal());
  const manualItemDialogClose = document.querySelector("#manualItemDialog .close-button, #manualItemDialog .icon-button[value='cancel']");
  manualItemDialogClose?.addEventListener("click", () => dom.manualItemDialog.close());
  dom.newChapterButton.addEventListener("click", createChapter);
  dom.refreshReferencesButton.addEventListener("click", () => render());
  dom.chapterTitleInput.addEventListener("input", updateChapter);
  dom.chapterBodyInput.addEventListener("input", updateChapter);
  dom.chapterBodyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });
  dom.testApiButton.addEventListener("click", testApi);
  
  dom.focusChaptersButton?.addEventListener("click", toggleFocusChaptersPanel);
  dom.focusReferencesButton?.addEventListener("click", toggleFocusReferencesPanel);
  dom.exitFocusModeButton?.addEventListener("click", exitFocusMode);
  dom.focusNewChapterButton?.addEventListener("click", () => {
    createChapter();
    renderFocusChapters();
  });
  dom.focusChapterTitleInput?.addEventListener("input", updateFocusChapter);
  dom.focusChapterBodyInput?.addEventListener("input", updateFocusChapter);
  dom.focusChapterBodyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });

  dom.bookForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") {
      dom.bookDialog.close();
      return;
    }
    event.preventDefault();
    createBook();
    dom.bookDialog.close();
  });

  dom.apiForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const newConfig = {
      endpoint: dom.apiEndpointInput.value.trim() || DEFAULT_API_ENDPOINT,
      model: dom.apiModelInput.value.trim() || DEFAULT_API_MODEL,
      apiKey: dom.apiKeyInput.value.trim(),
      prompt: dom.apiPromptInput.value.trim() || DEFAULT_PROMPT
    };
    setApiConfig(newConfig);
    persistApiConfig();
    dom.apiDialog.close();
    render();
    showToast("AI 接口设置已保存。");
  });

  dom.manualItemForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") {
      dom.manualItemDialog.close();
      return;
    }
    event.preventDefault();
    createLibraryItem();
    dom.manualItemDialog.close();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;

    if (action === "accept-suggestion") acceptSuggestion(id);
    if (action === "rerun-review") reviewNote(id);
    if (action === "dismiss-suggestion") dismissSuggestion(id);
    if (action === "archive-note") archiveNote(id);
    if (action === "edit-note") editNote(id);
    if (action === "select-note") {
      setSelectedNoteId(id);
      render();
    }
    if (action === "select-book-card") {
      const state = getState();
      state.activeBookId = id;
      setSelectedChapterId(state.chapters.find((chapter) => chapter.bookId === activeBookId())?.id || null);
      setReferenceModuleFilters([]);
      setSelectedRelationItem(null);
      persist();
      render();
      showToast("已切换当前作品。");
    }
    if (action === "select-book") {
      const state = getState();
      state.activeBookId = id;
      setSelectedChapterId(state.chapters.find((chapter) => chapter.bookId === activeBookId())?.id || null);
      setReferenceModuleFilters([]);
      setSelectedRelationItem(null);
      persist();
      render();
    }
    if (action === "clear-logs") {
      if (confirm("确定要清空所有日志吗？")) {
        clearLogs();
        showToast("日志已清空。");
      }
    }
    if (action === "set-log-filter") {
      setLogFilter(id);
    }
    if (action === "toggle-log-details") {
      const element = document.getElementById(`log-details-${id}`);
      if (element) {
        element.style.display = element.style.display === "none" ? "block" : "none";
      }
    }
    if (action === "select-module") {
      setSelectedModuleId(id);
      render();
    }
    if (action === "add-module") {
      showModuleDialog();
    }
    if (action === "edit-module") {
      showModuleDialog(id);
    }
    if (action === "delete-module") {
      const module = getModules().find((m) => m.id === id);
      if (!module) return;
      const state = getState();
      const book = state.books.find((b) => b.id === activeBookId());
      if (!book) return;
      const count = state.libraryItems.filter((item) => item.bookId === activeBookId() && item.module === id).length;
      const confirmMsg = count > 0 
        ? `该模块下有 ${count} 条资料，删除后这些资料将被归类到「场景片段」，确定删除吗？`
        : "确定删除该模块吗？";
      if (!confirm(confirmMsg)) return;
      book.modules = getModules().filter((m) => m.id !== id);
      book.updatedAt = nowIso();
      if (getSelectedModuleId() === id) {
        setSelectedModuleId(book.modules[0]?.id || null);
      }
      state.libraryItems = state.libraryItems.map((item) =>
        item.bookId === activeBookId() && item.module === id ? { ...item, module: "scenes" } : item
      );
      setReferenceModuleFilters(getReferenceModuleFilters().filter((f) => f !== id));
      persist();
      render();
      showToast(`已删除模块「${module.name}」`);
    }
    if (action === "toggle-reference-filter") {
      toggleReferenceFilter(id);
      render();
    }
    if (action === "focus-toggle-reference-filter") {
      toggleReferenceFilter(id);
      renderFocusReferences();
    }
    if (action === "toggle-favorites-only") {
      toggleFavoritesOnly();
      render();
    }
    if (action === "toggle-library-favorite") {
      toggleLibraryItemFavorite(id);
      render();
    }
    if (action === "toggle-relation-favorite") {
      const isFavorite = toggleRelationFavorite(id);
      showToast(isFavorite ? "已收藏关系图谱" : "已取消收藏");
      render();
    }
    if (action === "toggle-reference-highlight") {
      toggleReferenceHighlight(id);
      const activeChapter = getState().chapters.find(c => c.id === getSelectedChapterId());
      
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      
      if (dom.chapterBodyInput) {
        renderChapterHighlight(activeChapter?.body || "", false);
      }
      
      if (dom.focusChapterBodyInput) {
        renderChapterHighlight(activeChapter?.body || "", true);
      }
      
      if (range) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      renderReferences();
      renderFocusReferences();
    }
    if (action === "show-favorite-relations") {
      showFavoriteRelationsDialog();
    }
    if (action === "add-relation") {
      document.getElementById('addRelationMenu')?.classList.add('hidden');
      showAddRelationModal(getSelectedRelationItem());
    }
    if (action === "view-relations") {
      setSelectedRelationItem(id);
      switchView("relation");
    }
    if (action === "select-relation-item") {
      setSelectedRelationItem(id);
      renderRelationGraph(id);
    }
    if (action === "edit-library-item") editLibraryItem(id);
    if (action === "rollback-library-item") rollbackLibraryItem(id);
    if (action === "delete-library-item") deleteLibraryItem(id);
    if (action === "delete-book") deleteBook(id);
    if (action === "analyze-new-settings") analyzeNewSettingsFromChapter();
    if (action === "select-chapter") {
      setSelectedChapterId(id);
      render();
    }
    if (action === "focus-select-chapter") {
      setSelectedChapterId(id);
      renderFocusMode();
    }
    if (action === "enter-focus-mode") {
      switchToFocusMode();
    }
    if (action === "navigate-to-writing") {
      const state = getState();
      state.activeBookId = id;
      setSelectedChapterId(state.chapters.find((chapter) => chapter.bookId === id)?.id || null);
      persist();
      switchView("writing");
    }
    if (action === "navigate-to-characters") {
      const state = getState();
      state.activeBookId = id;
      setSelectedModuleId("characters");
      persist();
      switchView("library");
    }
    if (action === "navigate-to-library") {
      const state = getState();
      state.activeBookId = id;
      persist();
      switchView("library");
    }
    if (action === "navigate-to-inbox") {
      const state = getState();
      state.activeBookId = id;
      persist();
      switchView("inbox");
    }
    if (action === "remove-book-cover") {
      removeBookCover(id);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;

    if (action === "edit-book-title") {
      editBookField(id, "title", event.target.value);
    }
    if (action === "edit-book-genre") {
      editBookField(id, "genre", event.target.value);
    }
    if (action === "edit-book-status") {
      editBookField(id, "status", event.target.value);
    }
    if (action === "edit-book-color") {
      editBookField(id, "coverColor", event.target.value);
    }
    if (action === "edit-book-premise") {
      editBookField(id, "premise", event.target.value);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;

    if (action === "upload-book-cover") {
      const file = event.target.files?.[0];
      if (file) {
        uploadBookCover(id, file);
      }
      event.target.value = "";
    }
  });
};

const init = async () => {
  setAddLog(addLog);
  await initState();
  const state = getState();
  setSelectedChapterId(state.chapters[0]?.id || null);
  bindEvents();
  
  requestAnimationFrame(() => {
    render();
    
    setTimeout(() => {
      const activeChapter = getState().chapters.find(c => c.id === getSelectedChapterId());
      if (activeChapter) {
        renderChapterHighlight(activeChapter.body || "", false);
        renderChapterHighlight(activeChapter.body || "", true);
      }
    }, 100);
  });
};

document.addEventListener("DOMContentLoaded", init);