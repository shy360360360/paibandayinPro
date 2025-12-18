<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { Rank, Monitor, QuestionFilled, Edit, Setting, Brush, Delete, DocumentCopy } from '@element-plus/icons-vue';
import { activeComponent, activeComponentIds, activeView, globalSettings, globalOps, allFields, layoutComponents } from '../../../store';
import { COMPONENT_TYPES, LINE_STYLES, BORDER_STYLES } from '../../../constants';
import { useCanvas } from '../../../composables/useCanvas';
import { uuid } from '../../../utils';
import { ElMessage } from 'element-plus';

const { centerActiveComponent, alignLine } = useCanvas();

// --- 核心新增：组件复制逻辑 ---
const handleCopy = () => {
    if (!activeComponent.value) return;
    
    // 1. 深拷贝当前组件数据
    const clone = JSON.parse(JSON.stringify(activeComponent.value));
    
    // 2. 生成新 ID 并错位显示
    clone.id = uuid();
    clone.x += 20;
    clone.y += 20;
    
    // 3. 添加到画布并选中
    layoutComponents.value.push(clone);
    activeComponentIds.value = [clone.id];
    
    // 4. 轻提示
    ElMessage.success({ message: '✨ 组件已复制', type: 'success', duration: 2000 });
};

// 线条长度逻辑 (保持不变)
const lineLength = computed({
    get: () => {
        if (!activeComponent.value || activeComponent.value.type !== COMPONENT_TYPES.DRAW_LINE) return 0;
        const dx = activeComponent.value.w - activeComponent.value.x;
        const dy = activeComponent.value.h - activeComponent.value.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy));
    },
    set: (val) => {
        if (!activeComponent.value || val < 0) return;
        const dx = activeComponent.value.w - activeComponent.value.x;
        const dy = activeComponent.value.h - activeComponent.value.y;
        const currentLen = Math.sqrt(dx * dx + dy * dy);
        if (currentLen === 0) { activeComponent.value.w = activeComponent.value.x + val; return; }
        const ratio = val / currentLen;
        activeComponent.value.w = Math.round(activeComponent.value.x + dx * ratio);
        activeComponent.value.h = Math.round(activeComponent.value.y + dy * ratio);
    }
});

