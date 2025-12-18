<script setup>
import { ref, computed, watch } from 'vue';
import { bitable } from '@lark-base-open/js-sdk';
import { 
  Plus as IconPlus, CopyDocument, Delete as IconDelete, Connection,
  Close, EditPen, WarningFilled, Link, Help, Download, Upload, DocumentCopy,
  Cloudy, UploadFilled, Search, Sort, Share, Lock, Refresh, UserFilled, Goods,
  MoreFilled, FolderChecked, Clock, Timer, Check, Monitor, Suitcase,
  Operation, Files, Rank, Unlock, QuestionFilled, InfoFilled, Collection,
  Document, Loading // [修复] 引入 Loading 图标
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  globalSettings, templates, currentTemplateId, allTableList, templateManager,
  currentViewId, allFields, globalOps
} from '../../store';
import { useConfig, userStatus } from '../../composables/useConfig'; 

const { 
    exportConfig, importConfig, cloudBackup, getCloudBackups, 
    restoreCloudBackupById, deleteCloudBackupById, publishCloudBackup, unpublishCloudBackup,
    checkUserStatus 
} = useConfig();

const restoreDialogVisible = ref(false);
const activeCloudTab = ref('private'); 
const backupList = ref([]);
const isBackupLoading = ref(false);

const privateSearch = ref('');
const privateSort = ref('DESC');
const publicSearch = ref('');
const publicSort = ref('DESC');

const currentTemplate = computed(() => templates.value.find(t => t.id === currentTemplateId.value));
const isLinkedToCurrentView = computed(() => {
    if (!currentTemplate.value || !currentViewId.value) return false;
    return currentTemplate.value.linkedViews?.some(v => v.viewId === currentViewId.value);
});

// --- 辅助函数 ---
const getAvatarColor = (name) => {
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];
    let hash = 0;
    const str = name || 'L';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const getAvatarChar = (name) => (name ? name.charAt(0).toUpperCase() : 'U');

// [核心修复] 强制 HTTPS 修复函数 + 时间戳防缓存
const fixAvatarUrl = (url) => {
    if (!url) return '';
    let res = url;
    if (res.startsWith('http://')) {
        res = res.replace('http://', 'https://');
    }
    // 添加随机时间戳，强制浏览器每次重新请求，配合 no-referrer 解决防盗链缓存问题
    return res + (res.includes('?') ? '&' : '?') + 't=' + Date.now();
};

const formatVersionDisplay = (versionStr) => {
    if (!versionStr || versionStr.length < 14) return versionStr;
    const h = versionStr.slice(8, 10);
    const min = versionStr.slice(10, 12);
    // 简短显示，只取 时:分
    return `${h}:${min}`;
};

// --- 绑定逻辑 ---
const selectedBindTableId = ref('');
const availableViews = ref([]);
const selectedBindViews = ref([]);
const isLoadingViews = ref(false);
watch(selectedBindTableId, async (newVal) => {
    selectedBindViews.value = []; availableViews.value = [];
    if (!newVal) return;
    isLoadingViews.value = true;
    try {
        const table = await bitable.base.getTable(newVal);
        const viewList = await table.getViewList();
        availableViews.value = await Promise.all(viewList.map(async v => ({ id: v.id, name: await v.getName() })));
    } catch (e) { ElMessage.error('获取视图列表失败'); } finally { isLoadingViews.value = false; }
});
const handleAddBinding = () => {
    if (!selectedBindTableId.value || selectedBindViews.value.length === 0) return;
    const tableInfo = allTableList.value.find(t => t.id === selectedBindTableId.value);
    const newBindings = selectedBindViews.value.map(viewId => {
        const viewInfo = availableViews.value.find(v => v.id === viewId);
        return { viewId: viewId, viewName: viewInfo.name, tableId: selectedBindTableId.value, tableName: tableInfo.name };
    });
    const existingIds = currentTemplate.value.linkedViews?.map(v => v.viewId) || [];
    const uniqueNew = newBindings.filter(b => !existingIds.includes(b.viewId));
    if (uniqueNew.length > 0) {
        if (!currentTemplate.value.linkedViews) currentTemplate.value.linkedViews = [];
        currentTemplate.value.linkedViews.push(...uniqueNew);
        templates.value = [...templates.value];
        ElMessage.success(`已关联 ${uniqueNew.length} 个视图`);
        selectedBindViews.value = []; 
    } else { ElMessage.warning('选中的视图已关联'); }
};
const removeBinding = (viewId) => {
    const idx = currentTemplate.value.linkedViews.findIndex(v => v.viewId === viewId);
    if (idx > -1) { currentTemplate.value.linkedViews.splice(idx, 1); templates.value = [...templates.value]; }
};
const handleDeleteTemplate = () => {
    if(!currentTemplateId.value) return;
    if (templates.value.length <= 1) { ElMessage.warning('至少保留一个模板'); return; }
    ElMessageBox.confirm('删除模板?', '警告', { type: 'warning' }).then(() => {
        templateManager.deleteTemplate(currentTemplateId.value);
    }).catch(() => {});
};

