<script setup>
import { computed, watch, ref } from 'vue';
import { 
  ZoomIn, ZoomOut, RefreshLeft, RefreshRight, Delete, View, Printer, Edit, Document, Warning,
  Brush, ArrowDown, CaretBottom, Postcard, Loading // [修复] 引入 Loading 图标
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus'; 
import { 
  activeView, isDrawMode, activeComponentId, zoomScale, globalSettings, 
  templates, currentTemplateId, currentViewId 
} from '../store';
import { useHistory } from '../composables/useHistory';
import { useCanvas } from '../composables/useCanvas';
import { usePrint } from '../composables/usePrint';
import { useConfig, userStatus } from '../composables/useConfig'; 

const { historyIndex, undo, redo, clearCanvas } = useHistory();
const { historyStack } = useHistory(); 
const { exitDrawMode } = useCanvas();
const { print } = usePrint();
const { checkUserStatus } = useConfig(); 

const selectRef = ref(null); 

const isBoundToCurrentView = (t) => {
    if (!currentViewId.value || !t || !t.linkedViews) return false;
    return t.linkedViews.some(v => v.viewId === currentViewId.value);
};

watch(
    [() => globalSettings.value.isPreviewLocked, currentViewId, templates],
    ([isLocked]) => {
        if (isLocked) {
            const current = templates.value.find(t => t.id === currentTemplateId.value);
            const isCurrentBound = current && isBoundToCurrentView(current);
            if (!isCurrentBound) {
                const firstBound = templates.value.find(t => isBoundToCurrentView(t));
                currentTemplateId.value = firstBound ? firstBound.id : null;
            }
        }
    },
    { deep: true, immediate: true }
);

const availableTemplates = computed(() => {
    if (!templates.value) return [];
    const all = templates.value; 
    const boundTemplates = all.filter(t => isBoundToCurrentView(t));
    
    if (!globalSettings.value.isPreviewLocked) {
        if (currentTemplateId.value) {
            const current = all.find(t => t.id === currentTemplateId.value);
            if (current && !boundTemplates.some(t => t.id === current.id)) {
                return [...boundTemplates, current];
            }
        }
        return boundTemplates;
    }
    return boundTemplates;
});

const currentTemplateName = computed(() => {
    const t = templates.value.find(t => t.id === currentTemplateId.value);
    if (!t) return '选择模板';
    if (!globalSettings.value.isPreviewLocked && !isBoundToCurrentView(t)) {
        return `${t.name} (未绑定)`;
    }
    return t.name;
});

const isUnlinkedState = computed(() => !currentTemplateId.value);

const toggleView = () => {
    if (activeView.value === 'edit') {
        activeView.value = 'preview';
        activeComponentId.value = null;
        isDrawMode.value = false;
    } else {
        activeView.value = 'edit';
    }
};

const triggerSelect = () => {
    selectRef.value?.toggleMenu();
};

// [新增] 打印前强制校验权限
const handlePrint = async () => {
    // [修改] 修复 Loading 调用方式
    const loading = ElMessage({ message: '校验打印授权...', type: 'info', icon: Loading, duration: 0 });
    try {
        await checkUserStatus(); // 强制与数据库比对
    } catch(e) {
        loading.close();
        ElMessage.error('校验失败，请检查网络'); 
        return;
    }
    loading.close();

    if (!userStatus.isActive) {
        // App.vue 监听 isActive 变化会自动跳转激活页，这里只做提示
        ElMessage.warning('授权已过期，请前往激活');
        return;
    }
    print();
};
</script>

<template>
    <div class="top-toolbar">
        <!-- Left Section: Context & Status -->
        <div class="toolbar-section left">
            <!-- Draw Mode Status -->
            <div v-if="isDrawMode" class="status-pill draw">
                <el-icon class="status-icon"><Brush /></el-icon>
                <span class="status-text">绘制中</span>
                <div class="pill-divider"></div>
                <button class="pill-action" @click="exitDrawMode">退出</button>
            </div>

            <!-- Warning Status -->
            <div v-else-if="globalSettings.isPreviewLocked && isUnlinkedState" class="status-pill warning">
                <el-icon class="status-icon"><Warning /></el-icon>
                <span class="status-text">未关联</span>
            </div>

            <!-- Template Selector (Refined Google Docs Style) -->
            <div v-else class="template-selector-container">
                <!-- 图标容器：淡雅风格 -->
                <div class="doc-icon-wrapper">
                    <el-icon class="doc-icon"><Postcard /></el-icon>
                </div>
                
                <!-- 自定义触发器：自适应宽度 -->
                <el-tooltip 
                    :content="currentTemplateName" 
                    placement="bottom-start" 
                    :show-after="800"
                    :enterable="false"
                    effect="light"
                >
                    <div class="template-title-trigger" @click="triggerSelect">
                        <span class="template-name">{{ currentTemplateName }}</span>
                        <el-icon class="dropdown-arrow"><CaretBottom /></el-icon>
                    </div>
                </el-tooltip>

                <!-- 隐藏的 Select -->
                <el-select 
                    ref="selectRef"
                    v-model="currentTemplateId" 
                    class="hidden-select"
                    popper-class="google-docs-popper"
                    :teleported="true"
                >
                    <el-option 
                        v-for="t in availableTemplates" 
                        :key="t.id" 
                        :label="t.name" 
                        :value="t.id" 
                    />
                </el-select>
            </div>
        </div>

        <!-- Right Section: Tools -->
        <div class="toolbar-section right">
            
            <!-- History Group -->
            <div class="tool-capsule history-group" v-if="activeView === 'edit'">
                <el-tooltip content="撤销" :show-after="600" :enterable="false">
                    <button class="capsule-btn" @click="undo" :disabled="historyIndex <= 0">
                        <el-icon><RefreshLeft /></el-icon>
                    </button>
                </el-tooltip>
                <div class="capsule-divider"></div>
                <el-tooltip content="重做" :show-after="600" :enterable="false">
                    <button class="capsule-btn" @click="redo" :disabled="historyIndex >= historyStack.value?.length - 1">
                        <el-icon><RefreshRight /></el-icon>
                    </button>
                </el-tooltip>
            </div>

            <!-- Zoom Control -->
            <div class="tool-capsule zoom-group">
                <button class="capsule-btn" @click="zoomScale = Math.max(30, zoomScale - 10)">
                    <el-icon><ZoomOut /></el-icon>
                </button>
                <span class="zoom-val" @click="zoomScale = 100" title="重置">{{ zoomScale }}%</span>
                <button class="capsule-btn" @click="zoomScale = Math.min(200, zoomScale + 10)">
                    <el-icon><ZoomIn /></el-icon>
                </button>
            </div>

            <!-- View Toggle -->
            <div class="view-toggle-wrapper" v-if="!globalSettings.isPreviewLocked">
                <el-tooltip :content="activeView === 'edit' ? '预览模式' : '编辑模式'" :show-after="600">
                    <button class="icon-btn" :class="{ active: activeView === 'preview' }" @click="toggleView">
                        <el-icon v-if="activeView === 'edit'"><View /></el-icon>
                        <el-icon v-else><Edit /></el-icon>
                    </button>
                </el-tooltip>
            </div>

            <!-- Clear Canvas -->
            <div class="clear-wrapper" v-if="activeView === 'edit'">
                <el-tooltip content="清空画布" :show-after="600">
                    <button class="icon-btn danger" @click="clearCanvas">
                        <el-icon><Delete /></el-icon>
                    </button>
                </el-tooltip>
            </div>

            <!-- Separator -->
            <div class="separator"></div>

            <!-- Primary Action: Print -->
            <el-tooltip content="打印" :show-after="600" :disabled="false">
                <button class="print-fab" @click="handlePrint" :disabled="isUnlinkedState">
                    <div class="fab-content">
                        <el-icon><Printer /></el-icon>
                        <span class="fab-text">打印</span>
                    </div>
                </button>
            </el-tooltip>
        </div>
    </div>
</template>

<style scoped>
/* 容器 */
.top-toolbar {
    height: 48px; /* 紧凑高度 */
    background: #ffffff;
    box-shadow: 0 1px 0 rgba(0,0,0,0.05); 
    border-bottom: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    box-sizing: border-box;
    font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
    color: #1f1f1f;
    z-index: 100;
    width: 100%;
    user-select: none;
    gap: 16px; 
    overflow: hidden; 
}

/* --- Left Section --- */
.toolbar-section.left {
    flex: 1; /* 占据剩余所有空间 */
    display: flex;
    align-items: center;
    min-width: 0; /* 允许内部元素压缩至0，防止撑破 */
    gap: 8px; 
}

/* Template Selector Container */
.template-selector-container {
    display: flex;
    align-items: center;
    position: relative;
    height: 32px; 
    gap: 6px;
    flex: 1; /* 容器跟随 left section 伸缩 */
    min-width: 0; /* 允许压缩 */
}

/* 文档图标容器 */
.doc-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #ecf5ff; /* 极淡冰蓝 */
    border-radius: 8px; 
    flex-shrink: 0; /* 图标固定，不压缩 */
    transition: transform 0.2s ease;
}

