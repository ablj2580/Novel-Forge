/**
 * 移动端入口。
 *
 * 现在只做:
 *   1. 绑定底部 tab bar 点击 → view 切换
 *   2. 绑定顶栏左右按钮 → 占位(后续接入抽屉 / 搜索)
 *   3. 绑定 "更多" 页设置列表项 → 占位
 *
 * 当要接入业务时:
 *   import { ... } from '../../src/state.js';
 *   import { ... } from '../../src/db.js';
 *   import { ... } from '../../src/api.js';
 *   import { ... } from '../../src/constants.js';
 *   import { ... } from '../../src/utils.js';
 * 共享业务层在这里 import,渲染细节走 ./render.js。
 */

import { mDom } from './dom.js';
import {
  switchView,
  showToast,
  openDrawer,
  closeDrawer,
  toggleDrawer,
  isDrawerOpen
} from './render.js';

// 底部 tab bar 直接对应的 5 个视图(其他 view 走"更多"或抽屉里的拓展项)
const TAB_VIEWS = new Set(['workspace', 'writing', 'inbox', 'library', 'more']);

function bindTabBar() {
  mDom.tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
}

function bindTopbar() {
  // 左侧 ≡ 按钮 → 打开抽屉
  mDom.leftAction?.addEventListener('click', () => toggleDrawer());
  // 占位:工作台/写作页是搜索,其他页是该页主操作
  mDom.rightAction?.addEventListener('click', () => showToast('搜索 · 待实现'));
}

function bindMoreList() {
  document.querySelectorAll('#mMoreView .m-list-item').forEach((item) => {
    item.addEventListener('click', () => {
      showToast(`「${item.querySelector('.m-list-label').textContent}」· 待实现`);
    });
  });
}

function bindDrawer() {
  // 关闭按钮 + 遮罩 + ESC
  mDom.drawerClose?.addEventListener('click', closeDrawer);
  mDom.drawerBackdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawerOpen()) closeDrawer();
  });

  // 抽屉里的导航项 → 切 view + 关闭抽屉
  // 桌面端有 6 个 view (含"书库"/"关系图谱"),
  // 移动端 tab bar 只暴露 5 个,书库/关系图谱暂在"更多"或后续接入,
  // 这里先把能对应到 tab 的切过去,其他显示占位 toast。
  mDom.drawerItems?.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (TAB_VIEWS.has(view)) {
        switchView(view);
      } else {
        // books / relation — 暂未实装为顶级 view
        showToast(`「${item.querySelector('span:last-child').textContent}」· 待接入`);
      }
      closeDrawer();
    });
  });

  // 抽屉新建作品
  mDom.drawerNewBook?.addEventListener('click', () => {
    showToast('新建作品 · 待接入');
    closeDrawer();
  });

  // 抽屉底部 4 个动作
  mDom.drawerFooterBtns?.forEach((btn) => {
    btn.addEventListener('click', () => {
      showToast(`「${btn.textContent.trim()}」· 待接入`);
      closeDrawer();
    });
  });
}

function boot() {
  bindTabBar();
  bindTopbar();
  bindMoreList();
  bindDrawer();
  switchView('workspace');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
