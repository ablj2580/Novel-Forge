import { persist, activeBookId, getModules, getState, getRelationTypes, getRelationType, updateRelationType, addRelationType, isRelationTypeInUse, removeRelationType, removeUnusedRelationTypes, isRelationFavorite, toggleRelationFavorite, getFavoriteRelations } from './state.js';
import { dom } from './dom.js';
import { escapeHtml } from './utils.js';

let selectedItemId = null;

export const getSelectedRelationItem = () => selectedItemId;

export const setSelectedRelationItem = (id) => {
  selectedItemId = id;
};

export const addRelation = (fromId, toId, relationTypeId = '1') => {
  const state = getState();
  const item = state.libraryItems.find(i => i.id === fromId);
  if (!item) return false;
  
  if (!item.relations) {
    item.relations = [];
  }
  
  if (!item.relations.some(r => r.targetId === toId)) {
    item.relations.push({
      targetId: toId,
      type: relationTypeId,
      createdAt: new Date().toISOString()
    });
    persist();
    return true;
  }
  return false;
};

export const removeRelation = (fromId, toId) => {
  const state = getState();
  const item = state.libraryItems.find(i => i.id === fromId);
  if (!item || !item.relations) return false;
  
  const index = item.relations.findIndex(r => r.targetId === toId);
  if (index > -1) {
    item.relations.splice(index, 1);
    persist();
    return true;
  }
  return false;
};

export const changeRelationType = (fromId, toId, newTypeId) => {
  const state = getState();
  
  let item = state.libraryItems.find(i => i.id === fromId);
  if (item && item.relations) {
    const relation = item.relations.find(r => r.targetId === toId);
    if (relation) {
      console.log('DEBUG - changeRelationType: found forward relation, old type=', relation.type, 'new type=', newTypeId);
      relation.type = newTypeId;
      persist();
      return true;
    }
  }
  
  item = state.libraryItems.find(i => i.id === toId);
  if (item && item.relations) {
    const relation = item.relations.find(r => r.targetId === fromId);
    if (relation) {
      console.log('DEBUG - changeRelationType: found reverse relation, old type=', relation.type, 'new type=', newTypeId);
      relation.type = newTypeId;
      persist();
      return true;
    }
  }
  
  console.log('DEBUG - changeRelationType: relation not found');
  return false;
};

export const getRelations = (itemId) => {
  const state = getState();
  const item = state.libraryItems.find(i => i.id === itemId);
  return item?.relations || [];
};

export const getRelatedItems = (itemId) => {
  const state = getState();
  
  const forwardRelations = getRelations(itemId);
  const forwardItems = forwardRelations.map(rel => {
    const target = state.libraryItems.find(i => i.id === rel.targetId);
    let relationType = rel.type;
    if (!relationType || relationType === 'self' || relationType === '0') {
      relationType = '1';
    }
    return target ? { ...target, relationType } : null;
  }).filter(Boolean);
  
  const reverseRelations = state.libraryItems
    .filter(item => item.relations && item.relations.some(r => r.targetId === itemId))
    .map(item => {
      const relation = item.relations.find(r => r.targetId === itemId);
      let relationType = relation?.type;
      if (!relationType || relationType === 'self' || relationType === '0') {
        relationType = '1';
      }
      return { ...item, relationType };
    });
  
  const allRelations = [...forwardItems];
  const addedIds = new Set(forwardItems.map(i => i.id));
  
  reverseRelations.forEach(item => {
    if (!addedIds.has(item.id) && item.id !== itemId) {
      allRelations.push(item);
    }
  });
  
  return allRelations;
};