.template-selector-container:hover .doc-icon-wrapper {
    transform: scale(1.05); 
}

.doc-icon {
    color: #409eff; 
    font-size: 16px; 
}

/* 自定义触发器：自适应宽度 */
.template-title-trigger {
    display: flex;
    align-items: center;
    padding: 0 6px;
    height: 28px; 
    border-radius: 4px; 
    cursor: pointer;
    transition: all 0.2s ease;
    
    /* 核心布局属性：确保能显示全但不过分 */
    flex: 0 1 auto; /* 默认显示全，空间不足时压缩 */
    min-width: 0;   /* 允许压缩 */
    max-width: 100%; /* 允许占据剩余全部空间 */
}

/* 悬停效果 */
.template-title-trigger:hover {
    background: rgba(0, 0, 0, 0.05); 
}

/* 文字样式：单行省略 */
.template-name {
    font-size: 14px; 
    font-weight: 500; 
    color: #1f1f1f;
    
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    line-height: 28px;
    /* 让文字占据触发器内的剩余空间 */
    flex: 1; 
}

/* 下拉箭头 */
.dropdown-arrow {
    margin-left: 4px;
    font-size: 10px; 
    color: #909399; 
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    flex-shrink: 0; /* 箭头固定，不压缩 */
}

.template-title-trigger:hover .dropdown-arrow {
    opacity: 0.8;
}

