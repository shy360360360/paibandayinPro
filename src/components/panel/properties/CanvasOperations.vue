<script setup>
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus, Plus, RefreshLeft, Aim } from '@element-plus/icons-vue';
import { globalSettings, globalOps } from '../../../store';
import { useCanvas } from '../../../composables/useCanvas';

const { moveCanvas, scaleCanvas, centerCanvasContent, resetCanvasScale } = useCanvas();
</script>

<template>
  <div class="ops-container fade-in">
    <!-- 1. 导航控制台 (Gamepad Style) -->
    <div class="control-card gamepad-card">
        <div class="card-label">画布导航</div>
        <div class="gamepad-layout">
            <div class="dpad-wrapper">
                <div class="dpad-btn up" @click="moveCanvas(0,-1)"><el-icon><ArrowUp /></el-icon></div>
                <div class="dpad-btn left" @click="moveCanvas(-1,0)"><el-icon><ArrowLeft /></el-icon></div>
                <div class="dpad-center" @click="centerCanvasContent('horizontal')" title="居中"><el-icon><Aim /></el-icon></div>
                <div class="dpad-btn right" @click="moveCanvas(1,0)"><el-icon><ArrowRight /></el-icon></div>
                <div class="dpad-btn down" @click="moveCanvas(0,1)"><el-icon><ArrowDown /></el-icon></div>
            </div>
        </div>
    </div>

    <!-- 2. 缩放与参数 -->
    <div class="control-card">
        <div class="card-header-row">
            <span class="card-label">视图缩放</span>
            <el-tooltip content="还原 100%" placement="top" :disabled="(globalSettings.structureScale || 100) === 100">
                <button class="reset-btn" :class="{ disabled: (globalSettings.structureScale || 100) === 100 }" @click="resetCanvasScale">
                    <el-icon><RefreshLeft /></el-icon>
                </button>
            </el-tooltip>
        </div>
        
        <!-- 胶囊步进器 -->
        <div class="capsule-stepper">
            <button class="step-btn minus" @click="scaleCanvas(-1)"><el-icon><Minus /></el-icon></button>
            <div class="step-val">
                <span class="num">{{ Math.round(globalSettings.structureScale || 100) }}</span>
                <span class="unit">%</span>
            </div>
            <button class="step-btn plus" @click="scaleCanvas(1)"><el-icon><Plus /></el-icon></button>
        </div>

        <div class="divider"></div>

        <!-- 参数微调 -->
        <div class="param-grid">
            <div class="param-item">
                <span class="param-label">移动步长</span>
                <el-input-number v-model="globalOps.moveStep" :min="1" :controls="false" class="pill-input" />
            </div>
            <div class="param-item">
                <span class="param-label">缩放步长</span>
                <el-input-number v-model="globalOps.scaleRatio" :min="1" :max="50" :controls="false" class="pill-input" />
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.ops-container {
    width: 100%; display: flex; flex-direction: column; gap: 16px;
    padding: 8px 4px; box-sizing: border-box;
}

/* 通用卡片风格 */
.control-card {
    background: #fff; border-radius: 20px; padding: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.04);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    position: relative; overflow: hidden;
}
.control-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }

.card-label {
    font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 12px; display: block;
}
.card-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-header-row .card-label { margin-bottom: 0; }

/* Gamepad Style */
.gamepad-layout { display: flex; justify-content: center; padding: 4px 0; }
.dpad-wrapper {
    display: grid; grid-template-columns: repeat(3, 36px); grid-template-rows: repeat(3, 36px); gap: 4px;
}
.dpad-btn {
    width: 36px; height: 36px; border-radius: 10px; background: #f3f4f6; color: #6b7280;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    transition: all 0.15s ease;
}
.dpad-btn:hover { background: #e0f2fe; color: #0284c7; transform: scale(1.05); }
.dpad-btn:active { transform: scale(0.95); }
.up { grid-column: 2; grid-row: 1; border-radius: 10px 10px 4px 4px; }
.left { grid-column: 1; grid-row: 2; border-radius: 10px 4px 4px 10px; }
.right { grid-column: 3; grid-row: 2; border-radius: 4px 10px 10px 4px; }
.down { grid-column: 2; grid-row: 3; border-radius: 4px 4px 10px 10px; }

.dpad-center {
    grid-column: 2; grid-row: 2; width: 36px; height: 36px; border-radius: 50%;
    background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15); cursor: pointer; transition: all 0.3s;
}
.dpad-center:hover { transform: rotate(90deg); background: #3b82f6; color: #fff; }

/* Capsule Stepper */
.capsule-stepper {
    display: flex; align-items: center; background: #f9fafb; border-radius: 24px; padding: 4px;
    border: 1px solid #e5e7eb; position: relative;
}
.step-btn {
    width: 32px; height: 32px; border-radius: 50%; border: none; background: #fff;
    color: #4b5563; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 2;
}
.step-btn:hover { background: #3b82f6; color: #fff; transform: scale(1.1); }
.step-btn:active { transform: scale(0.9); }
.step-val { flex: 1; text-align: center; font-family: 'Roboto Mono', monospace; color: #1f2937; user-select: none; }
.step-val .num { font-size: 14px; font-weight: 700; }
.step-val .unit { font-size: 10px; color: #9ca3af; margin-left: 2px; }

.reset-btn { background: none; border: none; color: #9ca3af; cursor: pointer; transition: all 0.3s; padding: 4px; }
.reset-btn:hover { color: #3b82f6; transform: rotate(-90deg); }
.reset-btn.disabled { opacity: 0; pointer-events: none; }

.divider { height: 1px; background: #f3f4f6; margin: 16px 0; }

/* Params */
.param-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.param-item { display: flex; flex-direction: column; gap: 6px; }
.param-label { font-size: 10px; color: #6b7280; font-weight: 500; }

.pill-input :deep(.el-input__wrapper) {
    border-radius: 12px; background: #f9fafb; box-shadow: none !important; border: 1px solid transparent; padding: 0 8px; transition: all 0.2s;
}
.pill-input :deep(.el-input__wrapper:hover) { background: #fff; border-color: #d1d5db; }
.pill-input :deep(.el-input__wrapper.is-focus) { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1) !important; }
.pill-input :deep(.el-input__inner) { text-align: center; font-size: 12px; font-weight: 600; color: #374151; height: 28px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
</style>