export const findAllRelations = (itemId) => {
  const state = getState();
  const bookId = activeBookId();
  const allItems = state.libraryItems.filter(i => i.bookId === bookId);
  
  const relationMap = new Map();
  relationMap.set(itemId, { level: 0, type: 'self' });
  
  const queue = [{ id: itemId, level: 0 }];
  
  while (queue.length > 0) {
    const current = queue.shift();
    const currentRelations = getRelatedItems(current.id);
    
    for (const rel of currentRelations) {
      if (!relationMap.has(rel.id)) {
        relationMap.set(rel.id, { 
          level: current.level + 1, 
          relationType: rel.relationType,
          sourceId: current.id 
        });
        if (current.level < 2) {
          queue.push({ id: rel.id, level: current.level + 1 });
        }
      }
    }
  }
  
  return {
    centralItem: state.libraryItems.find(i => i.id === itemId),
    relatedItems: allItems.filter(i => relationMap.has(i.id) && i.id !== itemId).map(i => ({
      ...i,
      ...relationMap.get(i.id)
    })),
    relationMap
  };
};

export const getRelationTypeLabel = (typeId) => {
  const relationType = getRelationType(typeId);
  return relationType?.name || typeId;
};

export const getRelationTypeColor = (typeId) => {
  if (!typeId) {
    console.log('DEBUG - getRelationTypeColor: typeId is null/undefined');
    return '#4a90d9';
  }
  const relationType = getRelationType(typeId);
  const color = relationType?.color || '#4a90d9';
  console.log('DEBUG - getRelationTypeColor: typeId=', typeId, 'color=', color);
  return color;
};