// 键盘监听 (保持不变)
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
  <div class="prop-sidebar fade-in" v-if="activeComponent">
    
    <!-- 1. 通用几何卡片 (Geometry Card) -->
    <div class="prop-card">
        <div class="card-header">
            <span class="label"><el-icon><Rank /></el-icon> 布局位置</span>
            
            <div class="tool-icons">
                <!-- [核心新增] 复制按钮：视觉锚点 -->
                <el-tooltip content="复制当前组件" :show-after="500">
                    <div class="action-capsule-primary" @click="handleCopy">
                        <el-icon class="capsule-icon"><DocumentCopy /></el-icon>
                        <span class="capsule-text">复制</span>
                    </div>
                </el-tooltip>
                
                <div class="divider-v"></div>

                <el-tooltip content="水平居中" :show-after="500"><div class="icon-btn" @click="centerActiveComponent('horizontal')"><el-icon><Monitor /></el-icon></div></el-tooltip>
                <el-tooltip content="垂直居中" :show-after="500"><div class="icon-btn" @click="centerActiveComponent('vertical')"><el-icon class="rotate-90"><Monitor /></el-icon></div></el-tooltip>
            </div>
        </div>
        
        <!-- 坐标网格 (Coordinate Grid) -->
        <div class="coord-grid">
            <div class="coord-item">
                <span class="axis-tag x">X</span>
                <el-input-number v-model="activeComponent.x" :controls="false" class="naked-input" />
            </div>
            <div class="coord-item">
                <span class="axis-tag y">Y</span>
                <el-input-number v-model="activeComponent.y" :controls="false" class="naked-input" />
            </div>
            <div class="coord-item">
                <span class="axis-tag w">{{ activeComponent.type === COMPONENT_TYPES.DRAW_LINE ? 'X2' : 'W' }}</span>
                <el-input-number v-model="activeComponent.w" :controls="false" class="naked-input" />
            </div>
            <div class="coord-item" v-if="activeComponent.type !== COMPONENT_TYPES.TABLE">
                <span class="axis-tag h">{{ activeComponent.type === COMPONENT_TYPES.DRAW_LINE ? 'Y2' : 'H' }}</span>
                <el-input-number v-model="activeComponent.h" :controls="false" class="naked-input" />
            </div>
        </div>

        <!-- 线条特有属性 -->
        <div class="extra-geo" v-if="activeComponent.type === COMPONENT_TYPES.DRAW_LINE">
            <div class="coord-item full">
                <span class="axis-tag l">Len</span>
                <el-input-number v-model="lineLength" :controls="false" class="naked-input" />
                <span class="unit">px</span>
            </div>
            <div class="line-tools">
                <button class="tiny-btn" @click="alignLine('h')">水平拉直</button>
                <button class="tiny-btn" @click="alignLine('v')">垂直拉直</button>
            </div>
        </div>
    </div>

    <!-- 2. 内容配置 (Content Configuration) -->
    <!-- 文本类 -->
    <template v-if="[COMPONENT_TYPES.TITLE, COMPONENT_TYPES.TEXT_ROW, COMPONENT_TYPES.RICH_TEXT, COMPONENT_TYPES.V_TEXT].includes(activeComponent.type)">
        <div class="prop-card">
            <div class="card-header"><span class="label"><el-icon><Edit /></el-icon> 文本内容</span></div>
            <el-input 
                v-model="activeComponent.content" 
                :type="activeComponent.type === COMPONENT_TYPES.RICH_TEXT ? 'textarea' : 'text'" 
                :rows="3" resize="none" class="modern-textarea" placeholder="在此输入内容..." 
            />
            
            <div class="style-row mt-3">
                <div class="style-group flex-1">
                    <span class="sub-label">字号</span>
                    <el-input-number v-model="activeComponent.style.fontSize" :controls="false" class="pill-input full" />
                </div>
                <div class="style-group flex-2">
                    <span class="sub-label">对齐</span>
                    <el-radio-group v-model="activeComponent.style.textAlign" class="capsule-radio w-full">
                        <el-radio-button label="left">左</el-radio-button>
                        <el-radio-button label="center">中</el-radio-button>
                        <el-radio-button label="right">右</el-radio-button>
                    </el-radio-group>
                </div>
            </div>
            <div class="style-row mt-2" v-if="activeComponent.type === COMPONENT_TYPES.V_TEXT">
                <div class="style-group flex-1">
                    <span class="sub-label">字间距</span>
                    <el-input-number v-model="activeComponent.style.letterSpacing" :controls="false" class="pill-input full" />
                </div>
            </div>
        </div>

        <div class="prop-card">
            <div class="card-header"><span class="label"><el-icon><Brush /></el-icon> 装饰样式</span></div>
            <div class="style-grid">
                <div class="style-cell">
                    <span class="mini-label">背景</span>
                    <div class="color-dot-wrapper">
                        <el-color-picker v-model="activeComponent.style.backgroundColor" show-alpha size="small" />
                    </div>
                </div>
                <div class="style-cell span-2">
                    <span class="mini-label">边框</span>
                    <el-select v-model="activeComponent.style.borderStyle" size="small" class="clean-select"><el-option v-for="s in BORDER_STYLES" :key="s.value" :label="s.label" :value="s.value"/></el-select>
                </div>
                <template v-if="activeComponent.style.borderStyle !== 'none'">
                    <div class="style-cell">
                        <span class="mini-label">框色</span>
                        <div class="color-dot-wrapper">
                            <el-color-picker v-model="activeComponent.style.borderColor" size="small" />
                        </div>
                    </div>
                    <div class="style-cell"><span class="mini-label">线宽</span><el-input-number v-model="activeComponent.style.borderWidth" :controls="false" class="naked-num" /></div>
                    <div class="style-cell"><span class="mini-label">圆角</span><el-input-number v-model="activeComponent.style.borderRadius" :controls="false" class="naked-num" /></div>
                </template>
                <div class="style-cell"><span class="mini-label">内距</span><el-input-number v-model="activeComponent.style.padding" :controls="false" class="naked-num" /></div>
            </div>
        </div>
    </template>

    <!-- 表格类 -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.TABLE">
        <div class="prop-card">
            <div class="card-header"><span class="label"><el-icon><Setting /></el-icon> 表格配置</span></div>
            <div class="form-stack">
                <div class="form-item">
                    <!-- 灵动 Header 区域 -->
                    <div class="header-row-smart">
                        <span class="sub-label">数据列</span>
                        <!-- 呼吸感动画容器 -->
                        <transition name="pop-fade">
                            <div 
                                v-if="activeComponent.selectedFieldIds && activeComponent.selectedFieldIds.length > 0" 
                                class="action-capsule-danger" 
                                @click="activeComponent.selectedFieldIds = []"
                            >
                                <el-icon class="capsule-icon"><Delete /></el-icon>
                                <span class="capsule-text">清空</span>
                            </div>
                        </transition>
                    </div>
                    <el-select v-model="activeComponent.selectedFieldIds" multiple placeholder="选择列" size="small" class="modern-multi-select"><el-option v-for="f in allFields" :key="f.id" :label="f.name" :value="f.id" /></el-select>
                </div>
                <div class="form-item">
                    <span class="sub-label">列宽比例 (如 1,2,1)</span>
                    <el-input v-model="activeComponent.columnWidths" size="small" placeholder="自动" class="clean-input"/>
                </div>
                <div class="param-row-3">
                    <div class="p-col"><span class="sub-label">行高</span><el-input-number v-model="activeComponent.rowHeight" :controls="false" class="pill-input full"/></div>
                    <div class="p-col"><span class="sub-label">字号</span><el-input-number v-model="activeComponent.dataFontSize" :controls="false" class="pill-input full"/></div>
                    <div class="p-col"><span class="sub-label">空行</span><el-input-number v-model="activeComponent.emptyRows" :controls="false" class="pill-input full"/></div>
                </div>
                <div class="divider"></div>
                <div class="toggle-row">
                    <span class="text-sm font-medium">显示合计/合并行</span>
                    <el-switch v-model="activeComponent.showSummary" size="small" />
                </div>
                <div class="summary-config" v-if="activeComponent.showSummary">
                    <div class="sum-row"><span class="tag">左</span><el-input v-model="activeComponent.summaryConfig.left" size="small" class="clean-input" /></div>
                    <div class="sum-row"><span class="tag">中</span><el-input v-model="activeComponent.summaryConfig.center" size="small" class="clean-input" /></div>
                    <div class="sum-row"><span class="tag">右</span><el-input v-model="activeComponent.summaryConfig.right" size="small" class="clean-input" /></div>
                </div>
            </div>
        </div>
    </template>

    <!-- 形状类 (Rect, Circle, Divider) -->
    <template v-if="[COMPONENT_TYPES.SHAPE_RECT, COMPONENT_TYPES.SHAPE_CIRCLE, COMPONENT_TYPES.DIVIDER].includes(activeComponent.type)">
        <div class="prop-card">
            <div class="card-header"><span class="label"><el-icon><Brush /></el-icon> 形状样式</span></div>
            <div class="style-grid compact">
                <template v-if="activeComponent.type !== COMPONENT_TYPES.DIVIDER">
                    <div class="style-cell flex-row">
                        <span class="mini-label">填充</span>
                        <div class="color-dot-wrapper"><el-color-picker v-model="activeComponent.style.fillColor" show-alpha size="small" /></div>
                    </div>
                </template>
                <div class="style-cell flex-row">
                    <span class="mini-label">描边</span>
                    <div class="color-dot-wrapper"><el-color-picker v-model="activeComponent.style.strokeColor" size="small" /></div>
                </div>
                <div class="style-cell"><span class="mini-label">线宽</span><el-input-number v-model="activeComponent.style.strokeWidth" :min="0" :controls="false" class="naked-num" /></div>
                <div class="style-cell span-3">
                    <span class="mini-label">样式</span>
                    <el-select v-model="activeComponent.style.strokeStyle" size="small" class="clean-select"><el-option v-for="s in LINE_STYLES" :key="s.value" :label="s.label" :value="s.value"/></el-select>
                </div>
                <div class="style-cell" v-if="activeComponent.type === COMPONENT_TYPES.SHAPE_RECT"><span class="mini-label">圆角</span><el-input-number v-model="activeComponent.style.borderRadius" :min="0" :controls="false" class="naked-num" /></div>
            </div>
            <div class="mt-3" v-if="activeComponent.type === COMPONENT_TYPES.DIVIDER">
                <span class="sub-label">方向</span>
                <el-radio-group v-model="activeComponent.orientation" size="small" class="capsule-radio w-full">
                    <el-radio-button label="h">水平</el-radio-button>
                    <el-radio-button label="v">垂直</el-radio-button>
                </el-radio-group>
            </div>
        </div>
    </template>

    <!-- 特殊组件 (DateTime, PageNumber, Signature, Checkbox, Image, QRCode) -->
    <!-- DateTime -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.DATETIME">
        <div class="prop-card">
            <div class="card-header"><span class="label">日期时间</span></div>
            <div class="toggle-row mb-2"><span class="text-sm">自动当前时间</span><el-switch v-model="activeComponent.autoCurrent" size="small" /></div>
            <el-input v-if="!activeComponent.autoCurrent" v-model="activeComponent.content" placeholder="自定义内容" size="small" class="clean-input mb-2"/>
            <div class="mb-1"><span class="sub-label">格式 (YYYY-MM-DD)</span><el-input v-model="activeComponent.format" size="small" class="clean-input"/></div>
            <div class="style-row mt-2">
                <div class="style-group flex-1"><span class="sub-label">字号</span><el-input-number v-model="activeComponent.style.fontSize" :controls="false" class="pill-input full" /></div>
                <div class="style-group flex-2"><span class="sub-label">对齐</span><el-radio-group v-model="activeComponent.style.textAlign" class="capsule-radio w-full"><el-radio-button label="left">左</el-radio-button><el-radio-button label="center">中</el-radio-button><el-radio-button label="right">右</el-radio-button></el-radio-group></div>
            </div>
        </div>
    </template>

    <!-- Page Number -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.PAGE_NUMBER">
        <div class="prop-card">
            <div class="card-header"><span class="label">页码设置</span></div>
            <div class="mb-2"><span class="sub-label">格式文本 ({{'{page}'}}/{{'{total}'}})</span><el-input v-model="activeComponent.format" size="small" class="clean-input"/></div>
            <div class="style-row">
                <div class="style-group flex-1"><span class="sub-label">字号</span><el-input-number v-model="activeComponent.style.fontSize" :controls="false" class="pill-input full" /></div>
                <div class="style-group flex-2"><span class="sub-label">对齐</span><el-radio-group v-model="activeComponent.style.textAlign" class="capsule-radio w-full"><el-radio-button label="left">左</el-radio-button><el-radio-button label="center">中</el-radio-button><el-radio-button label="right">右</el-radio-button></el-radio-group></div>
            </div>
        </div>
    </template>

    <!-- Signature -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.SIGNATURE">
        <div class="prop-card">
            <div class="card-header"><span class="label">签名区</span></div>
            <div class="mb-2"><span class="sub-label">标签文本</span><el-input v-model="activeComponent.label" size="small" class="clean-input"/></div>
            <div class="toggle-row mb-2"><span class="text-sm">显示日期栏</span><el-switch v-model="activeComponent.showDate" size="small" /></div>
            <div class="style-group"><span class="sub-label">字号</span><el-input-number v-model="activeComponent.style.fontSize" :controls="false" class="pill-input full" /></div>
        </div>
    </template>

    <!-- Checkbox -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.CHECKBOX">
        <div class="prop-card">
            <div class="card-header"><span class="label">勾选框</span></div>
            <div class="toggle-row mb-2"><span class="text-sm">选中状态</span><el-switch v-model="activeComponent.checked" size="small" /></div>
            <div class="mb-2"><span class="sub-label">标签</span><el-input v-model="activeComponent.content" size="small" class="clean-input"/></div>
            <div class="style-group"><span class="sub-label">字号</span><el-input-number v-model="activeComponent.style.fontSize" :controls="false" class="pill-input full" /></div>
        </div>
    </template>

    <!-- Image/QR -->
    <template v-if="[COMPONENT_TYPES.IMAGE, COMPONENT_TYPES.QR_CODE].includes(activeComponent.type)">
        <div class="prop-card">
            <div class="card-header"><span class="label">媒体源</span></div>
            <div class="mb-2">
                <span class="sub-label">{{ activeComponent.type === COMPONENT_TYPES.IMAGE ? '图片链接' : '二维码内容' }}</span>
                <el-input v-if="activeComponent.type === COMPONENT_TYPES.IMAGE" v-model="activeComponent.src" size="small" class="clean-input" placeholder="输入URL或变量"/>
                <el-input v-else v-model="activeComponent.content" size="small" class="clean-input" placeholder="输入URL或变量"/>
            </div>
            <div v-if="activeComponent.type === COMPONENT_TYPES.IMAGE">
                <span class="sub-label">填充模式</span>
                <el-radio-group v-model="activeComponent.style.objectFit" size="small" class="capsule-radio w-full">
                    <el-radio-button label="contain">适应</el-radio-button><el-radio-button label="cover">覆盖</el-radio-button><el-radio-button label="fill">拉伸</el-radio-button>
                </el-radio-group>
            </div>
        </div>
    </template>

    <!-- Path (基本保留) -->
    <template v-if="activeComponent.type === COMPONENT_TYPES.DRAW_PATH">
        <div class="prop-card">
            <div class="card-header"><span class="label">路径样式</span></div>
            <div class="style-grid compact">
                <div class="style-cell flex-row"><span class="mini-label">颜色</span><div class="color-dot-wrapper"><el-color-picker v-model="activeComponent.style.strokeColor" size="small" /></div></div>
                <div class="style-cell"><span class="mini-label">粗细</span><el-input-number v-model="activeComponent.style.strokeWidth" :controls="false" class="naked-num" /></div>
                <div class="style-cell span-3"><span class="mini-label">线型</span><el-select v-model="activeComponent.style.strokeStyle" size="small" class="clean-select"><el-option v-for="s in LINE_STYLES" :key="s.value" :label="s.label" :value="s.value"/></el-select></div>
            </div>
        </div>
    </template>

  </div>
