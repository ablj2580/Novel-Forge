/**
 * 移动端 DOM 引用集合
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
  booksView:     document.getElementById('mBooksView'),
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
  drawerFooterBtns: document.querySelectorAll('.m-drawer-footer .m-drawer-action'),

  // Sheet
  sheet:          document.getElementById('mSheet'),
  sheetBackdrop:  document.getElementById('mSheetBackdrop'),
  sheetClose:     document.getElementById('mSheetClose'),
  sheetTitle:     document.getElementById('mSheetTitle'),
  sheetAction:    document.getElementById('mSheetAction'),
  sheetBody:      document.getElementById('mSheetBody'),
  sheetFooter:    document.getElementById('mSheetFooter'),

  // Confirm
  confirmBackdrop: document.getElementById('mConfirmBackdrop'),
  confirmTitle:    document.getElementById('mConfirmTitle'),
  confirmMessage:  document.getElementById('mConfirmMessage'),
  confirmCancel:   document.getElementById('mConfirmCancel'),
  confirmOk:       document.getElementById('mConfirmOk'),

  // 导入文件
  importFile:     document.getElementById('mImportFile')
};
