<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Delete, Right, Bottom, Grid } from '@element-plus/icons-vue';
import { layoutComponents, activeComponentIds, globalOps, activeView, globalSettings } from '../../../store';
import { COMPONENT_TYPES } from '../../../constants';

// 默认间距
const hGap = ref(10);
const vGap = ref(10);
// 具体尺寸输入
const customW = ref(null);
const customH = ref(null);

// --- 核心工具函数 (保持原有逻辑) ---
const getComponentBounds = (comp) => {
    let x, y, w, h;
    if (comp.type === COMPONENT_TYPES.DRAW_LINE) {
        x = Math.min(comp.x, comp.w); y = Math.min(comp.y, comp.h);
        w = Math.abs(comp.w - comp.x); h = Math.abs(comp.h - comp.y);
    } else if (comp.type === COMPONENT_TYPES.DRAW_PATH) {
        x = comp.x; y = comp.y; w = comp.w; h = comp.h; 
    } else { x = comp.x; y = comp.y; w = comp.w; h = comp.h; }
    return { id: comp.id, raw: comp, x, y, w, h, right: x + w, bottom: y + h, centerX: x + w / 2, centerY: y + h / 2 };
};

const moveComponent = (comp, dx, dy) => {
    comp.x = Math.round(comp.x + dx); comp.y = Math.round(comp.y + dy);
    if (comp.type === COMPONENT_TYPES.DRAW_LINE) { comp.w = Math.round(comp.w + dx); comp.h = Math.round(comp.h + dy); }
    if (comp.type === COMPONENT_TYPES.DRAW_PATH && comp.d) {
         comp.d = comp.d.replace(/([0-9.-]+)\s+([0-9.-]+)/g, (match, x, y) => `${parseFloat(x) + dx} ${parseFloat(y) + dy}`);
    }
};

const resizeComponent = (comp, newW, newH) => {
    if (newW !== null && newW !== undefined) {
        if (comp.type === COMPONENT_TYPES.DRAW_LINE) { const dirX = comp.w >= comp.x ? 1 : -1; comp.w = comp.x + (newW * dirX); } else { comp.w = newW; }
    }
    if (newH !== null && newH !== undefined) {
        if (comp.type === COMPONENT_TYPES.DRAW_LINE) { const dirY = comp.h >= comp.y ? 1 : -1; comp.h = comp.y + (newH * dirY); } else if (comp.type !== COMPONENT_TYPES.TABLE) { comp.h = newH; }
    }
};

const getSelectedComponents = () => layoutComponents.value.filter(c => activeComponentIds.value.includes(c.id));

// --- 功能实现 (保持不变) ---
const handleBatchDelete = () => {
    if (activeComponentIds.value.length === 0) return;
    layoutComponents.value = layoutComponents.value.filter(c => !activeComponentIds.value.includes(c.id));
    activeComponentIds.value = [];
};

const alignComponents = (type) => {
    const selected = getSelectedComponents();
    if (selected.length < 2) return;
    const bounds = selected.map(getComponentBounds);
    let targetVal = 0;
    if (type === 'left') targetVal = Math.min(...bounds.map(b => b.x));
    else if (type === 'right') targetVal = Math.max(...bounds.map(b => b.right));
    else if (type === 'h-center') targetVal = (Math.min(...bounds.map(b => b.x)) + Math.max(...bounds.map(b => b.right))) / 2;
    else if (type === 'top') targetVal = Math.min(...bounds.map(b => b.y));
    else if (type === 'bottom') targetVal = Math.max(...bounds.map(b => b.bottom));
    else if (type === 'v-center') targetVal = (Math.min(...bounds.map(b => b.y)) + Math.max(...bounds.map(b => b.bottom))) / 2;

    bounds.forEach(b => {
        let dx = 0, dy = 0;
        if (type === 'left') dx = targetVal - b.x; else if (type === 'right') dx = targetVal - b.right; else if (type === 'h-center') dx = targetVal - b.centerX;
        else if (type === 'top') dy = targetVal - b.y; else if (type === 'bottom') dy = targetVal - b.bottom; else if (type === 'v-center') dy = targetVal - b.centerY;
        if (dx !== 0 || dy !== 0) moveComponent(b.raw, dx, dy);
    });
};

