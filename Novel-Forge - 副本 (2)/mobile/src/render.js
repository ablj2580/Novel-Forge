/**
 * 移动端渲染层骨架。
 *
 * 现在只做 view 切换 + toast。
 * 后续接入业务时,从 ../../src/state.js 拉数据后,
 * 在这里写 renderMWorkspace / renderMInbox / renderMLibrary 等。
 */

import { mDom } from './dom.js';

const VIEW_TITLES = {
  workspace: '工作台',
  writing:   '正文写作',
  inbox:     '灵感收件箱',
  library:   '设定资料库',
  more:      '更多'
};

let currentView = 'workspace';
export const getCurrentView = () => currentView;

export function switchView(view) {
  if (!VIEW_TITLES[view]) return;
  currentView = view;

  mDom.pageTitle.textContent = VIEW_TITLES[view];

  mDom.tabs.forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  mDom.views.forEach((v) => v.classList.toggle('active', v.dataset.view === view));

  // 抽屉里的同名导航项也同步 active
  mDom.drawerItems?.forEach((it) => it.classList.toggle('active', it.dataset.view === view));

  // 回到顶部,避免视图切换后停在上一个视图的滚动位置
  if (mDom.main) mDom.main.scrollTop = 0;

  // TODO: 视图首次激活时触发懒加载渲染
  renderActiveView();
}

/* ---------- 左侧抽屉开关 ---------- */

export function openDrawer() {
  if (!mDom.drawer) return;
  mDom.drawer.classList.add('open');
  mDom.drawer.setAttribute('aria-hidden', 'false');
  mDom.drawerBackdrop?.classList.add('show');
  mDom.drawerBackdrop?.setAttribute('aria-hidden', 'false');
  // 抽屉打开时锁住 body 滚动
  document.body.style.overflow = 'hidden';
}

export function closeDrawer() {
  if (!mDom.drawer) return;
  mDom.drawer.classList.remove('open');
  mDom.drawer.setAttribute('aria-hidden', 'true');
  mDom.drawerBackdrop?.classList.remove('show');
  mDom.drawerBackdrop?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function toggleDrawer() {
  if (!mDom.drawer) return;
  if (mDom.drawer.classList.contains('open')) closeDrawer();
  else openDrawer();
}

export const isDrawerOpen = () => !!mDom.drawer?.classList.contains('open');

export function renderActiveView() {
  // 占位 — 接入业务后按 currentView 分派对应渲染函数
  switch (currentView) {
    case 'workspace': /* renderMWorkspace(); */ break;
    case 'writing':   /* renderMWriting(); */ break;
    case 'inbox':     /* renderMInbox(); */ break;
    case 'library':   /* renderMLibrary(); */ break;
    case 'more':      /* renderMMore(); */ break;
  }
}

let toastTimer = null;
export function showToast(message, durationMs = 2200) {
  if (!mDom.toast) return;
  mDom.toast.textContent = message;
  mDom.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => mDom.toast.classList.remove('show'), durationMs);
}