// --- Cloud Logic ---
const loadCloudData = async () => {
    isBackupLoading.value = true;
    const type = activeCloudTab.value;
    const search = type === 'private' ? privateSearch.value : publicSearch.value;
    const sort = type === 'private' ? privateSort.value : publicSort.value;
    backupList.value = await getCloudBackups(type, search, sort);
    isBackupLoading.value = false;
};
watch(activeCloudTab, loadCloudData);

// [新增] 打开版本库前强制校验权限
const handleCloudRestore = async () => { 
    // [修改] 修复 Loading 调用方式
    const loading = ElMessage({ message: '校验云端授权...', type: 'info', icon: Loading, duration: 0 });
    try {
        await checkUserStatus(); // 强制与数据库比对
    } catch(e) {
        loading.close();
        ElMessage.error('校验失败，请检查网络'); 
        return;
    }
    loading.close();

    if (!userStatus.isActive) {
        ElMessage.warning('您的授权已过期，请前往激活');
        return;
    }

    restoreDialogVisible.value = true; 
    loadCloudData(); 
};

const toggleSort = () => {
    if (activeCloudTab.value === 'private') { privateSort.value = privateSort.value === 'DESC' ? 'ASC' : 'DESC'; } 
    else { publicSort.value = publicSort.value === 'DESC' ? 'ASC' : 'DESC'; }
    loadCloudData();
};
const handleRestore = (row) => {
    const idToRestore = activeCloudTab.value === 'public' ? row.backup_id : row.id;
    ElMessageBox.confirm('恢复将覆盖当前配置，确定吗？', '恢复确认', { type: 'warning' }).then(async () => {
        const success = await restoreCloudBackupById(idToRestore);
        if (success) restoreDialogVisible.value = false;
    }).catch(() => {});
};
const handleDelete = (row) => {
    ElMessageBox.confirm('确定删除该备份吗？\n如果已公开，公共库中也会同步删除。', '删除确认', { type: 'error' }).then(async () => {
        isBackupLoading.value = true;
        const success = await deleteCloudBackupById(row.id);
        if (success) loadCloudData(); else isBackupLoading.value = false;
    }).catch(() => {});
};
const handlePublish = async (row) => {
    const success = await publishCloudBackup(row.id);
    if (success) loadCloudData();
};
const handleUnpublish = async (row) => {
    const success = await unpublishCloudBackup(row.id);
    if (success) loadCloudData();
};
</script>

