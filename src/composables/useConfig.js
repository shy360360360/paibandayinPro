import { ref, toRaw, nextTick, h, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { bitable } from '@lark-base-open/js-sdk';
import { 
    globalSettings, templates, layoutComponents, 
    currentTemplateId, activeView, activeComponentIds, 
    resetWorkspace, templateManager
} from '../store';
// [修复] 引入 Loading 图标
import { UploadFilled, DocumentChecked, UserFilled, Loading } from '@element-plus/icons-vue';

// [新增] 全局用户状态 (响应式，供 App.vue 和其他组件使用)
export const userStatus = reactive({
    isRegistered: false,
    isActive: false,
    userName: '',
    expirationTime: '', // 格式: 'YYYY-MM-DD HH:mm:ss'
    isForever: false,
    avatar: '', // 存储头像 URL
    activationType: 'trial', // [核心修复] 补全字段：激活卡类型 (hour, day, week, month, year, forever)
    lastCheckTime: 0 // [新增] 上次校验时间戳，用于缓存控制
});

// [核心修改] 前端直接上传到图床 (修正接口地址)
export const uploadAvatarToCloud = async (file) => {
    const formData = new FormData();
    // 依据文档: 参数名 image
    formData.append('image', file);

    try {
        const response = await fetch('https://api.kxzjoker.cn/api/360tc', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        // 适配返回结构 { code: 200, data: { image_url: '...' } }
        if (data.code === 200 && data.data && data.data.image_url) {
            let finalUrl = data.data.image_url;
            // 强制转换为 https，防止混合内容报错
            if (finalUrl.startsWith('http://')) {
                finalUrl = finalUrl.replace('http://', 'https://');
            }
            return finalUrl;
        } else {
            throw new Error(data.msg || data.tips || '图床接口返回错误');
        }
    } catch (error) {
        console.error('Avatar upload failed:', error);
        throw new Error('头像上传失败: ' + error.message);
    }
};

export function useConfig() {
    
    const API_BASE_URL = 'https://shy001.xian.zxtongshuo.cn/user_config.php';

    // 辅助函数
    const getAvatarColor = (name) => {
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'];
        let hash = 0; const str = name || 'L';
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const postRequest = async (action, data = {}) => {
        const params = new URLSearchParams();
        params.append('action', action);
        for (const key in data) {
            if (typeof data[key] === 'object') params.append(key, JSON.stringify(data[key]));
            else params.append(key, data[key]);
        }
        const res = await fetch(API_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    };

    // --- [核心] 用户状态管理 ---
    
    // [修改] 增加缓存机制：force 为 true 时强制请求，否则 30 分钟内使用缓存
    const checkUserStatus = async (force = false) => {
        const CACHE_DURATION = 30 * 60 * 1000; // 30 分钟
        const now = Date.now();

        // 如果不是强制校验，且上次校验时间在有效期内，则跳过请求
        if (!force && userStatus.lastCheckTime > 0 && (now - userStatus.lastCheckTime < CACHE_DURATION)) {
            return;
        }

        try {
            const userId = await bitable.bridge.getUserId();
            const res = await postRequest('checkUser', { user_id: userId });
            
            if (res.exists) {
                userStatus.isRegistered = true;
                userStatus.userName = res.user_name;
                userStatus.avatar = res.avatar || ''; // 同步头像 URL
                
                // [核心修复] 获取并存储 activationType，默认 fallback 到 'month' (如果已激活) 或 'trial'
                userStatus.activationType = res.last_activation_type || 'trial'; 
                
                // 校验有效期
                const expDate = new Date(res.expiration_time);
                const currentDate = new Date();
                
                // [修改] 永久会员判断逻辑：过期年份 > 当前年份 + 100
                userStatus.isForever = expDate.getFullYear() > (currentDate.getFullYear() + 100);
                
                if (expDate > currentDate) {
                    userStatus.isActive = true;
                    userStatus.expirationTime = res.expiration_time;
                } else {
                    userStatus.isActive = false; 
                    userStatus.expirationTime = res.expiration_time;
                }
            } else {
                userStatus.isRegistered = false;
                userStatus.isActive = false;
            }
            
            // 请求成功后更新校验时间戳
            userStatus.lastCheckTime = Date.now();
            
        } catch (e) {
            console.error('Check status failed:', e);
            // 失败时不更新时间戳，以便下次重试
        }
    };

    const registerUser = async (name, avatarUrl = null) => {
        const userId = await bitable.bridge.getUserId();
        // 传递 avatar URL
        const res = await postRequest('registerUser', { user_id: userId, user_name: name, avatar: avatarUrl });
        if (res.status === 'success') {
            await checkUserStatus(true); // 注册成功后强制刷新
            return true;
        }
        throw new Error(res.message);
    };

    const activatePlugin = async (code) => {
        const userId = await bitable.bridge.getUserId();
        const res = await postRequest('activateUser', { user_id: userId, code });
        if (res.status === 'success') {
            await checkUserStatus(true); // 激活成功后强制刷新
            ElMessage.success('激活成功！');
            return true;
        }
        throw new Error(res.message);
    };

    const createBackupPayload = () => {
        if (currentTemplateId.value) {
            const index = templates.value.findIndex(t => t.id === currentTemplateId.value);
            if (index > -1) {
                templates.value[index].settings = JSON.parse(JSON.stringify(toRaw(globalSettings.value)));
                templates.value[index].layout = JSON.parse(JSON.stringify(toRaw(layoutComponents.value)));
                templates.value = [...templates.value];
            }
        }
        return {
            version: '1.0', timestamp: Date.now(),
            templates: JSON.parse(JSON.stringify(templates.value)),
            globalSettings: JSON.parse(JSON.stringify(globalSettings.value))
        };
    };

    const applyImportedData = async (data) => {
        resetWorkspace();
        templates.value = data.templates || [];
        if (templates.value.length > 0) {
            const targetId = templates.value[0].id;
            currentTemplateId.value = null;
            await nextTick();
            currentTemplateId.value = targetId;
        } else {
            currentTemplateId.value = null;
            layoutComponents.value = [];
            globalSettings.value = { paperWidth: 794, paperHeight: 1123, calculationFormulas: '', groupingFieldIds: [], isPreviewLocked: false, structureScale: 100 };
        }
        activeView.value = globalSettings.value.isPreviewLocked ? 'preview' : 'edit';
    };

    // --- 业务逻辑 ---
    const cloudBackup = async () => {
        // [修改] 修复 Loading 调用方式，不使用 ElMessage.loading
        const loading = ElMessage({
            message: '校验云端授权...', // [UI微调] 修改提示文案
            type: 'info',
            icon: Loading,
            duration: 0
        });
        
        try {
            await checkUserStatus(); // 默认使用缓存校验，减少数据库压力
        } catch(e) {
            loading.close();
            ElMessage.error('校验失败，请检查网络');
            return;
        }
        loading.close();

        if (!userStatus.isActive) {
            // App.vue 会监听 isActive 变化自动切换界面，这里只做提示
            ElMessage.warning('您的授权已过期，请前往激活');
            return;
        }

        try {
            const userId = await bitable.bridge.getUserId();
            const currentUserName = userStatus.userName;
            const userAvatar = userStatus.avatar; // 获取头像 URL
            const themeColor = getAvatarColor(currentUserName);

            // [核心修复] 处理头像 URL: 强制 HTTPS + 添加时间戳防缓存
            const safeAvatarUrl = userAvatar ? (
                userAvatar.replace('http://', 'https://') + 
                (userAvatar.includes('?') ? '&' : '?') + 't=' + Date.now()
            ) : '';

            // [UI 重构] 备份弹窗内容
            const messageVNode = h('div', { style: 'margin-bottom: 12px;' }, [
                // 1. 顶部 Header 区
                h('div', { 
                    style: 'display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px dashed #e0e0e0;' 
                }, [
                    h('div', { 
                        style: 'width: 48px; height: 48px; background: #e0f2fe; color: #1a73e8; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(26,115,232,0.15);' 
                    }, [
                        h(UploadFilled, { style: 'width: 24px; height: 24px;' })
                    ]),
                    h('div', { style: 'display: flex; flex-direction: column; gap: 4px;' }, [
                        h('span', { style: 'font-size: 18px; font-weight: 700; color: #1f2937; letter-spacing: -0.5px;' }, '新建云端备份'),
                        h('span', { style: 'font-size: 13px; color: #6b7280;' }, '将当前配置安全保存至云端')
                    ])
                ]),

                // 2. 作者信息卡片
                h('div', { 
                    style: `
                        position: relative; background: #f9fafb; border-radius: 12px; padding: 12px 16px;
                        display: flex; align-items: center; gap: 12px; border: 1px solid #f3f4f6; margin-bottom: 20px;
                    ` 
                }, [
                    // 头像
                    userAvatar 
                        ? h('img', { 
                            src: safeAvatarUrl, 
                            referrerpolicy: 'no-referrer', 
                            style: 'width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.05);' 
                        })
                        : h('div', { style: `width: 36px; height: 36px; background: ${themeColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; border: 2px solid #fff;` }, currentUserName.charAt(0).toUpperCase()),
                    
                    // 信息
                    h('div', { style: 'display: flex; flex-direction: column;' }, [
                        h('span', { style: 'font-size: 10px; color: #9ca3af; font-weight: 700; text-transform: uppercase;' }, 'AUTHOR'),
                        h('span', { style: 'font-size: 14px; font-weight: 600; color: #374151;' }, currentUserName)
                    ])
                ]),

                // 3. 提示文案
                h('p', { style: 'font-size: 13px; color: #6b7280; margin: 0; line-height: 1.5; padding: 0 4px;' }, '推荐输入版本号或功能备注，方便日后识别。留空则自动使用时间戳。')
            ]);

            const { value: alias } = await ElMessageBox.prompt(messageVNode, '', { 
                confirmButtonText: '立即备份', cancelButtonText: '取消', 
                inputPlaceholder: '例如：v1.0 初始版本',
                closeOnClickModal: false, customClass: 'modern-backup-dialog', roundButton: true,
                showClose: false 
            });

            const res = await postRequest('createBackup', { user_id: userId, alias: alias || '', config_json: createBackupPayload() });
            if (res.status === 'success') ElMessage.success(`备份成功: ${res.alias}`);
            else throw new Error(res.message);
        } catch (e) { if (e !== 'cancel') ElMessage.error(e.message || '备份失败'); }
    };

    const exportConfig = () => {
        try {
            const blob = new Blob([JSON.stringify(createBackupPayload(), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url;
            
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const timeStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
            
            link.download = `backup-${timeStr}.json`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
            ElMessage.success('导出成功');
        } catch (e) { ElMessage.error('导出失败'); }
    };
    
    const importConfig = () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (!data || !Array.isArray(data.templates)) throw new Error('Format error');
                    ElMessageBox.confirm('覆盖当前配置？', '恢复', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
                        .then(() => { applyImportedData(data); ElMessage.success('恢复成功'); });
                } catch { ElMessage.error('文件格式错误'); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const getCloudBackups = async (type = 'private', search = '', sort = 'DESC') => {
        try {
            const userId = await bitable.bridge.getUserId();
            const action = type === 'public' ? 'getPublicBackups' : 'getBackupList';
            const query = new URLSearchParams({ action, user_id: userId, search, sort, t: Date.now() });
            const res = await fetch(`${API_BASE_URL}?${query.toString()}`);
            if (!res.ok) throw new Error('Network error');
            const json = await res.json();
            return json.status === 'success' ? json.data : [];
        } catch (e) { ElMessage.error('列表加载失败'); return []; }
    };

    const restoreCloudBackupById = async (id, source = 'private') => {
        try {
            const query = new URLSearchParams({ action: 'getBackupContent', id, source, t: Date.now() });
            const res = await fetch(`${API_BASE_URL}?${query.toString()}`);
            if (!res.ok) throw new Error('Network error');
            const json = await res.json();
            if (json.status === 'success') {
                const configData = typeof json.config_json === 'string' ? JSON.parse(json.config_json) : json.config_json;
                await applyImportedData(configData);
                ElMessage.success('配置已恢复');
                return true;
            } else throw new Error(json.message);
        } catch (e) { ElMessage.error('恢复失败: ' + e.message); return false; }
    };

    const deleteCloudBackupById = async (backupId) => {
        try {
            const userId = await bitable.bridge.getUserId();
            const res = await postRequest('deleteBackup', { user_id: userId, backup_id: backupId });
            if (res.status === 'success') { ElMessage.success('已删除'); return true; }
            else throw new Error(res.message);
        } catch (e) { ElMessage.error('删除失败: ' + e.message); return false; }
    };

    const publishCloudBackup = async (backupId) => {
        try {
            const { value: desc } = await ElMessageBox.prompt('请输入公开描述', '发布到公共库', { confirmButtonText: '发布', cancelButtonText: '取消', inputValidator: (v) => !v ? '描述不能为空' : true });
            const userId = await bitable.bridge.getUserId();
            const res = await postRequest('publishBackup', { user_id: userId, backup_id: backupId, description: desc });
            if (res.status === 'success') { ElMessage.success('发布成功'); return true; } else throw new Error(res.message);
        } catch (e) { if (e !== 'cancel') ElMessage.error('发布失败: ' + e.message); return false; }
    };

    const unpublishCloudBackup = async (backupId) => {
        try {
            await ElMessageBox.confirm('确定取消公开吗？', '取消公开', { type: 'warning' });
            const userId = await bitable.bridge.getUserId();
            const res = await postRequest('unpublishBackup', { user_id: userId, backup_id: backupId });
            if (res.status === 'success') { ElMessage.success('已取消公开'); return true; } else throw new Error(res.message);
        } catch (e) { if (e !== 'cancel') ElMessage.error('操作失败: ' + e.message); return false; }
    };

    return { 
        exportConfig, importConfig, cloudBackup, getCloudBackups, 
        restoreCloudBackupById, deleteCloudBackupById, publishCloudBackup, unpublishCloudBackup,
        checkUserStatus, registerUser, activatePlugin, uploadAvatarToCloud
    };
}