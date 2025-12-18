<script setup>
import { COMPONENT_GROUPS, COMPONENT_TEMPLATES, COMPONENT_TYPES } from '../../constants';
import { useCanvas } from '../../composables/useCanvas';
import { layoutComponents, activeComponentId, globalSettings } from '../../store';
import { uuid } from '../../utils';

const { enterDrawMode } = useCanvas();

const addComponent = (type) => {
  if (type === COMPONENT_TYPES.TOOL_PEN) { 
    enterDrawMode(); 
    return; 
  }
  
  // 1. 克隆组件模板
  const newComp = JSON.parse(JSON.stringify(COMPONENT_TEMPLATES[type]));
  newComp.id = uuid(); 
  
  // 2. 检查当前是否存在整体缩放，如果存在则应用到新组件
  const currentScale = globalSettings.value.structureScale || 100;
  if (currentScale !== 100) {
      const ratio = currentScale / 100;
      
      // 应用几何缩放
      newComp.x *= ratio;
      newComp.y *= ratio;
      newComp.w *= ratio;
      
      // 表格高度自动计算，不缩放 h；其他组件缩放 h
      if (newComp.type !== COMPONENT_TYPES.TABLE) {
          newComp.h *= ratio;
      } else {
          // 表格特有属性缩放
          if (newComp.rowHeight) newComp.rowHeight *= ratio;
          if (newComp.dataFontSize) newComp.dataFontSize *= ratio;
      }

      // 应用样式缩放 (字号、线宽)
      if (newComp.style) {
          if (newComp.style.fontSize) newComp.style.fontSize *= ratio;
          if (newComp.style.strokeWidth) newComp.style.strokeWidth *= ratio;
      }
  }

  // 3. [新增] 智能错位逻辑
  // 目的：当用户连续添加同一个组件时，避免它们完全重叠在一起，造成“没添加成功”的错觉
  const offsetStep = 20; // 每次偏移 20px
  const maxAttempts = 20; // 最大尝试次数，防止在极端密集情况下死循环
  let attempt = 0;

  while (attempt < maxAttempts) {
      // 检查当前计算的位置是否已经被占用 (使用 2px 的阈值作为模糊匹配)
      const isOverlapping = layoutComponents.value.some(comp => {
          // 只检查左上角坐标，足以判断是否是“刚刚添加”的状态
          return Math.abs(comp.x - newComp.x) < 2 && Math.abs(comp.y - newComp.y) < 2;
      });

      if (isOverlapping) {
          // 如果重叠，向右下角偏移
          newComp.x += offsetStep;
          newComp.y += offsetStep;
          attempt++;
      } else {
          // 如果不重叠，位置可用，跳出循环
          break;
      }
  }

  layoutComponents.value.push(newComp); 
  activeComponentId.value = newComp.id; 
};

