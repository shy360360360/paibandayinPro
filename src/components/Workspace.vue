<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Delete, InfoFilled } from '@element-plus/icons-vue';
import { 
    activeView, activeComponentId, activeComponentIds, layoutComponents, globalSettings, 
    zoomScale, invoiceDataByCustomer, vGuides, hGuides, snapState,
    viewPortWidth, renderingScale 
} from '../store';
import { useCanvas } from '../composables/useCanvas';
import { usePrint } from '../composables/usePrint';
import { COMPONENT_TYPES } from '../constants';

const { handleMouseDown, dragState, exitDrawMode } = useCanvas();
const { renderComponentContent, getStrokeDashArray } = usePrint();
const workspaceRef = ref(null); 

let resizeObserver = null;
onMounted(() => {
    if (workspaceRef.value) {
        resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                viewPortWidth.value = entry.contentRect.width;
            }
        });
        resizeObserver.observe(workspaceRef.value);
    }
});

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
});

const getComponentStyle = (comp) => {
    const base = { left: comp.x + 'px', top: comp.y + 'px', width: comp.w + 'px', zIndex: comp.style?.zIndex || 1 };
    if (comp.type === COMPONENT_TYPES.TABLE) base.height = 'auto'; 
    else if (comp.type === COMPONENT_TYPES.DRAW_LINE || comp.type === COMPONENT_TYPES.DRAW_PATH) {
        return { left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: comp.style?.zIndex || 10 };
    }
    else base.height = comp.h + 'px';
    return base;
}

const getLineAngle = (comp) => {
    const dx = comp.w - comp.x;
    const dy = comp.h - comp.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
}

// 批量删除
const removeComponent = () => { 
    if (activeComponentIds.value.length === 0) return;
    // 过滤掉所有选中的 ID
    layoutComponents.value = layoutComponents.value.filter(c => !activeComponentIds.value.includes(c.id));
    activeComponentIds.value = [];
};

const toggleView = () => { activeView.value = 'edit'; };

const editWrapperStyle = computed(() => ({
    width: (globalSettings.value.paperWidth * renderingScale.value / 100) + 'px',
    height: (1123 * renderingScale.value / 100) + 'px', 
    margin: '40px auto', 
    position: 'relative'
}));

const editScaleLayerStyle = computed(() => ({
    width: globalSettings.value.paperWidth + 'px',
    height: '1123px',
    transform: `scale(${renderingScale.value / 100})`, 
    transformOrigin: 'top left'
}));

const previewWrapperStyle = computed(() => ({
    transform: `scale(${renderingScale.value / 100})`, 
    width: globalSettings.value.paperWidth + 'px',
    transformOrigin: 'top center',
    paddingTop: (40 * 100 / renderingScale.value) + 'px', 
    paddingBottom: activeView === 'edit' ? (40 * 100 / renderingScale.value) + 'px' : '150px'
}));
</script>

