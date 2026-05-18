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