<template>
  <div class="content-inner fade-in vertically-centered">
    <div class="manager-container">
        <!-- 主界面 -->
        <template v-if="!globalSettings.isPreviewLocked">
            
            <!-- 模板控制台卡片 -->
            <div class="template-console-card">
                <div class="console-header">
                    <div class="console-title">
                        <div class="icon-wrap"><el-icon><Collection /></el-icon></div>
                        <span>模板列表</span>
                    </div>
                    <button class="new-template-btn" @click="templateManager.addTemplate('新模板')">
                        <el-icon><IconPlus /></el-icon> 新建
                    </button>
                </div>

                <div class="console-selector">
                    <el-select 
                        v-model="currentTemplateId" 
                        size="default" 
                        placeholder="选择模板..." 
                        class="wide-select"
                        :teleported="false"
                    >
                        <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
                    </el-select>
                </div>

                <div v-if="currentTemplate" class="console-actions">
                    <div class="rename-box">
                        <el-icon class="edit-icon"><EditPen /></el-icon>
                        <input 
                            v-model="currentTemplate.name" 
                            class="transparent-input" 
                            placeholder="重命名..." 
                        />
                    </div>
                    <div class="action-buttons">
                        <el-tooltip content="复制模板" placement="top">
                            <button class="icon-btn" @click="templateManager.copyCurrentTemplate()">
                                <el-icon><CopyDocument /></el-icon>
                            </button>
                        </el-tooltip>
                        <el-tooltip content="删除模板" placement="top">
                            <button class="icon-btn danger" @click="handleDeleteTemplate" :disabled="templates.length <= 1">
                                <el-icon><IconDelete /></el-icon>
                            </button>
                        </el-tooltip>
                    </div>
                </div>
            </div>

            <template v-if="currentTemplate">
                <!-- 1. 视图关联 -->
                <div class="prop-card compact mt-3">
                    <div class="card-header"><el-icon class="mr-1"><Connection /></el-icon> 视图关联</div>
                    <div class="v-stack">
                        <div class="h-stack">
                            <el-select v-model="selectedBindTableId" placeholder="选表" size="small" class="flex-1"><el-option v-for="t in allTableList" :key="t.id" :label="t.name" :value="t.id" /></el-select>
                            <el-select v-model="selectedBindViews" placeholder="选视图" multiple collapse-tags size="small" class="flex-1" :loading="isLoadingViews" :disabled="!selectedBindTableId"><el-option v-for="v in availableViews" :key="v.id" :label="v.name" :value="v.id" /></el-select>
                            <el-button type="primary" size="small" @click="handleAddBinding" :disabled="selectedBindViews.length === 0" circle><el-icon><IconPlus /></el-icon></el-button>
                        </div>
                        <div class="tags-area">
                            <template v-if="currentTemplate.linkedViews && currentTemplate.linkedViews.length > 0">
                                <span v-for="bv in currentTemplate.linkedViews" :key="bv.viewId" class="chip">{{ bv.viewName }}<el-icon class="close" @click="removeBinding(bv.viewId)"><Close /></el-icon></span>
                            </template>
                            <span v-else class="hint-text">暂无关联，手动切换</span>
                        </div>
                    </div>
                </div>

                <!-- 2. 全局设置 -->
                <div class="settings-grid-container mt-2">
                    <div class="section-label">全局设置</div>
                    
                    <div class="setting-card">
                        <div class="setting-header">
                            <div class="setting-title"><el-icon class="icon-files"><Files /></el-icon> 分页字段</div>
                            <el-button v-if="globalSettings.groupingFieldIds?.length > 0" link type="primary" size="small" @click="globalSettings.groupingFieldIds = []" style="font-size: 11px; height: auto; padding: 0;">清空</el-button>
                        </div>
                        <el-select v-model="globalSettings.groupingFieldIds" multiple placeholder="选择数据分组依据" size="small" class="w-full no-border-input">
                            <el-option v-for="f in allFields" :key="f.id" :label="f.name" :value="f.id" />
                        </el-select>
                    </div>

                    <div class="setting-card highlight">
                        <div class="setting-header">
                            <div class="setting-title"><el-icon class="icon-calc"><Operation /></el-icon> 高级公式</div>
                            <el-popover placement="left" :width="340" trigger="hover" popper-class="formula-help-popper">
                                <template #reference><div class="help-trigger"><el-icon><QuestionFilled /></el-icon> 规则</div></template>
                                <div class="formula-docs">
                                    <div class="doc-header"><el-icon><InfoFilled /></el-icon> 公式编写指南</div>
                                    <div class="doc-section"><div class="doc-title">基础语法</div><div class="code-block">目标变量 = 表达式</div><div class="doc-text">使用半角符号，支持 <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>( )</code></div></div>
                                    <div class="doc-section"><div class="doc-title">变量引用</div><div class="doc-text">直接使用 <b>字段名称</b>，如 <code>单价</code>。如果字段名包含特殊字符，请先在数据表中简化。</div></div>
                                    <div class="doc-section"><div class="doc-title">多条公式</div><div class="doc-text">使用分号 <code>;</code> 分隔多条语句，按顺序执行。</div></div>
                                    <div class="doc-section bg-gray">
                                        <div class="doc-title">实战示例</div>
                                        <div class="example-row"><span class="ex-label">计算总额：</span><code>总金额 = 单价 * 数量</code></div>
                                        <div class="example-row"><span class="ex-label">含税价：</span><code>税后价 = 总金额 * 1.13</code></div>
                                        <div class="example-row"><span class="ex-label">多步计算：</span><code>小计 = A * B; 总计 = 小计 + 运费</code></div>
                                    </div>
                                </div>
                            </el-popover>
                        </div>
                        <el-input v-model="globalSettings.calculationFormulas" type="textarea" :rows="3" size="small" class="code-input-area" placeholder="例如：总价 = 单价 * 数量; &#10;实付 = 总价 - 折扣"/>
                    </div>

                    <div class="settings-row">
                        <div class="setting-card small flex-1">
                            <div class="setting-header inline"><el-icon class="icon-rank"><Rank /></el-icon> 键盘步长</div>
                            <el-input-number v-model="globalOps.moveStep" :min="1" :controls="false" size="small" class="mini-input-box"/>
                        </div>
                        <div class="setting-card small flex-1" :class="{ 'is-active': globalSettings.isPreviewLocked }">
                            <div class="setting-header inline"><el-icon class="icon-lock"><component :is="globalSettings.isPreviewLocked ? Lock : Unlock" /></el-icon> 锁定预览</div>
                            <el-switch v-model="globalSettings.isPreviewLocked" size="small" style="--el-switch-on-color: #1a73e8;"/>
                        </div>
                    </div>
                </div>

                <!-- 3. 数据备份 -->
                <div class="backup-section mt-3">
                    <div class="section-label"><el-icon class="mr-1"><DocumentCopy /></el-icon> 数据备份</div>
                    <div class="backup-split-grid">
                        <div class="backup-column local">
                            <div class="col-header"><el-icon><Monitor /></el-icon> 本地文件</div>
                            <div class="col-actions">
                                <div class="action-tile" @click="exportConfig">
                                    <div class="tile-icon export"><el-icon><Download /></el-icon></div>
                                    <span class="tile-text">导出</span>
                                </div>
                                <div class="action-tile" @click="importConfig">
                                    <div class="tile-icon import"><el-icon><Upload /></el-icon></div>
                                    <span class="tile-text">导入</span>
                                </div>
                            </div>
                        </div>
                        <div class="backup-column cloud">
                            <div class="col-header"><el-icon><Cloudy /></el-icon> 云端同步</div>
                            <div class="col-actions">
                                <div class="action-tile" @click="cloudBackup">
                                    <div class="tile-icon cloud-add"><el-icon><UploadFilled /></el-icon></div>
                                    <span class="tile-text">云端备份</span>
                                </div>
                                <div class="action-tile" @click="handleCloudRestore">
                                    <div class="tile-icon cloud-list"><el-icon><Suitcase /></el-icon></div>
                                    <span class="tile-text">版本库</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </template>
            <!-- [修改] 优化了锁定预览模式的布局，添加了 justify-content: space-between -->
            <div v-else class="empty-state-panel">
                <div class="empty-text">请选择或新建一个模板以开始编辑</div>
                <div class="lock-control-row">
                    <span class="label">锁定预览模式</span>
                    <el-switch v-model="globalSettings.isPreviewLocked" size="small"/>
                </div>
            </div>
        </template>
        <template v-else>
            <div class="locked-info-card">
                <div class="info-row"><span class="label">当前模板：</span><span class="value">{{ currentTemplate?.name || '无 (未关联)' }}</span></div>
                <div class="info-row" v-if="currentTemplate && isLinkedToCurrentView"><span class="label status-success"><el-icon><Link /></el-icon> 已关联当前视图</span></div>
                <div class="info-row" v-else><span class="label status-warning"><el-icon><WarningFilled /></el-icon> 未关联当前视图</span></div>
                <div class="divider"></div>
                <div class="unlock-row"><span class="label">如需编辑请解锁</span><el-switch v-model="globalSettings.isPreviewLocked" size="small"/></div>
            </div>
        </template>
    </div>

    <!-- 云端管理对话框 -->
    <el-dialog 
        v-model="restoreDialogVisible" 
        width="600px" 
        align-center 
        destroy-on-close 
        class="modern-cloud-dialog"
        :show-close="false"
    >
        <template #header="{ close, titleId, titleClass }">
            <div class="dialog-custom-header">
                <div class="header-main">
                    <div class="header-icon-bg"><el-icon><Cloudy /></el-icon></div>
                    <div class="header-text">
                        <h4 :id="titleId" :class="titleClass">云端版本库</h4>
                        <span class="header-sub">管理您的个人备份与公共模板</span>
                    </div>
                </div>
                <button class="header-close-btn" @click="close"><el-icon><Close /></el-icon></button>
            </div>
        </template>

        <div class="cloud-manager">
            <div class="manager-top-bar">
                <el-tabs v-model="activeCloudTab" class="slim-tabs">
                    <el-tab-pane label="我的备份" name="private"></el-tab-pane>
                    <el-tab-pane label="公共库" name="public"></el-tab-pane>
                </el-tabs>
                <div class="bar-actions">
                    <div class="mini-search-box">
                        <input v-if="activeCloudTab === 'private'" v-model="privateSearch" class="transparent-input" placeholder="搜索..." @keyup.enter="loadCloudData"/>
                        <input v-else v-model="publicSearch" class="transparent-input" placeholder="搜索..." @keyup.enter="loadCloudData"/>
                        <el-icon class="search-indicator" @click="loadCloudData"><Search /></el-icon>
                    </div>
                    <el-tooltip content="刷新" placement="top"><button class="icon-action-btn" @click="loadCloudData"><el-icon><Refresh /></el-icon></button></el-tooltip>
                    <el-tooltip :content="(activeCloudTab === 'private' ? privateSort : publicSort) === 'DESC' ? '最新优先' : '最早优先'" placement="top"><button class="icon-action-btn" @click="toggleSort"><el-icon :class="{ 'rotate-180': (activeCloudTab === 'private' ? privateSort : publicSort) === 'ASC' }"><Sort /></el-icon></button></el-tooltip>
                </div>
            </div>

            <div v-loading="isBackupLoading" class="list-viewport scrollable-y">
                <div v-if="activeCloudTab === 'private'" class="list-stack">
                    <div v-if="backupList.length === 0" class="empty-state-minimal"><span class="empty-text">暂无备份，去新建一个吧</span></div>
                    
                    <div v-for="item in backupList" :key="item.id" class="list-card-item">
                        <!-- [UI 重构] 文件卡片图标 (Squircle & Gradient) - Flex 居中 -->
                        <div class="file-capsule-icon" :style="{ '--theme-color': getAvatarColor(item.version) }">
                            <el-icon class="capsule-icon"><Document /></el-icon>
                        </div>

                        <div class="card-body">
                            <div class="body-top">
                                <span class="card-title" :title="item.alias">{{ item.alias }}</span>
                                <span class="version-tag">{{ formatVersionDisplay(item.version) }}</span>
                            </div>
                            <div class="body-bottom">
                                <span class="meta-time">{{ item.created_at }}</span>
                                <span v-if="item.is_public == 1" class="meta-tag public">已公开</span>
                            </div>
                        </div>
                        <div class="card-actions">
                            <el-tooltip :content="item.is_public == 1 ? '取消公开' : '公开'" placement="top" :show-after="600"><button class="mini-act-btn" :class="item.is_public == 1 ? 'active' : ''" @click.stop="item.is_public == 1 ? handleUnpublish(item) : handlePublish(item)"><el-icon><component :is="item.is_public == 1 ? Lock : Share" /></el-icon></button></el-tooltip>
                            <el-tooltip content="恢复" placement="top" :show-after="600"><button class="mini-act-btn primary" @click.stop="handleRestore(item)"><el-icon><Refresh /></el-icon></button></el-tooltip>
                            <el-tooltip content="删除" placement="top" :show-after="600"><button class="mini-act-btn danger" @click.stop="handleDelete(item)"><el-icon><IconDelete /></el-icon></button></el-tooltip>
                        </div>
                    </div>
                </div>
                
                <div v-else class="list-stack">
                    <div v-if="backupList.length === 0" class="empty-state-minimal"><span class="empty-text">暂无公共模板</span></div>
                    <div v-for="item in backupList" :key="item.public_id" class="list-card-item public">
                        <div v-if="item.avatar" class="visual-anchor avatar-img-wrapper">
                            <!-- [修复] 使用 fixAvatarUrl + referrerpolicy -->
                            <img :src="fixAvatarUrl(item.avatar)" class="author-avatar-img" referrerpolicy="no-referrer" />
                        </div>
                        <div v-else class="visual-anchor avatar" :style="{ backgroundColor: getAvatarColor(item.user_name) }">{{ getAvatarChar(item.user_name) }}</div>
                        
                        <div class="card-body">
                            <div class="body-top"><span class="card-title">{{ item.alias }}</span><span class="author-label">@{{ item.user_name }}</span></div>
                            <div class="body-desc" :title="item.description">{{ item.description || '暂无描述' }}</div>
                        </div>
                        <div class="card-actions static"><button class="use-btn" @click="handleRestore(item)">使用</button></div>
                    </div>
                </div>
            </div>
        </div>
    </el-dialog>
  </div>