/* 隐藏真实的 el-select */
.hidden-select {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none; 
    visibility: hidden; 
}

/* Status Pill */
.status-pill {
    display: inline-flex;
    align-items: center;
    height: 24px; 
    padding: 0 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    gap: 4px;
    flex-shrink: 0; 
    white-space: nowrap; 
}
.status-pill.draw { background: #e8f0fe; color: #1a73e8; }
.status-pill.warning { background: #fef7e0; color: #b06000; }

.pill-divider { width: 1px; height: 10px; background: currentColor; opacity: 0.3; }
.pill-action {
    background: none; border: none; padding: 0; cursor: pointer;
    font-weight: 600; color: inherit; font-size: inherit;
    opacity: 0.8; white-space: nowrap;
}
.pill-action:hover { opacity: 1; text-decoration: underline; }

/* --- Right Section --- */
.toolbar-section.right {
    display: flex;
    align-items: center;
    gap: 6px; 
    flex-shrink: 0; 
}

/* Tool Capsule */
.tool-capsule {
    display: flex;
    align-items: center;
    background: #f1f3f4; 
    border-radius: 16px; 
    padding: 0 2px;
    height: 32px; 
    flex-shrink: 0;
}

.capsule-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #444746;
    cursor: pointer;
    font-size: 16px; 
    transition: all 0.2s;
    flex-shrink: 0;
}
.capsule-btn:hover:not(:disabled) { background: #e3e3e3; color: #1f1f1f; }
.capsule-btn:disabled { color: #e0e0e0; cursor: default; }

.capsule-divider { width: 1px; height: 14px; background: #c7c7c7; margin: 0 2px; }

.zoom-val {
    font-size: 12px;
    color: #444746;
    min-width: 36px;
    text-align: center;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    padding: 0 2px;
    white-space: nowrap;
}
.zoom-val:hover { color: #1a73e8; }

/* Icon Button */
.icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 50%; 
    color: #444746;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
}
.icon-btn:hover { background: rgba(0,0,0,0.06); color: #1f1f1f; }
.icon-btn.active { background: #c2e7ff; color: #001d35; } 
.icon-btn.danger:hover { background: #fee2e2; color: #b3261e; }

/* Print FAB */
.print-fab {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px; 
    min-width: 32px;
    padding: 0 16px; 
    background: #c2e7ff; 
    color: #001d35;      
    border: none;
    border-radius: 16px; 
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
    margin-left: 4px;
    flex-shrink: 0;
    overflow: hidden; 
}

.fab-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%; 
}

.print-fab:hover:not(:disabled) { 
    background: #b3d7ef; 
    box-shadow: 0 1px 2px rgba(0,0,0,0.1); 
}

.print-fab:active:not(:disabled) { 
    background: #a5cce5; 
    transform: scale(0.98); 
}

.print-fab:disabled { 
    background: #f1f3f4; 
    color: #c4c7c5; 
    cursor: not-allowed; 
    box-shadow: none;
}

.separator { width: 1px; height: 18px; background: #e0e2e5; margin: 0 2px; flex-shrink: 0; }

/* --- Responsive Layout --- */

@media (max-width: 768px) {
    .fab-text { display: none; }
    .print-fab { 
        padding: 0; 
        width: 32px; 
        border-radius: 50%; 
    }
}

@media (max-width: 580px) {
    .zoom-val { display: none; } 
    .zoom-group { background: transparent; padding: 0; } 
    .capsule-divider { display: none; } 
}
</style>

<!-- Global Styles for High-End Dropdown -->
<style>
.google-docs-popper.el-popper {
    background: #fff !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05) !important;
    padding: 6px 0 !important;
    min-width: 180px !important;
}

.google-docs-popper.el-popper .el-popper__arrow {
    display: none;
}

.google-docs-popper .el-select-dropdown__item {
    font-family: 'Google Sans', 'Roboto', sans-serif !important;
    font-size: 13px !important;
    font-weight: 400 !important;
    color: #3c4043 !important;
    height: 36px !important; 
    line-height: 36px !important;
    padding: 0 16px !important;
    margin: 0 !important;
}

.google-docs-popper .el-select-dropdown__item.selected {
    color: #1a73e8 !important;
    font-weight: 500 !important;
    background-color: #e8f0fe !important;
}

.google-docs-popper .el-select-dropdown__item:hover {
    background-color: #f5f5f5 !important;
}
</style>