const distributeSpacing = (direction) => {
    const selected = getSelectedComponents();
    if (selected.length < 2) return;
    const bounds = selected.map(getComponentBounds);
    if (direction === 'h') {
        bounds.sort((a, b) => a.centerX - b.centerX);
        for (let i = 1; i < bounds.length; i++) {
            const prev = bounds[i - 1]; const curr = bounds[i];
            const dx = (prev.right + (hGap.value || 0)) - curr.x;
            moveComponent(curr.raw, dx, 0); curr.x += dx; curr.right += dx; curr.centerX += dx;
        }
    } else {
        bounds.sort((a, b) => a.centerY - b.centerY);
        for (let i = 1; i < bounds.length; i++) {
            const prev = bounds[i - 1]; const curr = bounds[i];
            const dy = (prev.bottom + (vGap.value || 0)) - curr.y;
            moveComponent(curr.raw, 0, dy); curr.y += dy; curr.bottom += dy; curr.centerY += dy;
        }
    }
};

const applySize = (dim, mode) => {
    const selected = getSelectedComponents();
    if (selected.length < 2 && mode === 'max') return; 
    let targetSize = 0; const bounds = selected.map(getComponentBounds);
    if (dim === 'w') { targetSize = mode === 'max' ? Math.max(...bounds.map(b => b.w)) : customW.value; } 
    else { targetSize = mode === 'max' ? Math.max(...bounds.map(b => b.h)) : customH.value; }
    if (targetSize === null || targetSize === undefined || isNaN(targetSize)) return;
    selected.forEach(comp => { if (dim === 'w') resizeComponent(comp, targetSize, null); else resizeComponent(comp, null, targetSize); });
};

// --- 键盘监听 ---
const handleKeydown = (e) => {
    if (activeView.value !== 'edit' || activeComponentIds.value.length === 0 || globalSettings.value.isPreviewLocked) return;
    const tagName = document.activeElement?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    const step = globalOps.moveStep || 1; let dx = 0, dy = 0;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); 
        if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step; else if (e.key === 'ArrowLeft') dx = -step; else dx = step;
        activeComponentIds.value.forEach(id => {
            const comp = layoutComponents.value.find(c => c.id === id); if (!comp) return;
            if (comp.type === COMPONENT_TYPES.DRAW_LINE) { comp.x += dx; comp.y += dy; comp.w += dx; comp.h += dy; } 
            else if (comp.type === COMPONENT_TYPES.DRAW_PATH && comp.d) { comp.d = comp.d.replace(/([0-9.-]+)\s+([0-9.-]+)/g, (match, x, y) => `${parseFloat(x) + dx} ${parseFloat(y) + dy}`); } 
            else { comp.x += dx; comp.y += dy; }
        });
    }
};
onMounted(() => { window.addEventListener('keydown', handleKeydown); });
onUnmounted(() => { window.removeEventListener('keydown', handleKeydown); });
</script>

<template>
  <div class="multi-prop-container fade-in">
    <!-- 头部信息 -->
    <div class="multi-header">
        <div class="header-badge"><el-icon><Grid /></el-icon> {{ activeComponentIds.length }} 项选中</div>
        <button class="delete-icon-btn" @click="handleBatchDelete" title="删除"><el-icon><Delete /></el-icon></button>
    </div>

    <!-- 1. 快速对齐 (Dock Style) -->
    <div class="tool-dock">
        <el-tooltip content="左对齐" :show-after="500"><div class="dock-item" @click="alignComponents('left')"><div class="css-icon align-left"></div></div></el-tooltip>
        <el-tooltip content="水平居中" :show-after="500"><div class="dock-item" @click="alignComponents('h-center')"><div class="css-icon align-h-center"></div></div></el-tooltip>
        <el-tooltip content="右对齐" :show-after="500"><div class="dock-item" @click="alignComponents('right')"><div class="css-icon align-right"></div></div></el-tooltip>
        <div class="dock-sep"></div>
        <el-tooltip content="顶对齐" :show-after="500"><div class="dock-item" @click="alignComponents('top')"><div class="css-icon align-top"></div></div></el-tooltip>
        <el-tooltip content="垂直居中" :show-after="500"><div class="dock-item" @click="alignComponents('v-center')"><div class="css-icon align-v-center"></div></div></el-tooltip>
        <el-tooltip content="底对齐" :show-after="500"><div class="dock-item" @click="alignComponents('bottom')"><div class="css-icon align-bottom"></div></div></el-tooltip>
    </div>

    <!-- 2. 分布与尺寸 (Cards) -->
    <div class="control-card">
        <div class="card-label">间距分布</div>
        <div class="row-inputs">
            <div class="input-group">
                <button class="action-trigger" @click="distributeSpacing('h')" title="水平分布"><el-icon><Right /></el-icon></button>
                <el-input-number v-model="hGap" :controls="false" class="pill-input" placeholder="px" />
            </div>
            <div class="input-group">
                <button class="action-trigger" @click="distributeSpacing('v')" title="垂直分布"><el-icon><Bottom /></el-icon></button>
                <el-input-number v-model="vGap" :controls="false" class="pill-input" placeholder="px" />
            </div>
        </div>
    </div>

    <div class="control-card">
        <div class="card-label">批量尺寸</div>
        <div class="row-inputs">
            <div class="input-group">
                <button class="action-trigger text" @click="applySize('w', 'max')" title="统一为最大宽">W</button>
                <el-input-number v-model="customW" :controls="false" class="pill-input" placeholder="自动" @change="applySize('w', 'custom')" />
            </div>
            <div class="input-group">
                <button class="action-trigger text" @click="applySize('h', 'max')" title="统一为最大高">H</button>
                <el-input-number v-model="customH" :controls="false" class="pill-input" placeholder="自动" @change="applySize('h', 'custom')" />
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.multi-prop-container { display: flex; flex-direction: column; gap: 12px; padding: 4px; }