</template>

<style scoped>
/* Base */
.content-inner { max-width: 800px; margin: 0 auto; width: 100%; animation: fadeIn 0.2s ease-out; flex: 1; display: flex; flex-direction: column; }
.vertically-centered { min-height: 100%; }
.manager-container { margin: auto 0; width: 100%; }
.action-bar { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 13px; font-weight: 600; }
.btn-group { display: flex; gap: 6px; }
.mini-fab { width: 24px; height: 24px; border-radius: 50%; border: 1px solid #e0e0e0; background: #fff; color: #5f6368; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s; }
.mini-fab:hover { background: #f8f9fa; border-color: #dcdfe6; color: #1a73e8; }
.mini-fab.danger:hover { color: #f56c6c; background: #fef0f0; border-color: #fab6b6; }
.mini-fab.danger.disabled { opacity: 0.5; cursor: not-allowed; background: #f5f5f5; color: #ccc; border-color: #e0e0e0; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mb-3 { margin-bottom: 12px; }
.prop-card { background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.prop-card.compact { padding: 10px; }
.card-header { font-size: 12px; font-weight: 600; color: #202124; margin-bottom: 10px; display: flex; align-items: center; }
.v-stack { display: flex; flex-direction: column; gap: 10px; }
.h-stack { display: flex; gap: 8px; align-items: center; }
.flex-1 { flex: 1; }
.tags-area { display: flex; flex-wrap: wrap; gap: 6px; min-height: 24px; align-items: center; }
.chip { display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: #e8f0fe; color: #1a73e8; border-radius: 10px; font-size: 11px; }
.chip .close { font-size: 12px; cursor: pointer; opacity: 0.6; }
.chip .close:hover { opacity: 1; }
.hint-text { font-size: 11px; color: #9aa0a6; font-style: italic; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.empty-state-panel { background: #fff; border: 1px dashed #e0e0e0; border-radius: 8px; padding: 16px; }
.empty-text { text-align: center; color: #9aa0a6; font-size: 12px; padding: 12px 0; }
.border-t { border-top: 1px solid #f1f3f4; }
.locked-info-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.info-row .value { font-size: 13px; font-weight: 500; color: #202124; }
.status-success { color: #13ce66; display: flex; align-items: center; gap: 4px; }
.status-warning { color: #e6a23c; display: flex; align-items: center; gap: 4px; }
.divider { height: 1px; background: #f1f3f4; margin: 12px 0; }
.mr-1 { margin-right: 4px; }
.unlock-row { display: flex; justify-content: space-between; align-items: center; }

/* [新增] 锁定控制行样式 - 实现左右对齐 */
.lock-control-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f1f3f4;
}
.lock-control-row .label {
    font-size: 12px;
    color: #5f6368;
    font-weight: 500;
}

/* === Template Console Card === */
.template-console-card {
    background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; 
    padding: 14px 16px; margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    display: flex; flex-direction: column; gap: 12px;
}

.console-header { display: flex; justify-content: space-between; align-items: center; }
.console-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #3c4043; }
.icon-wrap { 
    width: 24px; height: 24px; background: #e8f0fe; color: #1a73e8; 
    border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px;
}

.new-template-btn {
    background: #1a73e8; color: #fff; border: none; padding: 6px 14px; 
    border-radius: 16px; font-size: 12px; font-weight: 500; 
    display: flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s;
}
.new-template-btn:hover { background: #1557b0; box-shadow: 0 2px 6px rgba(26,115,232,0.3); transform: translateY(-1px); }

.console-selector .wide-select { width: 100%; }

.console-actions { 
    display: flex; align-items: center; justify-content: space-between; 
    padding-top: 12px; border-top: 1px solid #f1f3f4;
}
.rename-box { 
    flex: 1; display: flex; align-items: center; gap: 6px; 
    background: #f8f9fa; border-radius: 6px; padding: 4px 8px; margin-right: 12px; 
    transition: background 0.2s;
}
.rename-box:focus-within { background: #fff; box-shadow: 0 0 0 1px #1a73e8 inset; }
.edit-icon { color: #9aa0a6; font-size: 14px; }
.transparent-input { border: none; background: transparent; outline: none; font-size: 12px; color: #3c4043; width: 100%; }

.action-buttons { display: flex; gap: 4px; }
.icon-btn { 
    width: 28px; height: 28px; border: 1px solid #e0e0e0; background: #fff; border-radius: 4px; 
    display: flex; align-items: center; justify-content: center; color: #5f6368; cursor: pointer; transition: all 0.2s; 
}
.icon-btn:hover { border-color: #1a73e8; color: #1a73e8; background: #f8f9fa; }
.icon-btn.danger:hover { border-color: #f56c6c; color: #f56c6c; background: #fef0f0; }
.icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* === Settings Card UI === */
.section-label { font-size: 11px; font-weight: 700; color: #5f6368; text-transform: uppercase; margin-bottom: 8px; padding-left: 2px; }
.settings-grid-container { display: flex; flex-direction: column; gap: 10px; }

.setting-card {
    background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.setting-card:hover { border-color: #d2e3fc; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
.setting-card.highlight:hover { border-color: #409eff; }
.setting-card.small { padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; height: 36px; }
.setting-card.small.is-active { background: #f0f9eb; border-color: #e1f3d8; }

.settings-row { display: flex; gap: 10px; }

.setting-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.setting-header.inline { margin-bottom: 0; }
.setting-title { font-size: 12px; font-weight: 600; color: #3c4043; display: flex; align-items: center; gap: 6px; }
.icon-files { color: #f59e0b; }
.icon-calc { color: #1a73e8; }
.icon-rank { color: #8ab4f8; }
.icon-lock { color: #5f6368; }

.help-trigger {
    font-size: 11px; color: #9aa0a6; cursor: pointer; display: flex; align-items: center; gap: 2px;
    padding: 2px 6px; border-radius: 4px; background: #f8f9fa; transition: all 0.2s;
}
.help-trigger:hover { color: #1a73e8; background: #e8f0fe; }

.code-input-area :deep(.el-textarea__inner) {
    font-family: 'Roboto Mono', monospace; font-size: 11px; background: #fbfbfc; border-color: #f1f3f4;
    padding: 6px 8px;
}
.code-input-area :deep(.el-textarea__inner:focus) { background: #fff; border-color: #1a73e8; }
.no-border-input :deep(.el-input__wrapper) { box-shadow: none !important; padding: 0; }
.no-border-input :deep(.el-input__inner) { text-align: right; }
.mini-input-box { width: 60px; }

/* === Backup Section === */
.backup-section {
    background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.backup-split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.backup-column { display: flex; flex-direction: column; gap: 10px; }
.backup-column.local { padding-right: 8px; border-right: 1px dashed #f1f3f4; }
.col-header { font-size: 11px; font-weight: 500; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.col-actions { display: flex; gap: 8px; }

.action-tile {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #f8f9fa; border: 1px solid #f1f3f4; border-radius: 8px; padding: 10px 4px;
    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.action-tile:hover { background: #fff; border-color: #d2e3fc; box-shadow: 0 4px 12px rgba(26,115,232,0.1); transform: translateY(-2px); }

.tile-icon { font-size: 18px; margin-bottom: 4px; color: #5f6368; }
.tile-text { font-size: 11px; font-weight: 500; color: #3c4043; }
.tile-icon.export { color: #137333; }
.tile-icon.import { color: #1967d2; }
.tile-icon.cloud-add { color: #1a73e8; }
.tile-icon.cloud-list { color: #e37400; }

/* === Cloud Dialog & Lists === */
.dialog-custom-header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.header-main { display: flex; align-items: center; gap: 12px; }
.header-icon-bg { width: 40px; height: 40px; background: #e8f0fe; border-radius: 10px; color: #1a73e8; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.header-text h4 { margin: 0; font-size: 16px; font-weight: 600; color: #202124; line-height: 1.2; }
.header-sub { font-size: 12px; color: #5f6368; }
.header-close-btn { background: none; border: none; font-size: 18px; color: #9aa0a6; cursor: pointer; transition: color 0.2s; padding: 4px; }
.header-close-btn:hover { color: #202124; }

.cloud-manager { display: flex; flex-direction: column; height: 100%; gap: 0; }
.manager-top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #f1f3f4; margin-bottom: 12px; }
.slim-tabs :deep(.el-tabs__header) { margin: 0; }
.slim-tabs :deep(.el-tabs__nav-wrap::after) { display: none; }
.slim-tabs :deep(.el-tabs__active-bar) { height: 3px; border-radius: 2px; }
.slim-tabs :deep(.el-tabs__item) { font-size: 14px; font-weight: 500; color: #5f6368; padding: 0 16px; }
.slim-tabs :deep(.el-tabs__item.is-active) { color: #1a73e8; }

.bar-actions { display: flex; align-items: center; gap: 8px; }
.mini-search-box { display: flex; align-items: center; background: #f1f3f4; border-radius: 16px; padding: 0 8px; height: 28px; width: 140px; transition: all 0.2s; }
.mini-search-box:focus-within { width: 180px; background: #fff; box-shadow: 0 0 0 1px #1a73e8 inset; }
.transparent-input { border: none; background: transparent; outline: none; font-size: 12px; flex: 1; min-width: 0; }
.search-indicator { font-size: 12px; color: #9aa0a6; cursor: pointer; }
.icon-action-btn { width: 28px; height: 28px; border-radius: 50%; border: 1px solid transparent; background: transparent; color: #5f6368; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.icon-action-btn:hover { background: #f1f3f4; color: #202124; }
.rotate-180 { transform: rotate(180deg); }

.list-viewport { min-height: 320px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
.list-stack { display: flex; flex-direction: column; gap: 8px; }
.empty-state-minimal { padding: 40px; text-align: center; color: #bdc1c6; font-size: 13px; border: 1px dashed #e0e0e0; border-radius: 8px; margin-top: 10px; }

.list-card-item { display: flex; align-items: center; padding: 12px; background: #fff; border: 1px solid #f1f3f4; border-radius: 10px; transition: all 0.2s ease; position: relative; }
.list-card-item:hover { border-color: #d2e3fc; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transform: translateX(2px); z-index: 1; }

/* [UI重构] File Capsule Icon - Squircle */
.file-capsule-icon {
    width: 44px; height: 44px; margin-right: 14px; flex-shrink: 0;
    position: relative;
    border-radius: 14px; /* Superellipse-like */
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    background: var(--theme-color);
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    background-image: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0) 100%);
    transition: transform 0.2s;
}
.list-card-item:hover .file-capsule-icon { transform: scale(1.05); }
.capsule-icon { font-size: 20px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); }

.visual-anchor { width: 42px; height: 42px; background: #f8f9fa; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; border: 1px solid transparent; }
.visual-anchor.avatar { border-radius: 50%; color: #fff; font-size: 18px; font-weight: 600; }

.avatar-img-wrapper { border-radius: 50%; padding: 0; overflow: hidden; background: #fff; border: 1px solid #f1f3f4; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; margin-right: 12px; }
.author-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.card-body { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.body-top { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 14px; font-weight: 600; color: #3c4043; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.version-tag { 
    font-size: 10px; background: #f1f3f4; padding: 2px 6px; 
    border-radius: 6px; color: #5f6368; font-weight: 600; font-family: monospace; 
}
.author-label { font-size: 11px; color: #9aa0a6; }
.body-bottom { display: flex; align-items: center; gap: 8px; }
.meta-time { font-size: 11px; color: #9aa0a6; }
.meta-tag.public { font-size: 10px; color: #188038; background: #e6f4ea; padding: 0 4px; border-radius: 3px; }
.body-desc { font-size: 12px; color: #5f6368; line-height: 1.3; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 300px; }

.card-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.list-card-item:hover .card-actions { opacity: 1; }
.card-actions.static { opacity: 1; }

.mini-act-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: #5f6368; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.mini-act-btn:hover { background: #f1f3f4; color: #202124; }
.mini-act-btn.active { color: #e37400; background: #fef7e0; }
.mini-act-btn.primary:hover { color: #1a73e8; background: #e8f0fe; }
.mini-act-btn.danger:hover { color: #d93025; background: #fce8e6; }
.use-btn { background: #e8f0fe; color: #1a73e8; border: none; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.list-card-item:hover .use-btn { background: #1a73e8; color: #fff; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* Popover Docs Style */
.formula-docs { font-family: 'Roboto', sans-serif; color: #3c4043; }
.doc-header { font-size: 13px; font-weight: 700; color: #1a73e8; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
.doc-section { margin-bottom: 8px; }
.doc-section.bg-gray { background: #f8f9fa; padding: 8px; border-radius: 6px; }
.doc-title { font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 2px; }
.doc-text { font-size: 11px; color: #5f6368; line-height: 1.4; }
.code-block { background: #f1f3f4; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 11px; color: #d93025; display: inline-block; margin-bottom: 2px; }
.example-row { display: flex; font-size: 11px; margin-bottom: 2px; }
.ex-label { color: #9aa0a6; min-width: 50px; }
.example-row code { color: #137333; font-family: monospace; }
</style>

<!-- Global style for custom tooltip -->
<style>
.formula-help-popper.el-popper { padding: 12px 16px !important; border-radius: 8px; }
</style>