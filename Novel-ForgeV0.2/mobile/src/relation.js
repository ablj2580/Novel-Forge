/**
 * 移动端关系图谱 — 骨架占位。
 *
 * 桌面端的 ../../src/relation.js 用 SVG + hover/click 浮窗;
 * 移动端需要重新设计:
 *   - 触摸缩放 / 拖拽平移
 *   - 节点详情用底部抽屉(bottom sheet)而非右侧抽屉
 *   - 添加关系用全屏 modal 不是浮窗
 *
 * 真正实现时,数据层(节点 / 边 / 模块色)从 ../../src/state.js 拿,
 * 渲染层在这里独立实现,不复用桌面的 relation.js。
 */

import { mDom } from './dom.js';
import { showToast } from './render.js';

export function renderMobileRelation(itemId) {
  // TODO: 读 state、计算节点位置、渲染 SVG
  showToast('关系图谱移动端待实现');
}

export function openRelationDetail(nodeId) {
  // TODO: 弹出底部 sheet 显示节点详情 + 修改/移除关系按钮
}
