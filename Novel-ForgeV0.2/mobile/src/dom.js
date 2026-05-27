/**
 * 移动端 DOM 引用集合 (类似桌面的 src/dom.js)
 *
 * 为什么独立一份:
 *   - 移动端 HTML 类名都以 .m- 前缀,选择器和桌面不重叠
 *   - 桌面端 src/dom.js 引用的元素在移动端不存在(.app-shell、.sidebar 等)
 *   - 模块导出后,移动端 render.js / main.js 统一从这里拿引用
 */

export const mDom = {
  // 应用骨架
  app:        document.querySelector('.m-app'),
  topbar:     document.querySelector('.m-topbar'),
  main:       document.querySelector('.m-main'),
  tabbar:     document.querySelector('.m-tabbar'),

  // 顶栏
  leftAction: document.getElementById('mLeftAction'),
  rightAction:document.getElementById('mRightAction'),
  pageTitle:  document.getElementById('mPageTitle'),

  // 视图容器
  views:      document.querySelectorAll('.m-view'),
  tabs:       document.querySelectorAll('.m-tab'),

  // 各 view
  workspaceView: document.getElementById('mWorkspaceView'),
  writingView:   document.getElementById('mWritingView'),
  inboxView:     document.getElementById('mInboxView'),
  libraryView:   document.getElementById('mLibraryView'),
  moreView:      document.getElementById('mMoreView'),

  // 反馈
  toast:      document.getElementById('mToast'),

  // 左侧抽屉
  drawer:           document.getElementById('mDrawer'),
  drawerBackdrop:   document.getElementById('mDrawerBackdrop'),
  drawerClose:      document.getElementById('mDrawerClose'),
  drawerItems:      document.querySelectorAll('.m-drawer-item'),
  drawerNewBook:    document.getElementById('mDrawerNewBook'),
  drawerBookList:   document.getElementById('mDrawerBookList'),
  drawerFooterBtns: document.querySelectorAll('.m-drawer-footer .m-drawer-action')
};