/* Header */
.multi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 0 4px; }
.header-badge { 
    background: #e0f2fe; color: #0284c7; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;
    display: flex; align-items: center; gap: 4px; 
}
.delete-icon-btn { 
    width: 28px; height: 28px; border-radius: 50%; background: #fee2e2; color: #ef4444; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.delete-icon-btn:hover { background: #ef4444; color: #fff; transform: rotate(90deg); }

/* Tool Dock */
.tool-dock {
    display: flex; align-items: center; justify-content: space-between;
    background: #fff; padding: 8px; border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.03);
}
.dock-item {
    width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.dock-item:hover { background: #f3f4f6; transform: translateY(-2px); }
.dock-sep { width: 1px; height: 20px; background: #e5e7eb; margin: 0 4px; }

/* Control Cards */
.control-card {
    background: #fff; border-radius: 16px; padding: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
}
.card-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; margin-bottom: 8px; }

.row-inputs { display: flex; gap: 8px; }
.input-group { 
    flex: 1; display: flex; align-items: center; gap: 4px; background: #f9fafb; padding: 2px; border-radius: 10px; border: 1px solid #e5e7eb;
}
.input-group:focus-within { border-color: #3b82f6; background: #fff; }

.action-trigger {
    width: 24px; height: 24px; border-radius: 8px; border: none; background: transparent; color: #6b7280;
    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
}
.action-trigger:hover { background: #e0f2fe; color: #0284c7; }
.action-trigger.text { font-weight: 800; font-size: 10px; font-family: monospace; }

.pill-input :deep(.el-input__wrapper) { box-shadow: none !important; padding: 0 4px; background: transparent; }
.pill-input :deep(.el-input__inner) { text-align: center; height: 24px; font-size: 12px; font-weight: 600; color: #374151; padding: 0; }

/* CSS Icons */
.css-icon { position: relative; width: 14px; height: 14px; opacity: 0.6; }
.dock-item:hover .css-icon { opacity: 1; color: #3b82f6; }
.css-icon::before, .css-icon::after { content: ''; position: absolute; background: currentColor; }
.align-left::before { left: 0; top: 2px; width: 2px; height: 10px; }
.align-left::after { left: 4px; top: 4px; width: 8px; height: 6px; border-top: 2px solid currentColor; border-bottom: 2px solid currentColor; background: transparent; }
.align-right::before { right: 0; top: 2px; width: 2px; height: 10px; }
.align-right::after { right: 4px; top: 4px; width: 8px; height: 6px; border-top: 2px solid currentColor; border-bottom: 2px solid currentColor; background: transparent; }
.align-h-center::before { left: 6px; top: 2px; width: 2px; height: 10px; }
.align-h-center::after { left: 2px; top: 4px; width: 10px; height: 6px; border-top: 2px solid currentColor; border-bottom: 2px solid currentColor; background: transparent; }
.align-top::before { top: 0; left: 2px; width: 10px; height: 2px; }
.align-top::after { top: 4px; left: 4px; width: 6px; height: 8px; border-left: 2px solid currentColor; border-right: 2px solid currentColor; background: transparent; }
.align-bottom::before { bottom: 0; left: 2px; width: 10px; height: 2px; }
.align-bottom::after { bottom: 4px; left: 4px; width: 6px; height: 8px; border-left: 2px solid currentColor; border-right: 2px solid currentColor; background: transparent; }
.align-v-center::before { top: 6px; left: 2px; width: 10px; height: 2px; }
.align-v-center::after { top: 2px; left: 4px; width: 6px; height: 10px; border-left: 2px solid currentColor; border-right: 2px solid currentColor; background: transparent; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
</style>