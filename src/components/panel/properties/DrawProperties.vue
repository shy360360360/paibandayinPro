<script setup>
import { Aim, EditPen, Operation } from '@element-plus/icons-vue';
import { drawSettings } from '../../../store';
import { LINE_STYLES } from '../../../constants';
</script>

<template>
  <div class="draw-panel fade-in">
    <!-- 头部标识 -->
    <div class="panel-header">
        <div class="icon-bubble"><el-icon><EditPen /></el-icon></div>
        <span>画笔工具箱</span>
    </div>

    <!-- 1. 线条样式卡片 -->
    <div class="setting-card">
        <div class="card-label"><el-icon><Operation /></el-icon> 线条样式</div>
        <div class="control-row">
            <el-select v-model="drawSettings.strokeStyle" size="small" class="pill-select w-full" :teleported="false">
                <el-option v-for="s in LINE_STYLES" :key="s.value" :label="s.label" :value="s.value"/>
            </el-select>
        </div>
        
        <div class="control-row mt-3">
            <div class="slider-wrapper">
                <span class="sub-label">粗细 {{ drawSettings.strokeWidth }}px</span>
                <el-slider v-model="drawSettings.strokeWidth" :min="1" :max="20" :show-tooltip="false" size="small" />
            </div>
        </div>
    </div>

    <!-- 2. 颜色与锁定 -->
    <div class="setting-card">
        <div class="control-row space-between">
            <div class="color-control">
                <span class="sub-label">笔触颜色</span>
                <div class="color-pill">
                    <el-color-picker v-model="drawSettings.strokeColor" size="small" />
                    <span class="color-hex">{{ drawSettings.strokeColor }}</span>
                </div>
            </div>
        </div>

        <div class="divider" v-if="drawSettings.type === 'line'"></div>

        <div class="lock-control" v-if="drawSettings.type === 'line'">
            <span class="sub-label">方向锁定</span>
            <div class="toggle-capsule">
                <div class="toggle-item" :class="{ active: drawSettings.lockDirection === 'none' }" @click="drawSettings.lockDirection = 'none'">
                    <el-icon><Aim /></el-icon>
                </div>
                <div class="toggle-item text" :class="{ active: drawSettings.lockDirection === 'h' }" @click="drawSettings.lockDirection = 'h'">水平</div>
                <div class="toggle-item text" :class="{ active: drawSettings.lockDirection === 'v' }" @click="drawSettings.lockDirection = 'v'">垂直</div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.draw-panel { display: flex; flex-direction: column; gap: 12px; padding: 4px; }

.panel-header {
    display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 4px; padding-left: 4px;
}
.icon-bubble {
    width: 24px; height: 24px; background: #e0f2fe; color: #0284c7; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 14px;
}

.setting-card {
    background: #fff; border-radius: 16px; padding: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.03);
}

.card-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; display: flex; align-items: center; gap: 4px; margin-bottom: 10px; }
.sub-label { font-size: 11px; color: #6b7280; font-weight: 500; margin-bottom: 4px; display: block; }

.w-full { width: 100%; }
.mt-3 { margin-top: 12px; }
.space-between { display: flex; justify-content: space-between; align-items: center; }

/* Custom Select */
.pill-select :deep(.el-input__wrapper) {
    border-radius: 12px; background: #f9fafb; box-shadow: none !important; border: 1px solid #e5e7eb;
}
.pill-select :deep(.el-input__wrapper.is-focus) { border-color: #3b82f6; }

/* Color Pill */
.color-row { width: 100%; }
.color-pill {
    display: flex; align-items: center; gap: 8px; background: #f9fafb; padding: 4px 8px 4px 4px; border-radius: 20px; border: 1px solid #e5e7eb;
    width: fit-content; transition: all 0.2s;
}
.color-pill:hover { border-color: #d1d5db; background: #fff; }
.color-hex { font-family: monospace; font-size: 11px; color: #4b5563; }

/* Toggle Capsule */
.toggle-capsule {
    display: flex; background: #f3f4f6; border-radius: 8px; padding: 2px; gap: 2px; margin-top: 6px;
}
.toggle-item {
    flex: 1; height: 26px; display: flex; align-items: center; justify-content: center;
    border-radius: 6px; cursor: pointer; color: #6b7280; font-size: 14px; transition: all 0.2s;
}
.toggle-item.text { font-size: 11px; font-weight: 500; }
.toggle-item.active { background: #fff; color: #3b82f6; box-shadow: 0 1px 3px rgba(0,0,0,0.05); font-weight: 600; }

.divider { height: 1px; background: #f3f4f6; margin: 12px 0; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
</style>