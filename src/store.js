import { ref, reactive, watch, computed, toRaw } from 'vue';
import { uuid } from './utils'; 

// --- 1. 持久化工具 ---
function createPersistentRef(key, defaultValue) {
  const storedValue = localStorage.getItem(key);
  let initialValue;
  if (storedValue === null) {
    initialValue = defaultValue;
  } else {
    try { initialValue = JSON.parse(storedValue); } catch { initialValue = defaultValue; }
  }
  const dataRef = ref(initialValue);
  watch(dataRef, (newValue) => { localStorage.setItem(key, JSON.stringify(newValue)); }, { deep: true });
  return dataRef;
}

// [新增] 读取持久化锁定状态，确保刷新后状态保持
const getSavedLockState = () => {
    try {
        const val = localStorage.getItem('app_preview_locked_v3');
        return val !== null ? JSON.parse(val) === true : false;
    } catch { return false; }
};

// --- 2. 核心状态：模板系统 ---

const DEFAULT_SETTINGS = {
  paperWidth: 794, 
  paperHeight: 1123, 
  calculationFormulas: '', 
  groupingFieldIds: [],
  isPreviewLocked: false,
  structureScale: 100
};

export const templates = createPersistentRef('print_templates_v3', []); 
export const currentTemplateId = createPersistentRef('active_template_id_v3', null);

export const allTableList = ref([]); 
export const currentTableId = ref(null); 
export const currentViewId = ref(null);  

// --- 3. 核心状态：当前工作区 ---
// [修改] 初始化时优先使用保存的锁定状态
export const globalSettings = ref({ 
    ...DEFAULT_SETTINGS,
    isPreviewLocked: getSavedLockState()
});
export const layoutComponents = ref([]);

// --- 4. UI 交互状态 ---

export const isDrawMode = ref(false); 
export const activeComponentIds = ref([]); 
export const calculationResults = ref({}); 

// 主选中项：返回选中列表的最后一个
export const activeComponentId = computed({
    get: () => {
        const len = activeComponentIds.value.length;
        return len > 0 ? activeComponentIds.value[len - 1] : null;
    },
    set: (val) => {
        if (val) {
            activeComponentIds.value = [val];
        } else {
            activeComponentIds.value = [];
        }
    }
});

export const activeView = createPersistentRef('ui_active_view_v3', 'edit');
export const zoomScale = createPersistentRef('ui_zoom_scale_v3', 100); 
export const activeTab = createPersistentRef('ui_active_tab_v3', 'components');
export const panelHeight = createPersistentRef('ui_panel_height_v3', 280); 

export const isPanelCollapsed = createPersistentRef('ui_panel_collapsed_v3', true);
export const isPanelLocked = createPersistentRef('ui_panel_locked_v3', false);


// --- 5. 核心业务逻辑：状态管理 ---

// [解耦] 重置工作区状态，确保无残留
export const resetWorkspace = () => {
    activeComponentIds.value = [];
    calculationResults.value = {};
    isDrawMode.value = false;
    // 不重置 globalSettings，由模板加载覆盖
};

// [核心新增] 独立的高优先级预览模式控制器
// 负责处理锁定/解锁的所有副作用，确保业务逻辑独立
export const PreviewModeManager = {
    lock: () => {
        // 1. 强制切换 UI 状态
        if (activeView.value !== 'preview') activeView.value = 'preview';
        if (activeTab.value !== 'global') activeTab.value = 'global';
        
        // 2. 清理编辑状态
        isDrawMode.value = false;
        activeComponentIds.value = [];
        
        // 3. 业务联动 (可选)
        if (currentViewId.value) {
            templateManager.autoSwitchByViewId(currentViewId.value);
        }
    },
    
    unlock: () => {
        // 1. 恢复编辑状态
        if (activeView.value === 'preview') activeView.value = 'edit';
        
        // 2. 恢复侧边栏
        if (activeTab.value === 'global') activeTab.value = 'components';
        
        // 3. 再次清理
        isDrawMode.value = false;
        activeComponentIds.value = [];
    }
};

const loadTemplateToWorkspace = (tmplId) => {
    resetWorkspace(); // 先清理

    // 获取当前的锁定状态 (保持状态跨模板持久)
    const currentLockStatus = globalSettings.value.isPreviewLocked; 

    let newLayout = [];
    let newSettings = { ...DEFAULT_SETTINGS };

    if (tmplId) {
        const tmpl = templates.value.find(t => t.id === tmplId);
        if (tmpl) {
            newLayout = JSON.parse(JSON.stringify(tmpl.layout));
            newSettings = JSON.parse(JSON.stringify(tmpl.settings));
            if (newSettings.structureScale === undefined) newSettings.structureScale = 100;
        }
    }

    // 强制覆盖：锁定状态由全局控制，不受模板内保存的旧状态影响
    newSettings.isPreviewLocked = currentLockStatus;
    globalSettings.value = newSettings;
    layoutComponents.value = newLayout;

    // 重新应用状态逻辑，确保切换模板后界面状态正确
    if (currentLockStatus) {
        PreviewModeManager.lock();
    } else {
        // 如果未锁定，且处于预览模式，则切回编辑模式
        if (activeView.value === 'preview') {
            activeView.value = 'edit';
        }
    }
};

