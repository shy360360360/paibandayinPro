import { ref, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { layoutComponents, activeComponentId, activeView, currentTemplateId } from '../store';

export function useHistory() {
    const historyStack = ref([]);
    const historyIndex = ref(-1);
    let isInternalUpdate = false;

    const createDebouncedSave = () => {
        let timeout;
        const wrapper = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (!isInternalUpdate) saveState();
            }, 300); 
        };
        wrapper.cancel = () => clearTimeout(timeout);
        return wrapper;
    };

    const debouncedSave = createDebouncedSave();
    watch(layoutComponents, debouncedSave, { deep: true });

    // [核心修复] 监听模板切换，清空历史记录，防止跨模板撤销导致的污染
    watch(currentTemplateId, () => {
        historyStack.value = [];
        historyIndex.value = -1;
        // 立即为新模板保存一个初始状态
        saveState();
    });

    const saveState = () => {
        const json = JSON.stringify(layoutComponents.value);
        if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === json) return;
        if (historyIndex.value < historyStack.value.length - 1) {
            historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
        }
        historyStack.value.push(json);
        historyIndex.value++;
        if (historyStack.value.length > 50) {
            historyStack.value.shift();
            historyIndex.value--;
        }
    };

    const undo = () => {
        if (historyIndex.value > 0) {
            debouncedSave.cancel();
            isInternalUpdate = true;
            historyIndex.value--;
            layoutComponents.value = JSON.parse(historyStack.value[historyIndex.value]);
            activeComponentId.value = null;
            nextTick(() => { isInternalUpdate = false; });
            ElMessage.info('已撤销');
        }
    };

    const redo = () => {
        if (historyIndex.value < historyStack.value.length - 1) {
            debouncedSave.cancel();
            isInternalUpdate = true;
            historyIndex.value++;
            layoutComponents.value = JSON.parse(historyStack.value[historyIndex.value]);
            activeComponentId.value = null;
            nextTick(() => { isInternalUpdate = false; });
            ElMessage.info('已恢复');
        }
    };

    const clearCanvas = () => {
        ElMessageBox.confirm('确定要清空画布吗？此操作可撤销。', '清空确认', {
            confirmButtonText: '确定清空',
            cancelButtonText: '取消',
            type: 'warning',
        }).then(() => {
            layoutComponents.value = [];
            activeComponentId.value = null;
        }).catch(() => {});
    };

    const handleHistoryKeydown = (e) => {
        if (activeView.value !== 'edit') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault(); undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
            e.preventDefault(); redo();
        }
    };

    return { historyStack, historyIndex, undo, redo, clearCanvas, handleHistoryKeydown, saveState };
}