export const renderRelationGraph = (itemId) => {
  const bookId = activeBookId();
  
  if (!itemId) {
    const state = getState();
    const protagonist = state.libraryItems.find(i => i.bookId === bookId && i.tags?.includes("主角"));
    
    if (protagonist) {
      itemId = protagonist.id;
      selectedItemId = itemId;
    } else {
      dom.relationView.innerHTML = `
        <div class="relation-empty-state">
          <div class="empty-icon">🔗</div>
          <p>点击设定资料卡片查看关系图</p>
        </div>
      `;
      return;
    }
  }
  
  selectedItemId = itemId;
  
  const { centralItem, relatedItems } = findAllRelations(itemId);
  
  if (!centralItem) {
    dom.relationView.innerHTML = `<p class="text-center">未找到设定资料</p>`;
    return;
  }
  
  const modules = getModules();
  const moduleColors = new Map(modules.map(m => [m.id, m.color]));
  
  const nodes = [];
  const edges = [];
  
  nodes.push({
    id: centralItem.id,
    label: centralItem.title,
    module: centralItem.module,
    color: moduleColors.get(centralItem.module) || '#4a90d9',
    level: 0,
    isCentral: true,
    isProtagonist: centralItem.tags?.includes("主角") || false
  });
  
  const level1Items = relatedItems.filter(i => i.level === 1);
  const level2Items = relatedItems.filter(i => i.level === 2);
  
  const canvasRadius = 350;
  const level1Radius = Math.min(160, canvasRadius - 120);
  
  let angle = 0;
  const level1AngleStep = level1Items.length > 0 ? (2 * Math.PI) / level1Items.length : 0;
  
  level1Items.forEach((item, index) => {
    const x = Math.cos(angle) * level1Radius;
    const y = Math.sin(angle) * level1Radius;
    
    const relationColor = getRelationTypeColor(item.relationType);
    
    nodes.push({
      id: item.id,
      label: item.title,
      module: item.module,
      color: relationColor,
      level: 1,
      x,
      y,
      relationType: item.relationType,
      isProtagonist: item.tags?.includes("主角") || false
    });
    
    edges.push({
      from: centralItem.id,
      to: item.id,
      type: item.relationType
    });
    
    angle += level1AngleStep;
  });
  
  const level2Nodes = [];
  
  const sourceGroups = {};
  level2Items.forEach(item => {
    if (!sourceGroups[item.sourceId]) {
      sourceGroups[item.sourceId] = [];
    }
    sourceGroups[item.sourceId].push(item);
  });
  
  Object.keys(sourceGroups).forEach(sourceId => {
    const items = sourceGroups[sourceId];
    const sourceNode = nodes.find(n => n.id === sourceId);
    if (!sourceNode) return;
    
    const baseAngle = Math.atan2(sourceNode.y, sourceNode.x);
    const count = items.length;
    const spreadAngle = Math.PI / 2;
    const startAngle = baseAngle - spreadAngle / 2;
    const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;
    
    items.forEach((item, index) => {
      const angle = startAngle + index * angleStep;
      const radius = 90;
      
      let x = sourceNode.x + Math.cos(angle) * radius;
      let y = sourceNode.y + Math.sin(angle) * radius;
      
      let currentRadius = radius;
      const minDistance = 55;
      let attempts = 0;
      const maxAttempts = 20;
      const radiusIncrement = 15;
      
      while (attempts < maxAttempts) {
        let overlaps = false;
        x = sourceNode.x + Math.cos(angle) * currentRadius;
        y = sourceNode.y + Math.sin(angle) * currentRadius;
        
        const nodeRadius = 22;
        const distanceFromCenter = Math.sqrt(x * x + y * y);
        if (distanceFromCenter + nodeRadius > canvasRadius) {
          currentRadius -= radiusIncrement;
          attempts++;
          continue;
        }
        
        for (const existingNode of nodes) {
          const dx = x - existingNode.x;
          const dy = y - existingNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const nodeRadius = existingNode.level === 0 ? 40 : existingNode.level === 1 ? 30 : 22;
          if (distance < minDistance + nodeRadius + 22) {
            overlaps = true;
            break;
          }
        }
        
        if (!overlaps) {
          for (const existingNode of level2Nodes) {
            const dx = x - existingNode.x;
            const dy = y - existingNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance + 22 + 22) {
              overlaps = true;
              break;
            }
          }
        }
        
        if (!overlaps) break;
        
        currentRadius += radiusIncrement;
        attempts++;
      }
      
      const relationColor = getRelationTypeColor(item.relationType);
      
      const newNode = {
        id: item.id,
        label: item.title,
        module: item.module,
        color: relationColor,
        level: 2,
        x,
        y,
        relationType: item.relationType,
        sourceId: item.sourceId,
        isProtagonist: item.tags?.includes("主角") || false
      };
      
      level2Nodes.push(newNode);
      nodes.push(newNode);
      
      edges.push({
        from: item.sourceId,
        to: item.id,
        type: item.relationType
      });
    });
  });
  
  const state = getState();
  
  const relationTypes = getRelationTypes(bookId);
  const usedTypes = [...new Set(edges.map(e => e.type))].filter(t => t);
  
  const legendHtml = usedTypes.length > 0 ? `
    <div class="relation-legend">
      ${usedTypes.map(typeId => {
        const type = relationTypes.find(t => t.id === typeId);
        return `
          <span class="legend-item">
            <span class="legend-dot" style="background: ${type?.color || '#4a90d9'}"></span>
            <span class="legend-label">${type?.name || typeId}</span>
          </span>
        `;
      }).join('')}
    </div>
  ` : '';
  
  dom.relationView.innerHTML = `
    <div class="relation-header">
      <div class="relation-title">
        <span class="module-color-dot" style="background: ${moduleColors.get(centralItem.module) || '#4a90d9'}"></span>
        <h2>${centralItem.title}</h2>
        <button id="relationFavoriteBtn" class="icon-button favorite-btn relation-favorite-btn ${isRelationFavorite(itemId) ? 'active' : ''}" data-action="toggle-relation-favorite" data-id="${itemId}" title="${isRelationFavorite(itemId) ? '取消收藏图谱' : '收藏图谱'}" type="button">
          ${isRelationFavorite(itemId) ? '★' : '☆'}
        </button>
      </div>
      <div class="relation-header-actions">
        <button id="manageRelationTypes" class="icon-button" title="管理关系类型" type="button">⚙</button>
        <button id="closeRelationView" class="icon-button" title="关闭关系图" type="button">✕</button>
      </div>
    </div>
    
    <div class="relation-graph-container">
      <svg class="relation-graph" viewBox="-450 -450 900 900">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
          </marker>
        </defs>
        
        ${edges.map(edge => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return '';
          const isLevel2 = toNode.level === 2;
          return `
            <line 
              x1="${isLevel2 ? fromNode.x : 0}" 
              y1="${isLevel2 ? fromNode.y : 0}" 
              x2="${toNode.x}" 
              y2="${toNode.y}" 
              stroke="${isLevel2 ? '#d1d5db' : '#9ca3af'}" 
              stroke-width="${isLevel2 ? 1 : 2}"
              marker-end="url(#arrowhead)"
            />
          `;
        }).join('')}
        
        ${nodes.map(node => {
          const item = state.libraryItems.find(i => i.id === node.id);
          const content = item?.content || '';
          const tags = (item?.tags || []).join(', ');
          const isProtagonist = node.isProtagonist;
          const baseRadius = node.isCentral ? 40 : node.level === 1 ? 30 : 22;
          
          return `
            <g class="relation-node-group" data-item-id="${node.id}" data-item-title="${escapeHtml(node.label)}" data-item-content="${escapeHtml(content)}" data-item-tags="${escapeHtml(tags)}" data-relation-type="${node.relationType || ''}" data-level="${node.level}" data-source-id="${node.sourceId || ''}">
              <circle 
                cx="${node.isCentral ? 0 : node.x}" 
                cy="${node.isCentral ? 0 : node.y}" 
                r="${node.isCentral ? 60 : node.level === 1 ? 45 : 35}" 
                fill="${node.color}"
                opacity="0.15"
              />
              <circle 
                cx="${node.isCentral ? 0 : node.x}" 
                cy="${node.isCentral ? 0 : node.y}" 
                r="${node.isCentral ? 50 : node.level === 1 ? 38 : 28}" 
                fill="${node.color}"
                opacity="0.25"
              />
              ${isProtagonist ? `
                <circle 
                  cx="${node.isCentral ? 0 : node.x}" 
                  cy="${node.isCentral ? 0 : node.y}" 
                  r="${baseRadius + 6}" 
                  fill="none"
                  stroke="#e57373"
                  stroke-width="3"
                  stroke-dasharray="6,4"
                />
                <circle 
                  cx="${node.isCentral ? 0 : node.x}" 
                  cy="${node.isCentral ? 0 : node.y}" 
                  r="${baseRadius + 12}" 
                  fill="none"
                  stroke="#e57373"
                  stroke-width="1"
                  opacity="0.5"
                />
              ` : ''}
              <circle 
                cx="${node.isCentral ? 0 : node.x}" 
                cy="${node.isCentral ? 0 : node.y}" 
                r="${baseRadius}" 
                fill="${isProtagonist ? '#e57373' : node.color}"
                class="relation-node"
              />
              ${isProtagonist ? `
                <text 
                  x="${node.isCentral ? 0 : node.x}" 
                  y="${node.isCentral ? 0 : node.y - baseRadius - 10}" 
                  text-anchor="middle" 
                  fill="#e57373"
                  font-size="16px"
                  font-weight="700"
                >★</text>
              ` : ''}
              <text 
                x="${node.isCentral ? 0 : node.x}" 
                y="${node.isCentral ? 0 : node.y + 7}" 
                text-anchor="middle" 
                fill="white"
                font-size="${node.isCentral ? '18px' : node.level === 1 ? '14px' : '12px'}"
                font-weight="600"
              >${truncateText(node.label, node.isCentral ? 10 : node.level === 1 ? 8 : 6)}</text>
            </g>
          `;
        }).join('')}
        </svg>
      </div>
      
      ${legendHtml}
      
      <div id="relationTooltip" class="relation-tooltip">
        <div class="tooltip-title"></div>
        <div class="tooltip-content"></div>
        <div class="tooltip-tags"></div>
        <div class="tooltip-relation-select">
          <label>关系类型:</label>
          <select class="tooltip-relation-type-select"></select>
        </div>
        <div class="tooltip-actions">
          <button class="tooltip-change-btn" type="button">修改关系</button>
          <button class="tooltip-remove-btn" type="button">移除关系</button>
        </div>
        <div class="tooltip-hint">再次点击查看关系</div>
      </div>
      
      <div class="add-relation-menu-wrapper">
        <div id="relationActionButtons" class="relation-action-buttons">
          <button id="favoriteRelationsButton" class="relation-action-btn secondary-btn favorite-btn" data-action="show-favorite-relations" type="button" title="查看收藏图谱">
            <span>★</span>
          </button>
          <button id="newRelationButton" class="relation-action-btn secondary-btn add-btn" data-action="add-relation" type="button" title="新增关系">
            <span>+</span>
          </button>
          <button id="addRelationButton" class="relation-action-btn main-btn" type="button" title="展开菜单">
            <span>+</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  setupRelationEventListeners();
};

const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

let clickedItemId = null;
let clickTimeout = null;

const hideTooltip = () => {
  const tooltip = document.getElementById('relationTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
  clickedItemId = null;
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }
};

const setupRelationEventListeners = () => {
  const closeBtn = document.getElementById('closeRelationView');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideTooltip();
      renderRelationGraph(null);
      setSelectedRelationItem(null);
    });
  }
  
  const manageBtn = document.getElementById('manageRelationTypes');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      hideTooltip();
      showManageRelationTypesModal();
    });
  }
  
  const tooltip = document.getElementById('relationTooltip');
  const nodeGroups = dom.relationView.querySelectorAll('.relation-node-group');
  
  nodeGroups.forEach(group => {
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = group.dataset.itemId;
      const relationType = group.dataset.relationType;
      
      if (clickedItemId === itemId) {
        if (itemId && itemId !== selectedItemId) {
          hideTooltip();
          setSelectedRelationItem(itemId);
          renderRelationGraph(itemId);
        }
      } else {
        const title = group.dataset.itemTitle;
        const content = group.dataset.itemContent;
        const tags = group.dataset.itemTags;
        
        if (!title) return;
        
        tooltip.querySelector('.tooltip-title').textContent = title;
        tooltip.querySelector('.tooltip-content').textContent = content || '暂无描述';
        tooltip.querySelector('.tooltip-tags').textContent = tags ? `标签: ${tags}` : '';
        
        const bookId = activeBookId();
        const relationTypes = getRelationTypes(bookId).filter(t => t.editable);
        const select = tooltip.querySelector('.tooltip-relation-type-select');
        
        const level = group.dataset.level;
        console.log('DEBUG - group.dataset:', group.dataset);
        
        if (itemId !== selectedItemId) {
          let currentTypeId = '1';
          let sourceId = selectedItemId;
          
          if (level === '2') {
            const sourceNodeId = group.dataset.sourceId;
            console.log('DEBUG - level 2 node, sourceNodeId from dataset:', sourceNodeId);
            if (sourceNodeId) {
              const sourceRelations = getRelations(sourceNodeId);
              console.log('DEBUG - sourceRelations:', sourceRelations);
              const currentRelation = sourceRelations.find(r => r.targetId === itemId);
              console.log('DEBUG - currentRelation:', currentRelation);
              currentTypeId = currentRelation?.type || '1';
              sourceId = sourceNodeId;
            }
          } else {
            const relations = getRelations(selectedItemId);
            const currentRelation = relations.find(r => r.targetId === itemId);
            currentTypeId = currentRelation?.type || '1';
          }
          
          select.innerHTML = relationTypes.map(t => `
            <option value="${t.id}" style="background: ${t.color}" ${currentTypeId === t.id ? 'selected' : ''}>${t.name}</option>
          `).join('');
          tooltip.querySelector('.tooltip-relation-select').style.display = 'block';
          tooltip.querySelector('.tooltip-actions').style.display = 'block';
        } else {
          tooltip.querySelector('.tooltip-relation-select').style.display = 'none';
          tooltip.querySelector('.tooltip-actions').style.display = 'none';
        }
        
        tooltip.querySelector('.tooltip-remove-btn').dataset.targetId = itemId;
        tooltip.querySelector('.tooltip-change-btn').dataset.targetId = itemId;
        tooltip.querySelector('.tooltip-change-btn').dataset.sourceId = level === '2' ? group.dataset.sourceId : selectedItemId;
        
        tooltip.style.display = 'block';
        
        const rect = group.getBoundingClientRect();
        
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        
        let tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
        let tooltipTop = rect.top - tooltipHeight - 8;
        
        const containerRect = dom.relationView.querySelector('.relation-graph-container').getBoundingClientRect();
        
        if (tooltipTop < containerRect.top + 60) {
          tooltipTop = rect.top + rect.height + 8;
        }
        
        if (tooltipLeft < containerRect.left + 10) {
          tooltipLeft = containerRect.left + 10;
        }
        if (tooltipLeft + tooltipWidth > containerRect.right - 10) {
          tooltipLeft = containerRect.right - tooltipWidth - 10;
        }
        
        tooltip.style.left = `${tooltipLeft}px`;
        tooltip.style.top = `${tooltipTop}px`;
        
        clickedItemId = itemId;
        
        if (clickTimeout) {
          clearTimeout(clickTimeout);
        }
        clickTimeout = setTimeout(() => {
          clickedItemId = null;
        }, 3000);
      }
    });
  });
  
  const graphContainer = dom.relationView.querySelector('.relation-graph-container');
  if (graphContainer) {
    graphContainer.addEventListener('click', (e) => {
      if (e.target === graphContainer || e.target.classList.contains('relation-graph')) {
        hideTooltip();
      }
    });
  }
  
  const addRelationButton = document.getElementById('addRelationButton');
  const relationActionButtons = document.getElementById('relationActionButtons');
  if (addRelationButton) {
    addRelationButton.addEventListener('click', (e) => {
      e.stopPropagation();
      hideTooltip();
      relationActionButtons.classList.toggle('expanded');
    });
  }
  
  document.addEventListener('click', (e) => {
    if (relationActionButtons && relationActionButtons.classList.contains('expanded')) {
      const target = e.target.closest('.relation-action-buttons');
      if (!target) {
        relationActionButtons.classList.remove('expanded');
      }
    }
  });
  
  dom.relationView.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.tooltip-remove-btn');
    if (removeBtn) {
      e.stopPropagation();
      const targetId = removeBtn.dataset.targetId;
      const changeBtn = document.querySelector('.tooltip-change-btn');
      const sourceId = changeBtn?.dataset.sourceId || selectedItemId;
      if (targetId && sourceId) {
        if (removeRelation(sourceId, targetId)) {
          hideTooltip();
          renderRelationGraph(selectedItemId);
          showToast('关系已移除');
        }
      }
      return;
    }
    
    const changeBtn = e.target.closest('.tooltip-change-btn');
    if (changeBtn) {
      e.stopPropagation();
      const targetId = changeBtn.dataset.targetId;
      const sourceId = changeBtn.dataset.sourceId || selectedItemId;
      const select = tooltip?.querySelector('.tooltip-relation-type-select');
      console.log('DEBUG - changeBtn click: targetId=', targetId, 'sourceId=', sourceId, 'selectedItemId=', selectedItemId);
      if (targetId && sourceId && select) {
        const newTypeId = select.value;
        console.log('DEBUG - newTypeId=', newTypeId);
        if (changeRelationType(sourceId, targetId, newTypeId)) {
          hideTooltip();
          renderRelationGraph(selectedItemId);
          showToast('关系已修改');
        } else {
          console.log('DEBUG - changeRelationType returned false');
        }
      }
    }
  });
};

export const showAddRelationModal = (fromId) => {
  const existingModal = document.getElementById('addRelationModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const bookId = activeBookId();
  const modules = getModules();
  const moduleColors = new Map(modules.map(m => [m.id, m.color]));
  const state = getState();
  const relationTypes = getRelationTypes(bookId).filter(t => t.editable);
  
  const modalHTML = `
    <dialog id="addRelationModal" class="modal">
      <div class="modal-heading">
        <h2>添加关联</h2>
        <button type="button" class="close-button" onclick="document.getElementById('addRelationModal').close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>关系类型</label>
          <select id="relationTypeSelect" class="relation-type-select">
            ${relationTypes.map(t => `
              <option value="${t.id}" style="background: ${t.color}">${t.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>搜索设定资料</label>
          <input id="relationSearchInput" class="relation-search" type="text" placeholder="输入关键词搜索..." />
        </div>
        <div id="relationSearchResults" class="relation-search-results-modal"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="ghost-button" onclick="document.getElementById('addRelationModal').close()">取消</button>
      </div>
    </dialog>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const searchInput = document.getElementById('relationSearchInput');
  const resultsContainer = document.getElementById('relationSearchResults');
  const typeSelect = document.getElementById('relationTypeSelect');
  
  if (searchInput && resultsContainer) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      if (!query.trim()) {
        resultsContainer.innerHTML = '<p class="text-muted">输入关键词搜索设定资料</p>';
        return;
      }
      
      const filtered = state.libraryItems
        .filter(i => i.bookId === bookId && 
                    i.id !== fromId &&
                    i.title.toLowerCase().includes(query))
        .slice(0, 8);
      
      if (filtered.length === 0) {
        resultsContainer.innerHTML = '<p class="text-muted">未找到匹配的设定资料</p>';
        return;
      }
      
      const selectedTypeId = typeSelect.value;
      const selectedType = relationTypes.find(t => t.id === selectedTypeId);
      const typeColor = selectedType?.color || '#4a90d9';
      
      resultsContainer.innerHTML = filtered.map(item => `
        <div class="relation-search-item-modal" data-action="add-relation" data-from="${fromId}" data-to="${item.id}" data-type="${selectedTypeId}">
          <span class="module-color-dot" style="background: ${moduleColors.get(item.module) || '#4a90d9'}"></span>
          <span class="relation-search-item-title">${item.title}</span>
          <span class="add-relation-btn" style="background: ${typeColor}">+ 添加</span>
        </div>
      `).join('');
      
      setupAddRelationListeners();
    });
    
    typeSelect.addEventListener('change', () => {
      const event = new Event('input');
      searchInput.dispatchEvent(event);
    });
    
    searchInput.focus();
  }
  
  document.getElementById('addRelationModal').showModal();
};

const setupAddRelationListeners = () => {
  const addButtons = document.querySelectorAll('[data-action="add-relation"]');
  addButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const fromId = btn.dataset.from;
      const toId = btn.dataset.to;
      const relationTypeId = btn.dataset.type || '1';
      
      if (addRelation(fromId, toId, relationTypeId)) {
        const modal = document.getElementById('addRelationModal');
        if (modal) {
          modal.close();
          modal.remove();
        }
        renderRelationGraph(fromId);
        showToast('关联已添加');
      }
    });
  });
};

export const showToast = (message) => {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
};

const renderRelationTypesList = (typesList, bookId) => {
  const relationTypes = getRelationTypes(bookId);
  typesList.innerHTML = relationTypes.map(type => {
    const inUse = isRelationTypeInUse(type.id, bookId);
    return `
      <div class="relation-type-item" data-type-name="${escapeHtml(type.name)}">
        <span class="type-color-preview" style="background: ${type.color}"></span>
        <div class="type-info">
          <input 
            type="text" 
            class="type-name-input" 
            value="${escapeHtml(type.name)}" 
            data-type-id="${type.id}"
            ${type.editable ? '' : 'disabled'}
          />
          <span class="type-id">#${type.id}</span>
          ${inUse ? '<span class="type-in-use">已使用</span>' : ''}
        </div>
        <div class="type-actions">
          <input 
            type="color" 
            class="type-color-picker" 
            value="${type.color}" 
            data-type-id="${type.id}"
            ${type.editable ? '' : 'disabled'}
          />
          ${type.editable ? `
            <button 
              type="button" 
              class="type-delete-btn" 
              data-type-id="${type.id}"
              ${inUse ? 'disabled title="此关系正在被使用，无法删除"' : ''}
            >
              删除
            </button>
          ` : '<span class="type-locked">默认</span>'}
        </div>
      </div>
    `;
  }).join('');
  
  return relationTypes.length;
};

const showManageRelationTypesModal = () => {
  const existingModal = document.getElementById('manageRelationTypesModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const bookId = activeBookId();
  const relationTypes = getRelationTypes(bookId);
  
  const modalHTML = `
    <dialog id="manageRelationTypesModal" class="modal">
      <div class="modal-heading">
        <h2>管理关系类型</h2>
        <button type="button" class="close-button" onclick="document.getElementById('manageRelationTypesModal').close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="relation-types-search">
          <input 
            type="text" 
            id="relationTypeSearchInput" 
            class="relation-type-search-input" 
            placeholder="搜索关系类型..."
          />
        </div>
        <div class="relation-types-list" id="relationTypesList">
        </div>
        <div id="addRelationTypeContainer">
          <button type="button" id="addNewRelationTypeBtn" class="add-relation-type-btn">
            + 新增关系类型
          </button>
        </div>
        <button type="button" id="removeUnusedRelationTypesBtn" class="remove-unused-btn">
          清理未使用的关系类型
        </button>
      </div>
    </dialog>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('manageRelationTypesModal');
  const searchInput = modal.querySelector('#relationTypeSearchInput');
  const typesList = modal.querySelector('#relationTypesList');
  const addContainer = modal.querySelector('#addRelationTypeContainer');
  
  const refreshList = () => {
    const count = renderRelationTypesList(typesList, bookId);
    if (count >= 100) {
      addContainer.innerHTML = '<div class="relation-types-limit">已达到最大关系类型数量 (100)</div>';
    } else {
      addContainer.innerHTML = '<button type="button" id="addNewRelationTypeBtn" class="add-relation-type-btn">+ 新增关系类型</button>';
      setupAddButton();
    }
    setupListEventListeners();
  };
  
  const setupListEventListeners = () => {
    const nameInputs = typesList.querySelectorAll('.type-name-input');
    nameInputs.forEach(input => {
      input.addEventListener('input', () => {
        const typeId = input.dataset.typeId;
        const newName = input.value.trim();
        if (newName && updateRelationType(typeId, { name: newName }, bookId)) {
          input.parentElement.parentElement.dataset.typeName = newName;
          if (selectedItemId) {
            renderRelationGraph(selectedItemId);
          }
        }
      });
    });
    
    const colorPickers = typesList.querySelectorAll('.type-color-picker');
    colorPickers.forEach(picker => {
      picker.addEventListener('change', () => {
        const typeId = picker.dataset.typeId;
        const newColor = picker.value;
        if (updateRelationType(typeId, { color: newColor }, bookId)) {
          picker.parentElement.parentElement.querySelector('.type-color-preview').style.background = newColor;
          showToast('关系颜色已更新');
          if (selectedItemId) {
            renderRelationGraph(selectedItemId);
          }
        }
      });
    });
    
    const deleteBtns = typesList.querySelectorAll('.type-delete-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const typeId = btn.dataset.typeId;
        if (confirm('确定要删除这个关系类型吗？')) {
          if (removeRelationType(typeId, bookId)) {
            showToast('关系类型已删除');
            refreshList();
          } else {
            showToast('无法删除，此关系类型正在被使用');
          }
        }
      });
    });
  };
  
  const setupAddButton = () => {
    const addBtn = modal.querySelector('#addNewRelationTypeBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const newType = addRelationType(bookId);
        if (newType) {
          showToast(`已添加关系类型: ${newType.name}`);
          refreshList();
        } else {
          showToast('无法添加更多关系类型');
        }
      });
    }
  };
  
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const items = typesList.querySelectorAll('.relation-type-item');
    
    items.forEach(item => {
      const typeName = item.dataset.typeName.toLowerCase();
      if (typeName.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
  
  const removeUnusedBtn = modal.querySelector('#removeUnusedRelationTypesBtn');
  if (removeUnusedBtn) {
    removeUnusedBtn.addEventListener('click', () => {
      if (confirm('确定要删除所有未使用的关系类型吗？')) {
        const removedCount = removeUnusedRelationTypes(bookId);
        if (removedCount > 0) {
          showToast(`已删除 ${removedCount} 个未使用的关系类型`);
        } else {
          showToast('没有未使用的关系类型可删除');
        }
        refreshList();
      }
    });
  }
  
  refreshList();
  modal.showModal();
};