// --- [UI 增强] 分组主题色配置 ---
// 为每个分组定义专属的潮流渐变色，增强视觉分区和年轻感
const getGroupTheme = (index) => {
    const themes = [
        { name: 'text', bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', accent: '#0284C7', iconColor: '#0EA5E9' },   // 文本：清透蓝
        { name: 'data', bg: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)', accent: '#9333EA', iconColor: '#A855F7' },   // 表格：科技紫
        { name: 'shape', bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', accent: '#D97706', iconColor: '#F59E0B' },  // 图形：活力橙
        { name: 'media', bg: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)', accent: '#DB2777', iconColor: '#EC4899' },  // 媒体：时尚粉
    ];
    return themes[index % themes.length];
};

// --- [核心修复] 组件图形标识映射 ---
// 内置 SVG 路径，确保每个组件都有清晰、直观的图形展示，解决"方块"问题
const ICON_PATHS = {
    [COMPONENT_TYPES.TITLE]: 'M5 4v3h5.5v12h3V7H19V4z', // T形标题
    [COMPONENT_TYPES.TEXT_ROW]: 'M4 9h16v2H4V9zm0 4h10v2H4v-2z', // 文本行
    [COMPONENT_TYPES.RICH_TEXT]: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z', // 文档
    [COMPONENT_TYPES.V_TEXT]: 'M5 15v4h2V5h10v2h-8v12z M17 5v14h2V5z', // 竖排模拟
    [COMPONENT_TYPES.TABLE]: 'M4 5h16v14H4V5zm2 2v3h12V7H6zm0 5h12v2H6v-2zm0 4h12v2H6v-2z', // 表格栅格
    [COMPONENT_TYPES.IMAGE]: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z', // 图片山峰
    [COMPONENT_TYPES.QR_CODE]: 'M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm8 4h2v2h-2v-2zm-2-2h2v2h-2v-2zm4 0h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 0h2v2h-2v-2zm2-4h2v2h-2v-2z', // 二维码
    [COMPONENT_TYPES.DRAW_LINE]: 'M3.41 22L2 20.59 20.59 2 22 3.41z', // 对角线
    [COMPONENT_TYPES.DRAW_PATH]: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', // 曲线
    [COMPONENT_TYPES.TOOL_PEN]: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', // 钢笔
    [COMPONENT_TYPES.SHAPE_RECT]: 'M3 3h18v18H3V3zm2 2v14h14V5H5z', // 矩形框
    [COMPONENT_TYPES.SHAPE_CIRCLE]: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z', // 圆形框
    [COMPONENT_TYPES.CHECKBOX]: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', // 勾选框
    [COMPONENT_TYPES.DATETIME]: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z', // 日历
    [COMPONENT_TYPES.DIVIDER]: 'M2 11h20v2H2z', // 分割线
    [COMPONENT_TYPES.PAGE_NUMBER]: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z', // 页码
    [COMPONENT_TYPES.SIGNATURE]: 'M17.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20 20v2H4v-2h16z' // 签字
};

const getComponentIconPath = (type) => {
    return ICON_PATHS[type] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z';
};
</script>

<template>
  <div class="library-container fade-in">
    <div v-for="(group, idx) in COMPONENT_GROUPS" :key="idx" class="group-section">
        <!-- 分组标题：胶囊风格 -->
        <div class="group-header">
            <div class="header-pill" :style="{ backgroundColor: getGroupTheme(idx).bg, color: getGroupTheme(idx).accent }">
                {{ group.title }}
            </div>
            <div class="header-line"></div>
        </div>

        <!-- 组件网格 -->
        <div class="comp-grid">
            <div 
                v-for="type in group.items" 
                :key="type" 
                class="comp-card" 
                @click="addComponent(type)"
                :style="{ '--hover-color': getGroupTheme(idx).accent }"
            >
                <!-- 图标容器：渐变色块 + 自定义 SVG 路径 -->
                <div class="icon-wrapper" :style="{ background: getGroupTheme(idx).bg }">
                    <div class="icon-inner" :style="{ color: getGroupTheme(idx).iconColor }">
                        <!-- 直接使用 SVG 渲染，确保图形可见且风格统一 -->
                        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" class="custom-svg-icon">
                            <path :d="getComponentIconPath(type)" />
                        </svg>
                    </div>
                </div>
                
                <!-- 组件名称 -->
                <span class="comp-name">{{ COMPONENT_TEMPLATES[type].name }}</span>
                
                <!-- 装饰性光晕 (Hover时显现) -->
                <div class="hover-glow" :style="{ background: getGroupTheme(idx).bg }"></div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.library-container { 
    max-width: 100%; 
    padding: 8px 4px;
    animation: fadeIn 0.3s ease-out; 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    gap: 20px;
    overflow-x: hidden; /* 防止横向溢出 */
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* 分组标题 */
.group-section { display: flex; flex-direction: column; gap: 12px; }

.group-header { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
.header-pill {
    font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px;
    white-space: nowrap; letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}
.header-line { flex: 1; height: 1px; background: #f1f3f4; border-radius: 1px; }

/* 网格布局 */
.comp-grid {
    display: grid; 
    grid-template-columns: repeat(3, 1fr); /* 强制3列，紧凑工整 */
    gap: 12px;
    padding: 0 4px;
}

/* 组件卡片 */
.comp-card {
    position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 12px 6px;
    background: #fff;
    border: 1px solid transparent;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性动画 */
    overflow: hidden;
}

/* 默认状态：极简干净 */
.comp-card:hover {
    transform: translateY(-4px);
    background: #fff;
    box-shadow: 0 8px 20px rgba(0,0,0,0.06);
    border-color: rgba(0,0,0,0.03);
    z-index: 1;
}

.comp-card:active { transform: scale(0.96); }

/* 图标容器设计 */
.icon-wrapper {
    width: 44px; height: 44px;
    border-radius: 14px; /* Squircle 圆角矩形 */
    display: flex; align-items: center; justify-content: center;
    transition: all 0.3s ease;
    position: relative;
    z-index: 2;
    padding: 8px; /* 给 SVG 一些内边距 */
}

.icon-inner {
    width: 100%; height: 100%;
    transition: transform 0.3s ease;
    display: flex;
    align-items: center; justify-content: center;
}

.custom-svg-icon {
    display: block;
}

/* Hover 时的图标动效 */
.comp-card:hover .icon-wrapper {
    border-radius: 50%; /* 变圆 */
    transform: scale(1.05);
}
.comp-card:hover .icon-inner {
    transform: scale(1.1) rotate(5deg); /* 轻微旋转放大 */
}

/* 文字样式 */
.comp-name {
    font-size: 11px; color: #4b5563; font-weight: 500;
    text-align: center; width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    position: relative; z-index: 2;
    transition: color 0.2s;
}

.comp-card:hover .comp-name {
    color: var(--hover-color);
    font-weight: 600;
}

/* 呼吸光晕背景 */
.hover-glow {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    opacity: 0; transition: opacity 0.3s ease;
    z-index: 0; pointer-events: none;
    filter: blur(10px);
}
.comp-card:hover .hover-glow { opacity: 0.4; }

/* 响应式调整 */
@media (max-width: 340px) {
    .comp-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>