<script setup>
import { 
  Menu, Setting, Operation, Lock, Unlock, Expand, Fold 
} from '@element-plus/icons-vue';
import { 
  isPanelCollapsed, panelHeight, isPanelLocked, activeTab, 
  globalSettings, activeComponentId, isDrawMode 
} from '../store';
import ComponentLibrary from './panel/ComponentLibrary.vue';
import PropertiesPanel from './panel/PropertiesPanel.vue';
import GlobalManager from './panel/GlobalManager.vue';

import { ref } from 'vue';

const isResizing = ref(false); 
const startResize = (e) => {
    if (isPanelLocked.value) return;
    isResizing.value = true; e.preventDefault(); 
    document.addEventListener('mousemove', onResize); document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
};
const onResize = (e) => {
    if (!isResizing.value) return;
    const h = window.innerHeight - e.clientY;
    if (h > 40 && h < window.innerHeight - 100) { panelHeight.value = h; if (isPanelCollapsed.value) isPanelCollapsed.value = false; }
};
const stopResize = () => { isResizing.value = false; document.removeEventListener('mousemove', onResize); document.removeEventListener('mouseup', stopResize); document.body.style.userSelect = ''; };

const handleTogglePanel = () => { if (!isPanelLocked.value) isPanelCollapsed.value = !isPanelCollapsed.value; };

const handleTabClick = (tabName) => {
    if (globalSettings.value.isPreviewLocked && tabName !== 'global') return;
    activeTab.value = tabName;
    
    if (!isPanelLocked.value && isPanelCollapsed.value) {
        isPanelCollapsed.value = false;
    }
};
</script>

<template>
    <div class="bottom-panel" :class="{ collapsed: isPanelCollapsed }" :style="{ height: isPanelCollapsed ? '32px' : panelHeight + 'px', transition: isResizing ? 'none' : '' }">
        <div class="resize-handle-bar" @mousedown="startResize" :class="{ 'is-locked': isPanelLocked }"></div>
        
        <!-- Header -->
        <div class="panel-header">
            <div class="header-tabs">
                <div class="tab-item" :class="{ active: activeTab === 'components' && !globalSettings.isPreviewLocked }" @click="handleTabClick('components')" v-if="!globalSettings.isPreviewLocked">
                    <el-icon><Menu /></el-icon><span>组件</span>
                </div>
                <!-- 修复：移除了 disabled 逻辑，确保属性面板始终可点击（选中组件看属性，没选中看全局设置） -->
                <div class="tab-item" :class="{ active: activeTab === 'properties' && !globalSettings.isPreviewLocked }" @click="handleTabClick('properties')" v-if="!globalSettings.isPreviewLocked">
                    <el-icon><Setting /></el-icon><span>属性</span>
                </div>
                <div class="tab-item" :class="{ active: activeTab === 'global' }" @click="handleTabClick('global')">
                    <el-icon><Operation /></el-icon><span>管理</span>
                </div>
            </div>
            
            <div class="header-actions">
                <button class="icon-btn" @click="isPanelLocked = !isPanelLocked" :class="{ active: isPanelLocked }" :title="isPanelLocked ? '解锁' : '锁定'">
                    <el-icon><component :is="isPanelLocked ? Lock : Unlock" /></el-icon>
                </button>
                <button class="icon-btn" @click="handleTogglePanel" :disabled="isPanelLocked" :style="{ opacity: isPanelLocked ? 0.5 : 1 }">
                    <el-icon :class="{ 'rotate-180': !isPanelCollapsed }"><component :is="isPanelCollapsed ? Expand : Fold" /></el-icon>
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="panel-content" v-show="!isPanelCollapsed">
            <ComponentLibrary v-if="activeTab === 'components'" />
            <PropertiesPanel v-else-if="activeTab === 'properties'" />
            <GlobalManager v-else-if="activeTab === 'global'" />
        </div>
    </div>
</template>

<style scoped>
.bottom-panel {
    background: #ffffff; border-top: 1px solid #e0e0e0; display: flex; flex-direction: column;
    position: relative; font-family: 'Roboto', 'Helvetica Neue', sans-serif; color: #3c4043;
    z-index: 200; box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
}
.resize-handle-bar { height: 5px; background: transparent; cursor: row-resize; position: absolute; top: -2px; left: 0; right: 0; z-index: 201; }
.resize-handle-bar:hover { background: #1a73e8; opacity: 0.2; }
.resize-handle-bar.is-locked { pointer-events: none; }

.panel-header {
    height: 32px; display: flex; justify-content: space-between; align-items: center;
    padding: 0 12px; border-bottom: 1px solid #f1f3f4; background: #fff; flex-shrink: 0;
}
.header-tabs { display: flex; height: 100%; gap: 16px; }
.tab-item {
    display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #5f6368;
    cursor: pointer; height: 100%; position: relative; padding: 0 4px; transition: color 0.2s;
}
.tab-item:hover { color: #202124; }
.tab-item.active { color: #1a73e8; }
.tab-item.active::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    background: #1a73e8; border-radius: 2px 2px 0 0;
}
.tab-item.disabled { opacity: 0.4; cursor: not-allowed; }

.header-actions { display: flex; gap: 4px; }
.icon-btn {
    width: 24px; height: 24px; border: none; background: transparent; border-radius: 4px;
    color: #5f6368; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
}
.icon-btn:hover { background: #f1f3f4; color: #202124; }
.icon-btn.active { color: #1a73e8; background: #e8f0fe; }
.rotate-180 { transform: rotate(180deg); }

.panel-content { flex: 1; overflow-y: auto; background: #fafafa; padding: 12px; display: flex; flex-direction: column; }
</style>