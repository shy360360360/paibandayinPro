<script setup>
import { isDrawMode, activeComponent, activeComponentIds } from '../../store'; // 引入 activeComponentIds
import DrawProperties from './properties/DrawProperties.vue';
import ItemProperties from './properties/ItemProperties.vue';
import CanvasOperations from './properties/CanvasOperations.vue';
import MultiSelectionProperties from './properties/MultiSelectionProperties.vue'; // 引入新组件
</script>

<template>
  <div class="content-inner fade-in" :class="{ 'vertically-centered': !activeComponent && !isDrawMode && activeComponentIds.length === 0 }">
    <!-- 1. 绘制模式 -->
    <DrawProperties v-if="isDrawMode" />
    
    <!-- 2. 多选模式 (新功能) -->
    <MultiSelectionProperties v-else-if="activeComponentIds.length > 1" />

    <!-- 3. 单选组件属性 -->
    <ItemProperties v-else-if="activeComponent" :key="activeComponent.id" />
    
    <!-- 4. 全局画布操作 (默认) -->
    <CanvasOperations v-else />
  </div>
</template>

<style scoped>
.content-inner { 
    max-width: 800px; margin: 0 auto; width: 100%;
    animation: fadeIn 0.2s ease-out; flex: 1; display: flex; flex-direction: column;
}
.vertically-centered { min-height: 100%; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
</style>