</template>

<style scoped>
.prop-sidebar { display: flex; flex-direction: column; gap: 12px; padding: 4px; }

/* 通用卡片 */
.prop-card {
    background: #fff; border-radius: 16px; padding: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
    transition: all 0.3s ease;
}
.prop-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.05); }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.label { font-size: 11px; font-weight: 700; color: #4b5563; text-transform: uppercase; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px; }
.tool-icons { display: flex; gap: 6px; align-items: center; }
.divider-v { width: 1px; height: 16px; background: #e5e7eb; margin: 0 2px; }

.icon-btn { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #9ca3af; cursor: pointer; transition: all 0.2s; }
.icon-btn:hover { background: #eff6ff; color: #3b82f6; }
.rotate-90 { transform: rotate(90deg); }

/* [新增] 复制按钮 - 视觉锚点 */
.action-capsule-primary {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 10px;
    background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%); 
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    font-size: 10px; font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);
    user-select: none;
}
.action-capsule-primary:hover {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
}
.action-capsule-primary:active { transform: translateY(0) scale(0.95); }
.capsule-icon { font-size: 11px; }

/* 坐标网格 */
.coord-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
.coord-item {
    background: #f9fafb; border-radius: 10px; padding: 4px; border: 1px solid #f3f4f6;
    display: flex; flex-direction: column; align-items: center; gap: 2px; transition: all 0.2s;
}
.coord-item:focus-within { border-color: #3b82f6; background: #fff; box-shadow: 0 2px 8px rgba(59,130,246,0.1); }
.axis-tag { font-size: 9px; font-weight: 800; color: #9ca3af; text-transform: uppercase; }
.axis-tag.x { color: #ef4444; } .axis-tag.y { color: #22c55e; } .axis-tag.w { color: #3b82f6; } .axis-tag.h { color: #f59e0b; }

.naked-input :deep(.el-input__wrapper) { box-shadow: none !important; padding: 0; background: transparent; }
.naked-input :deep(.el-input__inner) { text-align: center; font-size: 12px; font-weight: 600; color: #1f2937; height: 20px; padding: 0; }

.extra-geo { display: flex; gap: 8px; align-items: center; background: #f3f4f6; padding: 4px; border-radius: 8px; }
.coord-item.full { flex: 1; flex-direction: row; justify-content: center; background: #fff; height: 28px; }
.line-tools { display: flex; gap: 4px; }
.tiny-btn { font-size: 10px; border: none; background: #fff; padding: 0 8px; border-radius: 6px; cursor: pointer; height: 28px; color: #4b5563; font-weight: 500; }
.tiny-btn:hover { color: #3b82f6; }

/* 内容输入 */
.modern-textarea :deep(.el-textarea__inner) {
    border-radius: 12px; background: #f9fafb; border-color: #e5e7eb; font-size: 12px; padding: 8px; font-family: inherit; transition: all 0.2s; box-shadow: none;
}
.modern-textarea :deep(.el-textarea__inner:focus) { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }

/* 样式控件 */
.style-row { display: flex; gap: 12px; }
.style-group { display: flex; flex-direction: column; gap: 4px; }
.flex-1 { flex: 1; } .flex-2 { flex: 2; }
.sub-label { font-size: 10px; font-weight: 500; color: #6b7280; }

.pill-input.full { width: 100%; }
.pill-input :deep(.el-input__wrapper) { border-radius: 8px; background: #f9fafb; box-shadow: none !important; border: 1px solid #e5e7eb; padding: 0 8px; }
.pill-input :deep(.el-input__inner) { text-align: center; font-size: 12px; height: 28px; }

.capsule-radio :deep(.el-radio-button__inner) {
    border: none; background: #f3f4f6; font-size: 11px; height: 28px; line-height: 28px; padding: 0 10px; box-shadow: none !important;
}
.capsule-radio :deep(.el-radio-button:first-child .el-radio-button__inner) { border-radius: 8px 0 0 8px; }
.capsule-radio :deep(.el-radio-button:last-child .el-radio-button__inner) { border-radius: 0 8px 8px 0; }
.capsule-radio :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: #3b82f6; color: #fff; box-shadow: 0 2px 4px rgba(59,130,246,0.3) !important;
}

/* 样式网格 */
.style-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.style-grid.compact { grid-template-columns: repeat(2, 1fr); }
.style-cell {
    background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 10px; padding: 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
}
.style-cell.flex-row { flex-direction: row; gap: 8px; }
.span-2 { grid-column: span 2; } .span-3 { grid-column: span 3; }
.mini-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; font-weight: 700; }

.color-dot-wrapper :deep(.el-color-picker__trigger) { border: none; width: 24px; height: 24px; padding: 0; }
.naked-num :deep(.el-input__wrapper) { box-shadow: none !important; background: transparent; padding: 0; }
.naked-num :deep(.el-input__inner) { text-align: center; height: 20px; font-size: 12px; font-weight: 600; }

.clean-select { width: 100%; }
.clean-select :deep(.el-input__wrapper) { box-shadow: none !important; background: transparent; padding: 0 4px; }
.clean-select :deep(.el-input__inner) { font-size: 12px; height: 20px; text-align: center; }

/* 表单堆栈 */
.form-stack { display: flex; flex-direction: column; gap: 10px; }
.clean-input :deep(.el-input__wrapper) { border-radius: 8px; background: #f9fafb; box-shadow: none !important; border: 1px solid #e5e7eb; padding: 0 8px; }
.clean-input :deep(.el-input__inner) { font-size: 12px; height: 28px; }
.param-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.toggle-row { display: flex; justify-content: space-between; align-items: center; background: #f9fafb; padding: 6px 10px; border-radius: 10px; }
.summary-config { background: #f9fafb; border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px; border: 1px dashed #e5e7eb; }
.sum-row { display: flex; align-items: center; gap: 8px; }
.tag { font-size: 10px; color: #9ca3af; width: 14px; text-align: center; }

.text-sm { font-size: 11px; color: #4b5563; }
.divider { height: 1px; background: #f3f4f6; margin: 4px 0; }
.mb-1 { margin-bottom: 4px; } .mb-2 { margin-bottom: 8px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; }
.w-full { width: 100%; }

/* 灵动 Header */
.header-row-smart {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; height: 20px;
}

/* 潮流胶囊按钮 (清空) */
.action-capsule-danger {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 8px;
    background: #fee2e2; color: #ef4444;
    border-radius: 12px;
    font-size: 10px; font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 5px rgba(239, 68, 68, 0.15);
    user-select: none;
}
.action-capsule-danger:hover {
    background: #fecaca;
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 4px 8px rgba(239, 68, 68, 0.25);
}
.action-capsule-danger:active {
    transform: translateY(0) scale(0.95);
}

/* 呼吸感进出动画 */
.pop-fade-enter-active, .pop-fade-leave-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-fade-enter-from, .pop-fade-leave-to {
    opacity: 0;
    transform: translateX(10px) scale(0.8);
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
</style>