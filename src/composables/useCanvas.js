import { reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { 
    layoutComponents, activeComponentId, activeComponentIds, activeView, globalSettings, 
    renderingScale, 
    isDrawMode, drawSettings, activeTab, isPanelCollapsed, isPanelLocked, 
    globalOps, vGuides, hGuides, snapState, activeComponent
} from '../store';
import { COMPONENT_TYPES } from '../constants';
import { uuid, getLineIntersection, safeFloat } from '../utils';

export function useCanvas() {
    const dragState = reactive({ 
        isDragging: false, isResizing: false, isDrawing: false, isSelecting: false, 
        startX: 0, startY: 0, 
        initialX: 0, initialY: 0, initialW: 0, initialH: 0, 
        handle: null, component: null,
        initialPositions: {}, 
        selectionRect: { x: 0, y: 0, w: 0, h: 0 },
        lineStart: {x:0, y:0}, lineEnd: {x:0, y:0},
        lockedPoint: null,
        selectionOriginX: 0, selectionOriginY: 0
    });

    // 统一的事件清理
    const cleanupListeners = () => {
        document.removeEventListener('mousemove', handleMouseMove); 
        document.removeEventListener('mouseup', handleMouseUp);
        // 防止意外状态残留
        dragState.isDragging = false;
        dragState.isResizing = false;
        dragState.isDrawing = false;
        dragState.isSelecting = false;
        document.body.style.cursor = '';
    };

    const enterDrawMode = () => {
        isDrawMode.value = true; 
        activeComponentIds.value = []; 
        if (!isPanelLocked.value) {
            if (!globalSettings.value.isPreviewLocked) {
                activeTab.value = 'properties'; 
            }
            if (isPanelCollapsed.value) isPanelCollapsed.value = false;
        }
        ElMessage.success('已进入绘图模式，请在画布拖动绘制');
    };

    const exitDrawMode = () => {
        isDrawMode.value = false; 
        if (!isPanelLocked.value) {
             if (!globalSettings.value.isPreviewLocked) {
                activeTab.value = 'components';
             }
        }
        ElMessage.info('已退出绘图模式');
    };

    const alignLine = (type) => {
        if (!activeComponent.value || activeComponent.value.type !== COMPONENT_TYPES.DRAW_LINE) return;
        const comp = activeComponent.value;
        if (type === 'h') comp.h = comp.y; 
        else if (type === 'v') comp.w = comp.x; 
    };

    const centerActiveComponent = (mode) => {
        if (!activeComponent.value) return;
        const comp = activeComponent.value;
        const paperW = globalSettings.value.paperWidth;
        const paperH = globalSettings.value.paperHeight;

        if (mode === 'horizontal') {
            if (comp.type === COMPONENT_TYPES.DRAW_LINE) {
                const lineW = comp.w - comp.x;
                const newX = (paperW - Math.abs(lineW)) / 2; 
                const dx = newX - Math.min(comp.x, comp.w);
                comp.x = Math.round(comp.x + dx); 
                comp.w = Math.round(comp.w + dx);
            } else if (comp.type === COMPONENT_TYPES.DRAW_PATH) {
                ElMessage.warning('路径组件暂不支持自动居中');
            } else {
                comp.x = Math.round((paperW - comp.w) / 2); 
            }
        } else if (mode === 'vertical') {
            if (comp.type === COMPONENT_TYPES.DRAW_LINE) {
                const lineH = comp.h - comp.y;
                const newY = (paperH - Math.abs(lineH)) / 2;
                const dy = newY - Math.min(comp.y, comp.h);
                comp.y = Math.round(comp.y + dy); 
                comp.h = Math.round(comp.h + dy);
            } else if (comp.type === COMPONENT_TYPES.DRAW_PATH) {
                 ElMessage.warning('路径组件暂不支持自动居中');
            } else {
                if (comp.type === COMPONENT_TYPES.TABLE) {
                     ElMessage.warning('表格组件建议仅使用水平居中');
                } else {
                    comp.y = Math.round((paperH - comp.h) / 2);
                }
            }
        }
    };

    const applyGlobalMove = (dx, dy) => {
        layoutComponents.value.forEach(comp => {
            comp.x = Math.round(comp.x + dx); 
            comp.y = Math.round(comp.y + dy);
            if (comp.type === COMPONENT_TYPES.DRAW_LINE) { 
                comp.w = Math.round(comp.w + dx); 
                comp.h = Math.round(comp.h + dy); 
            }
            else if (comp.type === COMPONENT_TYPES.DRAW_PATH) {
                 comp.d = comp.d.replace(/([0-9.-]+)\s+([0-9.-]+)/g, (match, x, y) => `${safeFloat(x) + dx} ${safeFloat(y) + dy}`);
            }
        });
    };

    const moveCanvas = (xDir, yDir) => {
        if (layoutComponents.value.length === 0) return;
        applyGlobalMove(xDir * globalOps.moveStep, yDir * globalOps.moveStep);
    };

    const applyRatioToComponents = (ratio) => {
        layoutComponents.value.forEach(comp => {
            comp.x = Math.round(comp.x * ratio); 
            comp.y = Math.round(comp.y * ratio); 
            comp.w = Math.round(comp.w * ratio);
            if (comp.type !== COMPONENT_TYPES.TABLE) comp.h = Math.round(comp.h * ratio);
            else {
                if (comp.rowHeight) comp.rowHeight = comp.rowHeight * ratio;
                if (comp.dataFontSize) comp.dataFontSize = comp.dataFontSize * ratio;
            }
            if (comp.style && comp.style.fontSize) comp.style.fontSize = comp.style.fontSize * ratio;
            if (comp.style && comp.style.strokeWidth) comp.style.strokeWidth = comp.style.strokeWidth * ratio;
            if (comp.type === COMPONENT_TYPES.DRAW_PATH && comp.d) {
                 comp.d = comp.d.replace(/([0-9.-]+)/g, (match) => safeFloat(match) * ratio);
            }
        });
    };

    const scaleCanvas = (zoomDir) => {
        if (layoutComponents.value.length === 0) return;
        const currentScale = globalSettings.value.structureScale || 100;
        const step = globalOps.scaleRatio || 10;
        let newScale;
        if (zoomDir > 0) newScale = currentScale + step;
        else newScale = Math.max(10, currentScale - step); 
        const ratio = newScale / currentScale;
        applyRatioToComponents(ratio);
        globalSettings.value.structureScale = newScale;
    };

    const resetCanvasScale = () => {
        const currentScale = globalSettings.value.structureScale || 100;
        if (currentScale === 100 || layoutComponents.value.length === 0) return;
        const ratio = 100 / currentScale;
        applyRatioToComponents(ratio);
        globalSettings.value.structureScale = 100;
        ElMessage.success('已还原为 100% 原始比例');
    };

    const centerCanvasContent = (mode) => {
        if (layoutComponents.value.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const getCompHeight = (c) => {
            if (c.type === COMPONENT_TYPES.TABLE) {
                 const rows = 1 + 1 + (c.emptyRows || 0) + ((c.showSummary && c.summaryConfig) ? 1 : 0);
                 return rows * (c.rowHeight || 36);
            }
            return c.h;
        }
        layoutComponents.value.forEach(c => {
            let left, top, right, bottom;
            if (c.type === COMPONENT_TYPES.DRAW_LINE) {
                left = Math.min(c.x, c.w); right = Math.max(c.x, c.w); top = Math.min(c.y, c.h); bottom = Math.max(c.y, c.h);
            } else if (c.type === COMPONENT_TYPES.DRAW_PATH) {
                const match = c.d.match(/M\s+([0-9.]+)\s+([0-9.]+)/);
                if (match) { left = parseFloat(match[1]); top = parseFloat(match[2]); right = left + 1; bottom = top + 1; } else return;
            } else {
                left = c.x; top = c.y; right = c.x + c.w; bottom = c.y + getCompHeight(c);
            }
            minX = Math.min(minX, left); minY = Math.min(minY, top); maxX = Math.max(maxX, right); maxY = Math.max(maxY, bottom);
        });
        if (minX === Infinity || minY === Infinity) return;
        const contentCenterX = minX + (maxX - minX) / 2;
        const contentCenterY = minY + (maxY - minY) / 2;
        if (mode === 'horizontal') applyGlobalMove(globalSettings.value.paperWidth / 2 - contentCenterX, 0);
        else if (mode === 'vertical') applyGlobalMove(0, globalSettings.value.paperHeight / 2 - contentCenterY);
    };

    // --- 吸附逻辑 (保持核心逻辑，增加安全检查) ---
    function applyLineIntersectionSnap(fixedX, fixedY, movingX, movingY, currentId, lockDir = 'none') {
        const SNAP_ENTRANCE = 15; const SNAP_EXIT = 50; 
        let resultX = movingX; let resultY = movingY;
        let nearestIntersection = null; let minDistance = Infinity;
        const lines = layoutComponents.value.filter(c => c.type === COMPONENT_TYPES.DRAW_LINE && c.id !== currentId);
        
        for (const line of lines) {
            const intersection = getLineIntersection(fixedX, fixedY, movingX, movingY, line.x, line.y, line.w, line.h);
            if (intersection) {
                if (lockDir === 'h' && Math.abs(intersection.y - movingY) > 1) continue;
                if (lockDir === 'v' && Math.abs(intersection.x - movingX) > 1) continue;
                const dist = Math.sqrt(Math.pow(intersection.x - movingX, 2) + Math.pow(intersection.y - movingY, 2));
                if (dist < minDistance) { minDistance = dist; nearestIntersection = intersection; }
            }
        }
        if (dragState.lockedPoint) {
            const distToLock = Math.sqrt(Math.pow(dragState.lockedPoint.x - movingX, 2) + Math.pow(dragState.lockedPoint.y - movingY, 2));
            if (distToLock > SNAP_EXIT) { dragState.lockedPoint = null; snapState.active = false; } 
            else {
                resultX = dragState.lockedPoint.x; resultY = dragState.lockedPoint.y;
                snapState.active = true; snapState.x = resultX; snapState.y = resultY;
                hGuides.value = []; vGuides.value = [];
                return { x: resultX, y: resultY };
            }
        }
        if (!dragState.lockedPoint && nearestIntersection && minDistance < SNAP_ENTRANCE) {
            dragState.lockedPoint = nearestIntersection;
            resultX = nearestIntersection.x; resultY = nearestIntersection.y;
            snapState.active = true; snapState.x = resultX; snapState.y = resultY;
            hGuides.value = []; vGuides.value = [];
            return { x: resultX, y: resultY };
        }
        if (!dragState.lockedPoint) {
            snapState.active = false;
            if (lockDir === 'none') {
                const dx = Math.abs(movingX - fixedX); const dy = Math.abs(movingY - fixedY);
                if (dy < 10) { resultY = fixedY; hGuides.value = [{ pos: fixedY, type: 'comp' }]; } else { hGuides.value = []; }
                if (dx < 10) { resultX = fixedX; vGuides.value = [{ pos: fixedX, type: 'comp' }]; } else { vGuides.value = []; }
            } else { hGuides.value = []; vGuides.value = []; }
        }
        return { x: resultX, y: resultY };
    }

    function applySnapping(x, y, w, h) {
        const THRESHOLD = 4;
        const newPos = { x, y };
        vGuides.value = []; hGuides.value = [];
        
        const hPoints = [ { val: x, type: 'start' }, { val: x + w / 2, type: 'center' }, { val: x + w, type: 'end' } ];
        const vPoints = [ { val: y, type: 'start' }, { val: y + h / 2, type: 'center' }, { val: y + h, type: 'end' } ];

        const candidatesX = [];
        const candidatesY = [];

        const paperW = globalSettings.value.paperWidth;
        const paperH = globalSettings.value.paperHeight;
        candidatesX.push({ val: 0, type: 'canvas' }, { val: paperW/2, type: 'canvas' }, { val: paperW, type: 'canvas' });
        candidatesY.push({ val: 0, type: 'canvas' }, { val: paperH/2, type: 'canvas' }, { val: paperH, type: 'canvas' });

        layoutComponents.value.forEach(c => {
            if (activeComponentIds.value.includes(c.id) || c.type === COMPONENT_TYPES.DRAW_LINE || c.type === COMPONENT_TYPES.DRAW_PATH) return; 
            candidatesX.push({ val: c.x, type: 'comp' }, { val: c.x + c.w/2, type: 'comp' }, { val: c.x + c.w, type: 'comp' });
            if(c.type !== COMPONENT_TYPES.TABLE) {
                candidatesY.push({ val: c.y, type: 'comp' }, { val: c.y + c.h/2, type: 'comp' }, { val: c.y + c.h, type: 'comp' });
            } else {
                candidatesY.push({ val: c.y, type: 'comp' });
            }
        });

        let bestX = null;
        let minDistX = THRESHOLD + 1;
        for (const cand of candidatesX) {
            for (const p of hPoints) {
                const diff = cand.val - p.val;
                if (Math.abs(diff) < Math.abs(minDistX)) { minDistX = diff; bestX = cand; }
            }
        }
        if (bestX && Math.abs(minDistX) <= THRESHOLD) {
            newPos.x += minDistX;
            vGuides.value.push({ pos: bestX.val, type: bestX.type });
        }

        let bestY = null;
        let minDistY = THRESHOLD + 1;
        for (const cand of candidatesY) {
            for (const p of vPoints) {
                const diff = cand.val - p.val;
                if (Math.abs(diff) < Math.abs(minDistY)) { minDistY = diff; bestY = cand; }
            }
        }
        if (bestY && Math.abs(minDistY) <= THRESHOLD) {
            newPos.y += minDistY;
            hGuides.value.push({ pos: bestY.val, type: bestY.type });
        }

        return newPos;
    }

    // --- 鼠标事件核心 ---
    
    function handleMouseDown(e, component, handle = null) {
        if (activeView.value !== 'edit' || globalSettings.value.isPreviewLocked) return;
        dragState.lockedPoint = null; 
        const currentScale = renderingScale.value / 100;

        // 1. 绘图模式
        if (isDrawMode.value) {
            const paperEl = document.querySelector('.paper-sheet');
            if (!paperEl) return;
            const rect = paperEl.getBoundingClientRect();
            // 防止除零
            const scale = currentScale || 1;
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            
            dragState.isDrawing = true;
            dragState.startX = e.clientX; dragState.startY = e.clientY;

            const currentStructureScale = globalSettings.value.structureScale || 100;
            const ratio = currentStructureScale / 100;
            const scaledStrokeWidth = (drawSettings.strokeWidth || 1) * ratio;

            if (drawSettings.type === 'line') {
                const newLine = {
                    id: uuid(), type: COMPONENT_TYPES.DRAW_LINE, x, y, w: x, h: y, lockDirection: drawSettings.lockDirection,
                    style: { strokeWidth: scaledStrokeWidth, strokeColor: drawSettings.strokeColor, strokeStyle: drawSettings.strokeStyle, zIndex: 10 }
                };
                layoutComponents.value.push(newLine);
                dragState.component = layoutComponents.value[layoutComponents.value.length - 1]; 
            } else {
                const newPath = {
                    id: uuid(), type: COMPONENT_TYPES.DRAW_PATH, x: 0, y: 0, w: 0, h: 0, d: `M ${x} ${y}`,
                    style: { strokeWidth: scaledStrokeWidth, strokeColor: drawSettings.strokeColor, strokeStyle: drawSettings.strokeStyle, zIndex: 10, fill: 'none' }
                };
                layoutComponents.value.push(newPath);
                dragState.component = layoutComponents.value[layoutComponents.value.length - 1];
            }
            document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
            return;
        }

        // 2. 框选模式
        if (!component) { 
            if (!e.ctrlKey) {
                activeComponentIds.value = []; 
            }
            dragState.isSelecting = true;
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            
            const paperEl = document.querySelector('.paper-sheet');
            if (paperEl) {
                const rect = paperEl.getBoundingClientRect();
                const scale = currentScale || 1;
                dragState.selectionOriginX = (e.clientX - rect.left) / scale;
                dragState.selectionOriginY = (e.clientY - rect.top) / scale;
            }

            if (!isPanelLocked.value) { 
                if (!globalSettings.value.isPreviewLocked) { activeTab.value = 'properties'; }
                if(isPanelCollapsed.value) isPanelCollapsed.value = false; 
            }
            
            document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
            return; 
        }

        e.stopPropagation(); 
        
        // 3. 选中与拖拽逻辑
        if (e.ctrlKey) {
            const idx = activeComponentIds.value.indexOf(component.id);
            if (idx > -1) {
                activeComponentIds.value.splice(idx, 1); 
                if (activeComponentIds.value.length === 0) return; 
            } else {
                activeComponentIds.value.push(component.id); 
            }
        } else {
            if (!activeComponentIds.value.includes(component.id)) {
                activeComponentIds.value = [component.id];
            }
        }

        if (!isPanelLocked.value) {
            if (!globalSettings.value.isPreviewLocked) { activeTab.value = 'properties'; }
            if (isPanelCollapsed.value) isPanelCollapsed.value = false;
        }

        dragState.startX = e.clientX; dragState.startY = e.clientY;
        dragState.component = component; 
        
        // 记录初始位置 (快照)
        dragState.initialPositions = {};
        layoutComponents.value.forEach(c => {
            if (activeComponentIds.value.includes(c.id)) {
                dragState.initialPositions[c.id] = { x: c.x, y: c.y, w: c.w, h: c.h };
            }
        });

        dragState.initialX = component.x; dragState.initialY = component.y;
        dragState.initialW = component.w; dragState.initialH = component.h;

        if (component.type === COMPONENT_TYPES.DRAW_LINE) {
            if (handle === 'start') { dragState.isResizing = true; dragState.handle = 'start'; } 
            else if (handle === 'end') { dragState.isResizing = true; dragState.handle = 'end'; } 
            else { dragState.isDragging = true; dragState.lineStart = { x: component.x, y: component.y }; dragState.lineEnd = { x: component.w, y: component.h }; }
        } else {
            if (handle) { 
                if (activeComponentIds.value.length > 1) return; // 多选暂不支持resize
                dragState.isResizing = true; 
                dragState.handle = handle; 
                document.body.style.cursor = handle.includes('w') || handle.includes('e') ? 'ew-resize' : 'ns-resize'; 
            } 
            else { 
                dragState.isDragging = true; 
                document.body.style.cursor = 'move'; 
            }
        }
        document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e) {
        if (globalSettings.value.isPreviewLocked) return;
        const currentScale = (renderingScale.value / 100) || 1;
        const comp = dragState.component;

        // 1. 绘图
        if (dragState.isDrawing && comp) {
            const paperEl = document.querySelector('.paper-sheet');
            if (!paperEl) return;
            const rect = paperEl.getBoundingClientRect();
            let x = (e.clientX - rect.left) / currentScale;
            let y = (e.clientY - rect.top) / currentScale;
            if (drawSettings.type === 'line') {
                if (drawSettings.lockDirection === 'h') y = comp.y;
                else if (drawSettings.lockDirection === 'v') x = comp.x;
                const snapped = applyLineIntersectionSnap(comp.x, comp.y, x, y, comp.id, drawSettings.lockDirection);
                comp.w = snapped.x; comp.h = snapped.y; 
            } else { comp.d += ` L ${x} ${y}`; }
            return;
        }

        // 2. 框选
        if (dragState.isSelecting) {
            const paperEl = document.querySelector('.paper-sheet');
            if (!paperEl) return;
            const rect = paperEl.getBoundingClientRect();
            const currentX = (e.clientX - rect.left) / currentScale;
            const currentY = (e.clientY - rect.top) / currentScale;

            const x = Math.min(dragState.selectionOriginX, currentX);
            const y = Math.min(dragState.selectionOriginY, currentY);
            const w = Math.abs(currentX - dragState.selectionOriginX);
            const h = Math.abs(currentY - dragState.selectionOriginY);
            dragState.selectionRect = { x, y, w, h };

            const newSelection = [];
            layoutComponents.value.forEach(c => {
                let cx = c.x, cy = c.y, cw = c.w, ch = c.h;
                if (c.type === COMPONENT_TYPES.DRAW_LINE) {
                    cx = Math.min(c.x, c.w); cy = Math.min(c.y, c.h);
                    cw = Math.abs(c.w - c.x); ch = Math.abs(c.h - c.y);
                }
                const isOverlapping = !(x > cx + cw || x + w < cx || y > cy + ch || y + h < cy);
                if (isOverlapping) newSelection.push(c.id);
            });
            activeComponentIds.value = newSelection;
            return;
        }

        if (!dragState.isDragging && !dragState.isResizing) return;
        
        const dx = (e.clientX - dragState.startX) / currentScale;
        const dy = (e.clientY - dragState.startY) / currentScale;
        
        // 3. 线条操作
        if (comp.type === COMPONENT_TYPES.DRAW_LINE && (dragState.isResizing || dragState.isDragging)) {
             if (activeComponentIds.value.length === 1) {
                 if (dragState.isDragging) {
                    let currentDx = dx, currentDy = dy;
                    const newX1 = dragState.lineStart.x + currentDx, newY1 = dragState.lineStart.y + currentDy;
                    const newX2 = dragState.lineEnd.x + currentDx, newY2 = dragState.lineEnd.y + currentDy;
                    const centerX = (newX1 + newX2) / 2, centerY = (newY1 + newY2) / 2;
                    const paperW = globalSettings.value.paperWidth, paperH = globalSettings.value.paperHeight, THRESHOLD = 5;
                    vGuides.value = []; hGuides.value = [];
                    if (Math.abs(centerX - paperW / 2) < THRESHOLD) { 
                        currentDx += (paperW / 2) - centerX; 
                        vGuides.value.push({ pos: paperW / 2, type: 'canvas' }); 
                    }
                    if (Math.abs(centerY - paperH / 2) < THRESHOLD) { 
                        currentDy += (paperH / 2) - centerY; 
                        hGuides.value.push({ pos: paperH / 2, type: 'canvas' }); 
                    }
                    comp.x = Math.round(dragState.lineStart.x + currentDx); comp.y = Math.round(dragState.lineStart.y + currentDy);
                    comp.w = Math.round(dragState.lineEnd.x + currentDx); comp.h = Math.round(dragState.lineEnd.y + currentDy);
                 } else if (dragState.isResizing) {
                     const lock = comp.lockDirection || 'none';
                     if (dragState.handle === 'start') {
                        let targetX = Math.round(dragState.initialX + dx), targetY = Math.round(dragState.initialY + dy);
                        if (lock === 'h') targetY = comp.h; else if (lock === 'v') targetX = comp.w; 
                        const snapped = applyLineIntersectionSnap(comp.w, comp.h, targetX, targetY, comp.id, lock);
                        comp.x = snapped.x; comp.y = snapped.y;
                        if (lock === 'h') comp.y = comp.h; if (lock === 'v') comp.x = comp.w;
                    } else {
                        let targetX = Math.round(dragState.initialW + dx), targetY = Math.round(dragState.initialH + dy);
                        if (lock === 'h') targetY = comp.y; else if (lock === 'v') targetX = comp.x; 
                        const snapped = applyLineIntersectionSnap(comp.x, comp.y, targetX, targetY, comp.id, lock);
                        comp.w = snapped.x; comp.h = snapped.y;
                        if (lock === 'h') comp.h = comp.y; if (lock === 'v') comp.w = comp.x;
                    }
                 }
                 return;
             }
        }

        // 4. 普通拖拽 (支持多选)
        if (dragState.isDragging) {
            let newX = dragState.initialX + dx;
            let newY = dragState.initialY + dy;
            
            // 基于主组件计算吸附
            const snapped = applySnapping(newX, newY, dragState.initialW, dragState.initialH);
            
            const finalDx = snapped.x - dragState.initialX;
            const finalDy = snapped.y - dragState.initialY;

            // 批量应用位移
            activeComponentIds.value.forEach(id => {
                const target = layoutComponents.value.find(c => c.id === id);
                if (target && dragState.initialPositions[id]) {
                    const init = dragState.initialPositions[id];
                    target.x = Math.round(init.x + finalDx);
                    target.y = Math.round(init.y + finalDy);
                    
                    if (target.type === COMPONENT_TYPES.DRAW_LINE) {
                        target.w = Math.round(init.w + finalDx);
                        target.h = Math.round(init.h + finalDy);
                    } else if (target.type === COMPONENT_TYPES.DRAW_PATH) {
                        // 暂不对 Path 进行复杂的 d 属性重算
                        // Path 通常是相对移动，这里简化处理，Path 不随多选位移（或需要解析 SVG）
                    }
                }
            });
        } 
        // 5. Resize (仅支持单选)
        else if (dragState.isResizing) {
            const h = dragState.handle;
            let newX = dragState.initialX, newY = dragState.initialY, newW = dragState.initialW, newH = dragState.initialH;
            
            if (h.includes('r')) newW = Math.max(10, dragState.initialW + dx);
            if (h.includes('l')) { const d = Math.min(dragState.initialW - 10, dx); newX += d; newW -= d; }
            if (comp.type !== COMPONENT_TYPES.TABLE) {
                if (h.includes('b')) newH = Math.max(10, dragState.initialH + dy);
                if (h.includes('t')) { const d = Math.min(dragState.initialH - 10, dy); newY += d; newH -= d; }
            }
            // 确保尺寸不为负
            if (newW < 5) newW = 5;
            if (comp.type !== COMPONENT_TYPES.TABLE && newH < 5) newH = 5;

            comp.x = Math.round(newX); comp.y = Math.round(newY); comp.w = Math.round(newW);
            if (comp.type !== COMPONENT_TYPES.TABLE) comp.h = Math.round(newH);
        }
    }

    function handleMouseUp() {
        cleanupListeners();
        vGuides.value = []; hGuides.value = []; snapState.active = false;
        
        dragState.component = null; 
        dragState.handle = null; 
        dragState.lockedPoint = null; 
        dragState.initialPositions = {};
        dragState.selectionRect = { x:0, y:0, w:0, h:0 };
    }

    return { 
        enterDrawMode, exitDrawMode, alignLine, handleMouseDown, 
        moveCanvas, scaleCanvas, centerCanvasContent, dragState, centerActiveComponent,
        resetCanvasScale 
    };
}