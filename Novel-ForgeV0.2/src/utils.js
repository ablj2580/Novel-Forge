export const nowIso = () => new Date().toISOString();

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const wordCount = (text) => {
  const normalized = (text || "").trim();
  if (!normalized) return 0;
  const cjk = normalized.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const latin = normalized.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g)?.length || 0;
  return cjk + latin;
};

export const escapeHtml = (text) => {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

export const formatDate = (iso) => {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
};

export const highlightSearchTerm = (text, query) => {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
};

// 匹配 http(s):// 开头的链接，到下一个空白、中英文括号/标点为止
// 不识别裸域名（example.com），避免误判书名/缩写
const URL_REGEX = /(https?:\/\/[^\s<>"'，。；：？！、）】」』）)\]}>]+)/g;

// 转义 HTML + 自动识别链接 + 可选搜索高亮
// 顺序：按 URL 分段 → URL 段渲染成 <a>；非 URL 段先 escapeHtml，再可选地加 <mark>
export const renderRichText = (text, query = "") => {
  const source = String(text || "");
  if (!source) return "";

  const highlight = (escaped) => {
    if (!query) return escaped;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.replace(new RegExp(`(${safeQuery})`, "gi"), "<mark>$1</mark>");
  };

  let out = "";
  let last = 0;
  let m;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(source)) !== null) {
    if (m.index > last) {
      out += highlight(escapeHtml(source.slice(last, m.index)));
    }
    const url = m[0];
    const safeUrl = escapeHtml(url);
    out += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="ext-link">${safeUrl}</a>`;
    last = m.index + url.length;
  }
  if (last < source.length) {
    out += highlight(escapeHtml(source.slice(last)));
  }

  // 保留换行
  return out.replace(/\n/g, "<br>");
};