<template>
    <div class="workspace-container" ref="workspaceRef" :class="{ 'preview-bg': activeView === 'preview' }">
        <div class="canvas-viewport" @mousedown="handleMouseDown($event, null)">
            
            <div class="canvas-transform-wrapper" 
                 :class="{ 'is-edit-mode': activeView === 'edit' }"
                 :style="activeView === 'edit' ? editWrapperStyle : previewWrapperStyle">
                
                <!-- EDIT MODE -->
                <div v-if="activeView === 'edit'" class="canvas-scale-layer" :style="editScaleLayerStyle">
                    <div class="paper-sheet">
                        <div v-for="g in vGuides" :key="'v'+g.pos" class="guide-line-v" :class="g.type" :style="{ left: g.pos + 'px' }"></div>
                        <div v-for="g in hGuides" :key="'h'+g.pos" class="guide-line-h" :class="g.type" :style="{ top: g.pos + 'px' }"></div>
                        
                        <div v-if="snapState.active" class="snap-marker" :style="{left: snapState.x + 'px', top: snapState.y + 'px'}"></div>

                        <!-- 渲染组件 -->
                        <div v-for="comp in layoutComponents" :key="comp.id" 
                             class="canvas-component"
                             :class="{ active: activeComponentIds.includes(comp.id), 'is-line': comp.type === COMPONENT_TYPES.DRAW_LINE || comp.type === COMPONENT_TYPES.DRAW_PATH }"
                             :style="getComponentStyle(comp)"
                             @mousedown="handleMouseDown($event, comp)">
                             
                            <svg v-if="comp.type === COMPONENT_TYPES.DRAW_LINE" style="width:100%;height:100%;overflow:visible;pointer-events:none;">
                                <line :x1="comp.x" :y1="comp.y" :x2="comp.w" :y2="comp.h" 
                                      :stroke="comp.style.strokeColor" 
                                      :stroke-width="comp.style.strokeWidth"
                                      :stroke-dasharray="getStrokeDashArray(comp.style.strokeStyle)"
                                      style="pointer-events:visibleStroke;cursor:pointer;"/>
                                <line :x1="comp.x" :y1="comp.y" :x2="comp.w" :y2="comp.h" stroke="transparent" stroke-width="10" style="pointer-events:visibleStroke;cursor:pointer;"/>
                            </svg>
                            <svg v-else-if="comp.type === COMPONENT_TYPES.DRAW_PATH" style="width:100%;height:100%;overflow:visible;pointer-events:none;">
                                <path :d="comp.d" :stroke="comp.style.strokeColor" :stroke-width="comp.style.strokeWidth" :stroke-dasharray="getStrokeDashArray(comp.style.strokeStyle)" fill="none" style="pointer-events:visibleStroke;cursor:pointer;"/>
                                <path :d="comp.d" stroke="transparent" stroke-width="10" fill="none" style="pointer-events:visibleStroke;cursor:pointer;"/>
                            </svg>
                            <!-- [核心修改] 形状组件允许 overflow 以避免描边被裁 -->
                            <div v-else class="comp-inner" :class="{ 'is-shape': comp.type === COMPONENT_TYPES.SHAPE_RECT || comp.type === COMPONENT_TYPES.SHAPE_CIRCLE }" v-html="renderComponentContent(comp, null, true)"></div>

                            <!-- 选中时的控制覆盖层 (如果是多选，只显示边框，不显示 ResizeHandle，除非只选了一个) -->
                            <div v-if="activeComponentIds.includes(comp.id) && comp.type !== COMPONENT_TYPES.DRAW_LINE && comp.type !== COMPONENT_TYPES.DRAW_PATH" class="selection-overlay">
                                <template v-if="activeComponentIds.length === 1">
                                    <div class="resize-handle nw" @mousedown.stop="handleMouseDown($event, comp, 'tl')"></div>
                                    <div class="resize-handle ne" @mousedown.stop="handleMouseDown($event, comp, 'tr')"></div>
                                    <div class="resize-handle sw" @mousedown.stop="handleMouseDown($event, comp, 'bl')"></div>
                                    <div class="resize-handle se" @mousedown.stop="handleMouseDown($event, comp, 'br')"></div>
                                    <div class="resize-handle e" @mousedown.stop="handleMouseDown($event, comp, 'r')"></div>
                                    <div class="resize-handle w" @mousedown.stop="handleMouseDown($event, comp, 'l')"></div>
                                    <template v-if="comp.type !== COMPONENT_TYPES.TABLE">
                                        <div class="resize-handle n" @mousedown.stop="handleMouseDown($event, comp, 't')"></div>
                                        <div class="resize-handle s" @mousedown.stop="handleMouseDown($event, comp, 'b')"></div>
                                    </template>
                                    <div class="float-toolbar" @mousedown.stop>
                                        <el-button :icon="Delete" circle size="small" type="danger" @click="removeComponent"/>
                                    </div>
                                </template>
                            </div>

                            <!-- [核心修改] 线条多选时也显示两端 Handle，表明被选中，但禁用鼠标事件防止变形 -->
                            <div v-if="activeComponentIds.includes(comp.id) && comp.type === COMPONENT_TYPES.DRAW_LINE" class="line-selection">
                                <div class="line-handle handle-circle" 
                                     :class="{ 'is-readonly': activeComponentIds.length > 1 }"
                                     :style="{left: comp.x + 'px', top: comp.y + 'px'}" 
                                     @mousedown.stop="activeComponentIds.length === 1 && handleMouseDown($event, comp, 'start')"></div>
                                
                                <div class="line-handle handle-square" 
                                     :class="{ 'is-readonly': activeComponentIds.length > 1 }"
                                     :style="{left: comp.w + 'px', top: comp.h + 'px'}" 
                                     @mousedown.stop="activeComponentIds.length === 1 && handleMouseDown($event, comp, 'end')"></div>
                                
                                <svg style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:-1"><line :x1="comp.x" :y1="comp.y" :x2="comp.w" :y2="comp.h" stroke="#409eff" stroke-width="1" stroke-dasharray="4 2" /></svg>
                                
                                <div v-if="activeComponentIds.length === 1" class="float-toolbar" :style="{
                                    left: (comp.x + comp.w) / 2 + 'px', 
                                    top: (comp.y + comp.h) / 2 + 'px', 
                                    right: 'auto',
                                    transform: `translate(-50%, -50%) rotate(${getLineAngle(comp)}deg) translateY(-22px)`
                                }" @mousedown.stop>
                                    <el-button :icon="Delete" circle size="small" type="danger" @click="removeComponent"/>
                                </div>
                            </div>
                        </div>

                        <!-- 框选区域 -->
                        <div v-if="dragState.isSelecting" class="selection-box"
                             :style="{
                                 left: dragState.selectionRect.x + 'px',
                                 top: dragState.selectionRect.y + 'px',
                                 width: dragState.selectionRect.w + 'px',
                                 height: dragState.selectionRect.h + 'px'
                             }">
                        </div>

                    </div>
                </div>

                <!-- PREVIEW MODE -->
                <div v-else class="preview-mode-container">
                    <div v-if="invoiceDataByCustomer.length === 0" class="empty-tip-container">
                        <div class="empty-state-card">
                            <div class="empty-icon-wrapper"><el-icon><InfoFilled /></el-icon></div>
                            <h3>暂无预览数据</h3>
                            <p>请在左侧多维表格中勾选数据行</p>
                            <el-button v-if="!globalSettings.isPreviewLocked" type="primary" link @click="toggleView">返回设计模式</el-button>
                        </div>
                    </div>
                    <div v-else class="preview-scroll-area">
                        <div v-for="(data, idx) in invoiceDataByCustomer" :key="idx" class="paper-sheet preview-sheet">
                            <div class="floating-page-badge">第 {{ idx + 1 }} 页</div>
                            <div v-for="comp in layoutComponents" :key="comp.id" class="canvas-component static" :style="getComponentStyle(comp)">
                                 <!-- [核心修改] 传递 idx 和 length 到渲染函数，实现正确页码渲染 -->
                                 <div class="comp-inner" v-html="renderComponentContent(comp, data, false, idx, invoiceDataByCustomer.length)"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.workspace-container { flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; background: #e0e0e0; transition: background 0.3s; }
.canvas-viewport { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 0; scrollbar-width: none; -ms-overflow-style: none; }
.canvas-viewport::-webkit-scrollbar { display: none; }

.canvas-transform-wrapper { 
    transition: width 0.1s linear, height 0.1s linear, transform 0.1s linear; 
    position: relative; 
}

.paper-sheet { width: 794px; height: 1123px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.15); position: relative; transition: all 0.3s; margin: 0 auto; }
.preview-mode-container { width: 100%; display: flex; flex-direction: column; align-items: center; padding-bottom: 50px; }
.preview-scroll-area { width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 10px; padding-bottom: 40px; }
.preview-sheet { margin-bottom: 30px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 2px; }
.preview-sheet:last-child { margin-bottom: 0; }
.floating-page-badge { position: absolute; top: -24px; left: 0; height: 20px; display: flex; align-items: center; padding: 0 8px; background-color: #5f6368; color: #fff; font-size: 11px; font-weight: 500; border-radius: 4px 4px 4px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.12); pointer-events: none; z-index: 5; }
.empty-tip-container { height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; min-height: 500px; }
.empty-state-card { text-align: center; background: #fff; padding: 60px 80px; border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
.empty-icon-wrapper { width: 96px; height: 96px; background: #e8f0fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: #1967d2; font-size: 48px; }

/* 标齐辅助线样式 */
.guide-line-v { position: absolute; top: 0; bottom: 0; width: 1px; z-index: 999; pointer-events: none; }
.guide-line-h { position: absolute; left: 0; right: 0; height: 1px; z-index: 999; pointer-events: none; }
.guide-line-v.canvas { border-left: 1px solid #f56c6c; } 
.guide-line-v.comp { border-left: 1px dashed #409eff; }   
.guide-line-h.canvas { border-top: 1px solid #f56c6c; }
.guide-line-h.comp { border-top: 1px dashed #409eff; }

.canvas-component { position: absolute; box-sizing: border-box; cursor: grab; border: 1px dashed transparent; }
.canvas-component:hover { border-color: #409eff; }
.canvas-component.active { border: 1px solid #409eff; cursor: move; z-index: 1000 !important; }
.canvas-component.static { pointer-events: none; border: none; }

/* 核心修改：comp-inner 默认 hidden，如果是 shape 则 visible */
.comp-inner { width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
.comp-inner.is-shape { overflow: visible !important; }

.resize-handle { position: absolute; width: 6px; height: 6px; background: #fff; border: 1px solid #409eff; border-radius: 50%; z-index: 1001; }
.nw { top: -3px; left: -3px; cursor: nw-resize; } .n { top: -3px; left: 50%; margin-left: -3px; cursor: n-resize; } .ne { top: -3px; right: -3px; cursor: ne-resize; } .e { top: 50%; right: -3px; margin-top: -3px; cursor: e-resize; } .se { bottom: -3px; right: -3px; cursor: se-resize; } .s { bottom: -3px; left: 50%; margin-left: -3px; cursor: s-resize; } .sw { bottom: -3px; left: -3px; cursor: sw-resize; } .w { top: 50%; left: -3px; margin-top: -3px; cursor: w-resize; }
.float-toolbar { position: absolute; top: -36px; right: 0; background: #fff; padding: 2px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); pointer-events: auto; }
.snap-marker { position: absolute; width: 14px; height: 14px; border: 3px solid #409eff; background: transparent; border-radius: 50%; transform: translate(-50%, -50%); z-index: 2000; pointer-events: none; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9); }
.line-selection { position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none; }
.line-handle { position: absolute; width: 10px; height: 10px; background: #fff; border: 2px solid #409eff; transform: translate(-50%, -50%); cursor: crosshair; pointer-events: auto; z-index: 1002; }
/* 纯展示状态的 Handle */
.line-handle.is-readonly { cursor: default; background: #f0f0f0; border-color: #a0cfff; }

/* 新增手柄形状样式 */
.handle-circle { border-radius: 50%; }
.handle-square { border-radius: 1px; }

.canvas-component.is-line { border: none !important; }
.canvas-component.is-line:hover { opacity: 0.8; }

/* 框选框样式 */
.selection-box {
    position: absolute;
    background-color: rgba(64, 158, 255, 0.1);
    border: 1px solid #409eff;
    z-index: 9999;
    pointer-events: none;
}
</style>