const initTemplates = () => {
    if (templates.value.length === 0) {
        const defaultTemplate = {
            id: uuid(),
            name: '默认模板',
            settings: { ...DEFAULT_SETTINGS },
            layout: [],
            linkedViews: []
        };
        templates.value = [defaultTemplate];
        currentTemplateId.value = defaultTemplate.id;
    } 
    // 加载初始模板
    loadTemplateToWorkspace(currentTemplateId.value);
};

initTemplates();

// 自动保存
watch(
    [globalSettings, layoutComponents], 
    ([newSettings, newLayout]) => {
        if (!currentTemplateId.value) return; 
        const index = templates.value.findIndex(t => t.id === currentTemplateId.value);
        if (index > -1) {
            // 深拷贝断开引用
            templates.value[index].settings = JSON.parse(JSON.stringify(toRaw(newSettings)));
            templates.value[index].layout = JSON.parse(JSON.stringify(toRaw(newLayout)));
            templates.value = [...templates.value]; // 触发更新
        }
    }, 
    { deep: true }
);

watch(currentTemplateId, (newId) => {
    loadTemplateToWorkspace(newId);
});

// --- 6. 模板管理 API ---
export const templateManager = {
    addTemplate: (name = '新模板') => {
        const newTmpl = {
            id: uuid(),
            name,
            settings: { ...DEFAULT_SETTINGS },
            layout: [],
            linkedViews: []
        };
        templates.value.push(newTmpl);
        currentTemplateId.value = newTmpl.id;
    },
    copyCurrentTemplate: () => {
        const current = templates.value.find(t => t.id === currentTemplateId.value);
        if (!current) return;
        const newTmpl = JSON.parse(JSON.stringify(current));
        newTmpl.id = uuid();
        newTmpl.name = `${current.name} (副本)`;
        newTmpl.linkedViews = []; 
        templates.value.push(newTmpl);
        currentTemplateId.value = newTmpl.id;
    },
    deleteTemplate: (id) => {
        if (templates.value.length <= 1) return;
        const idx = templates.value.findIndex(t => t.id === id);
        if (idx > -1) {
            templates.value.splice(idx, 1);
            if (id === currentTemplateId.value) {
                currentTemplateId.value = templates.value.length > 0 ? templates.value[0].id : null;
            }
        }
    },
    autoSwitchByViewId: (viewId) => {
        const targetTemplate = templates.value.find(t => t.linkedViews && t.linkedViews.some(v => v.viewId === viewId));
        if (targetTemplate) {
            if (targetTemplate.id !== currentTemplateId.value) {
                currentTemplateId.value = targetTemplate.id;
            }
        }
    }
};

// --- 7. 其他状态 ---
export const viewPortWidth = ref(1000); 
export const renderingScale = computed(() => {
    const contentWidth = globalSettings.value.paperWidth || 794;
    const availableWidth = Math.max(100, viewPortWidth.value - 40); 
    const fitScale = (availableWidth / contentWidth) * 100;
    // 限制最大自动缩放，防止过大
    return Math.min(zoomScale.value, fitScale);
});

export const drawSettings = reactive({ type: 'line', strokeWidth: 2, strokeColor: '#000000', strokeStyle: 'solid', lockDirection: 'none' });
export const globalOps = reactive({ moveStep: 10, scaleRatio: 10 });
export const snapState = reactive({ active: false, x: 0, y: 0 });
export const vGuides = ref([]); 
export const hGuides = ref([]);

export const allFields = ref([]);
export const invoiceDataByCustomer = ref([]);

// 安全的 activeComponent 获取
export const activeComponent = computed(() => {
    if (!activeComponentId.value || !layoutComponents.value) return null;
    return layoutComponents.value.find(c => c.id === activeComponentId.value) || null;
});

// --- [核心] 独立逻辑与状态守卫 ---

// 1. 主监听：锁定/解锁入口 (立即执行)
watch(() => globalSettings.value.isPreviewLocked, (isLocked) => {
    localStorage.setItem('app_preview_locked_v3', JSON.stringify(isLocked));
    if (isLocked) {
        PreviewModeManager.lock();
    } else {
        PreviewModeManager.unlock();
    }
}, { immediate: true });

// 2. 状态守卫：视图模式
// 防止其他功能在锁定模式下切换视图
watch(activeView, (newVal) => {
    if (globalSettings.value.isPreviewLocked && newVal !== 'preview') {
        activeView.value = 'preview';
    }
});

// 3. 状态守卫：标签页
// 防止其他功能在锁定模式下切换标签页
watch(activeTab, (newVal) => {
    if (globalSettings.value.isPreviewLocked && newVal !== 'global') {
        activeTab.value = 'global';
    }
});

// 4. 状态守卫：绘图模式
// 防止其他功能在锁定模式下进入绘图
watch(isDrawMode, (newVal) => {
    if (globalSettings.value.isPreviewLocked && newVal === true) {
        isDrawMode.value = false;
    }
});