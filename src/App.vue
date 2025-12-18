<script setup>
import { onMounted, onUnmounted, ref, computed, watch, reactive } from 'vue';
import TopToolbar from './components/TopToolbar.vue';
import Workspace from './components/Workspace.vue';
import BottomPanel from './components/BottomPanel.vue';
import { 
    User, Key, WarningFilled, Trophy, Timer, MagicStick, Right, Lock, 
    Camera, Link as IconLink, Close, Loading, StarFilled, Clock, 
    Calendar, Moon, Sunny, Medal, Stopwatch 
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

import { useHistory } from './composables/useHistory';
import { useCanvas } from './composables/useCanvas';
import { useData } from './composables/useData';
import { useConfig, userStatus, uploadAvatarToCloud } from './composables/useConfig'; 

import './assets/main.css';

const { handleHistoryKeydown, saveState } = useHistory();
const { exitDrawMode } = useCanvas();
const { initData } = useData();
const { checkUserStatus, registerUser, activatePlugin } = useConfig();

const appLoading = ref(true);
const activationStep = ref('register');
const inputName = ref('');
const inputCode = ref('');
const isSubmitting = ref(false);

// Avatar Logic
const avatarMode = ref('file'); 
const avatarUrl = ref('');
const uploadedAvatarUrl = ref('');
const showAvatarInput = ref(false); 
const isUploadingAvatar = ref(false);

// 倒计时逻辑
const timeLeft = ref('');
let timerInterval = null;

const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    
    // 如果是永久会员，不需要显示具体倒计时
    if (userStatus.isForever) {
        timeLeft.value = '∞';
        return;
    }
    // 如果没有过期时间，也不显示
    if (!userStatus.expirationTime) {
        timeLeft.value = '';
        return;
    }
    
    const update = () => {
        const now = new Date();
        const expStr = userStatus.expirationTime.replace(/-/g, '/');
        const exp = new Date(expStr);
        const diff = exp - now;
        
        if (diff <= 0) {
            timeLeft.value = '已过期';
            clearInterval(timerInterval);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');

        if (d > 0) {
            timeLeft.value = `${d}天 ${hh}:${mm}:${ss}`;
        } else {
            timeLeft.value = `${hh}:${mm}:${ss}`;
        }
    };
    
    update();
    timerInterval = setInterval(update, 1000);
};

onMounted(async () => {
  await initData();
  await checkUserStatus();
  
  if (userStatus.isRegistered) {
      if (!userStatus.isActive) {
          activationStep.value = 'activate';
      } else {
          startTimer();
      }
  } else {
      activationStep.value = 'register';
  }
  
  appLoading.value = false;
  saveState(); 
  
  window.addEventListener('keydown', handleHistoryKeydown);
  window.addEventListener('keydown', (e) => { if(e.key === 'Escape') exitDrawMode(); });
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleHistoryKeydown);
    if (timerInterval) clearInterval(timerInterval);
});

// 监听用户激活状态
watch(() => userStatus.isActive, (active) => {
    if (!active && userStatus.isRegistered) {
        activationStep.value = 'activate';
    } else if (active) {
        startTimer();
    }
});

// 处理头像文件上传
const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; 
    if (file.size > 1024 * 5120) return ElMessage.warning('图片大小请小于 5MB'); 
    isUploadingAvatar.value = true;
    const loadingInstance = ElMessage({ message: '正在上传头像...', type: 'info', icon: Loading, duration: 0 });
    try {
        const url = await uploadAvatarToCloud(file);
        uploadedAvatarUrl.value = url;
        avatarMode.value = 'file';
        loadingInstance.close();
        ElMessage.success('头像设置成功');
    } catch (err) { 
        loadingInstance.close();
        ElMessage.error(err.message === 'Failed to fetch' ? '网络请求失败，请检查网络' : (err.message || '上传失败')); 
    } finally {
        isUploadingAvatar.value = false;
    }
};

const toggleAvatarMode = () => {
    showAvatarInput.value = !showAvatarInput.value;
    if (showAvatarInput.value) avatarMode.value = 'url';
    else avatarMode.value = 'file';
};

const finalAvatar = computed(() => {
    if (avatarMode.value === 'file') return uploadedAvatarUrl.value;
    return avatarUrl.value;
});

const handleRegister = async () => {
    if (!inputName.value || inputName.value.length < 2) return ElMessage.warning('用户名至少 2 个字符');
    isSubmitting.value = true;
    try {
        await registerUser(inputName.value, finalAvatar.value);
        activationStep.value = 'activate'; 
        userStatus.isRegistered = true; 
        userStatus.isActive = false;    
        ElMessage.success('注册成功，请激活');
    } catch (e) { ElMessage.error(e.message); }
    isSubmitting.value = false;
};

const handleActivate = async () => {
    if (!inputCode.value) return ElMessage.warning('请输入激活码');
    isSubmitting.value = true;
    try {
        await activatePlugin(inputCode.value);
    } catch (e) { ElMessage.error(e.message); }
    isSubmitting.value = false;
};

// [UI核心重构] 主题配置计算
const themeConfig = computed(() => {
    // 1. 至尊逻辑：永久会员
    if (userStatus.isForever) {
        return { 
            class: 'theme-forever', 
            label: 'MAX', 
            subLabel: '至尊永久',
            icon: Trophy 
        };
    }

    // 2. 获取类型
    const type = userStatus.activationType || 'trial';

    // 3. 兜底逻辑
    if (userStatus.isActive && (!type || type === 'trial')) {
        return { 
            class: 'theme-month', 
            label: 'PRO', 
            subLabel: '尊享会员',
            icon: Moon 
        };
    }

    // 4. 样式映射表
    const configMap = {
        hour: { 
            class: 'theme-hour', 
            label: 'LITE', 
            subLabel: '极速体验',
            icon: Stopwatch 
        },
        day: { 
            class: 'theme-day', 
            label: 'DAY', 
            subLabel: '日卡会员',
            icon: Sunny 
        },
        week: { 
            class: 'theme-week', 
            label: 'WEEK', 
            subLabel: '周卡会员',
            icon: Calendar 
        },
        month: { 
            class: 'theme-month', 
            label: 'PLUS', 
            subLabel: '月卡尊享',
            icon: Moon 
        },
        year: { 
            class: 'theme-year', 
            label: 'PRO', 
            subLabel: '年卡贵宾',
            icon: Medal 
        },
        forever: { 
            class: 'theme-forever', 
            label: 'MAX', 
            subLabel: '至尊永久',
            icon: Trophy 
        },
        trial: { 
            class: 'theme-trial', 
            label: 'TRIAL', 
            subLabel: '试用中',
            icon: Clock 
        }
    };

    return configMap[type] || configMap.trial;
});

const expirationDisplay = computed(() => {
    if (!userStatus.isActive) return 'EXPIRED';
    if (userStatus.isForever) return '∞';
    return userStatus.expirationTime ? userStatus.expirationTime.split(' ')[0] : '--';
});
</script>

<template>
  <div class="app-layout" v-loading="appLoading">
    
    <!-- 1. 正常功能界面 -->
    <template v-if="userStatus.isActive">
        <TopToolbar />
        <Workspace />
        <BottomPanel />
        
        <!-- [UI重构] 灵动光珠 (Smart Orb) -->
        <div class="status-orb-container" :class="themeConfig.class">
            <div class="orb-capsule">
                
                <!-- [修复] 永久卡专属：展开时的扫光特效 -->
                <div v-if="userStatus.isForever" class="shine-scan"></div>

                <!-- 核心光珠区：悬浮的能量球 -->
                <div class="orb-core">
                    
                    <!-- [修复] 永久卡专属：星球环绕 -->
                    <div v-if="userStatus.isForever" class="satellite-ring pulsing-ring">
                        <div class="satellite-body"></div>
                        <!-- 闲置时的气泡 -->
                        <div class="idle-bubble b1"></div>
                        <div class="idle-bubble b2"></div>
                    </div>

                    <!-- 动态呼吸波纹 (Ripple) -->
                    <div class="ripple-ring ring-1"></div>
                    <div class="ripple-ring ring-2"></div>
                    <div class="ripple-ring ring-3"></div>
                    
                    <!-- 永久卡专属：全息流光特效 -->
                    <div v-if="userStatus.isForever" class="holographic-glow"></div>

                    <div class="avatar-mask">
                        <img v-if="userStatus.avatar" :src="userStatus.avatar" class="orb-avatar-img" referrerpolicy="no-referrer" />
                        <el-icon v-else class="core-icon">
                            <component :is="themeConfig.icon" />
                        </el-icon>
                    </div>
                </div>
                
                <!-- 展开信息区 -->
                <div class="orb-content">
                    <div class="info-layout">
                        <!-- 上层：用户信息 + 身份标签 -->
                        <div class="info-top">
                            <span class="user-name">{{ userStatus.userName }}</span>
                            <!-- 标签胶囊 -->
                            <div class="badge-capsule">
                                <span class="badge-text">{{ themeConfig.label }}</span>
                            </div>
                        </div>
                        
                        <!-- 下层：状态 + 倒计时 -->
                        <div class="info-bottom">
                            <div class="status-dot-pulse"></div>
                            <span class="expiry-text">
                                <span v-if="userStatus.isForever" class="forever-text">尊享 · 无限期</span>
                                <span v-else class="countdown-nums">{{ timeLeft || expirationDisplay }}</span>
                            </span>
                        </div>
                    </div>
                    
                    <!-- 装饰背景 -->
                    <div class="card-bg-decoration"></div>
                </div>
            </div>
        </div>
    </template>

    <!-- 2. 注册/激活 界面 -->
    <div v-else-if="!appLoading" class="activation-layer-modern">
        <div class="ambient-light light-1"></div>
        <div class="ambient-light light-2"></div>

        <div class="auth-card-glass" :class="{ 'mode-register': activationStep === 'register' }">
            <div v-if="activationStep === 'register'" class="auth-content fade-in-scale">
                <div class="visual-header">
                    <div class="avatar-uploader-wrapper">
                        <div class="avatar-preview" :class="{ 'has-img': !!finalAvatar, 'is-loading': isUploadingAvatar }">
                            <img v-if="finalAvatar && !isUploadingAvatar" :src="finalAvatar" referrerpolicy="no-referrer" />
                            <div v-if="isUploadingAvatar" class="loading-overlay">
                                <el-icon class="is-loading spin-icon"><Loading /></el-icon>
                                <span class="loading-text">上传中</span>
                            </div>
                            <el-icon v-else-if="!finalAvatar" class="default-icon"><User /></el-icon>
                            <label class="upload-mask" v-if="!isUploadingAvatar">
                                <input type="file" accept="image/*" class="hidden-input" @change="handleAvatarFileChange" />
                                <el-icon><Camera /></el-icon>
                            </label>
                        </div>
                        <div class="toggle-link-btn" @click="toggleAvatarMode" :title="showAvatarInput ? '上传本地' : '使用链接'">
                            <el-icon><component :is="showAvatarInput ? 'Close' : 'IconLink'" /></el-icon>
                        </div>
                    </div>
                    <div class="url-input-box" :class="{ show: showAvatarInput }">
                        <input v-model="avatarUrl" placeholder="粘贴头像链接 HTTPS://" />
                    </div>
                    <h2 class="title-text mt-3">开启创作之旅</h2>
                    <p class="subtitle-text">设置您的专属形象与 ID</p>
                </div>
                <div class="form-area">
                    <div class="input-capsule">
                        <div class="icon-slot"><el-icon><MagicStick /></el-icon></div>
                        <input v-model="inputName" type="text" placeholder="给自己起个响亮的名字" @keyup.enter="handleRegister"/>
                    </div>
                    <button class="submit-btn-modern" @click="handleRegister" :disabled="isSubmitting">
                        <span v-if="!isSubmitting">下一步 <el-icon><Right /></el-icon></span>
                        <span v-else class="loading-dots">校验注册中...</span>
                    </button>
                </div>
            </div>

            <div v-else class="auth-content fade-in-scale">
                <div class="user-profile-pill">
                    <div class="avatar-ring">
                        <img v-if="userStatus.avatar" :src="userStatus.avatar" class="real-avatar" referrerpolicy="no-referrer" />
                        <span v-else class="char">{{ userStatus.userName.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="profile-meta">
                        <span class="label">当前账号</span>
                        <span class="value">{{ userStatus.userName }}</span>
                    </div>
                    <div class="status-tag" v-if="userStatus.expirationTime">已过期</div>
                </div>
                <div class="visual-header compact">
                    <h2 class="title-text">解锁完整功能</h2>
                    <p class="subtitle-text">请输入激活码以继续使用高级打印功能</p>
                </div>
                <div class="form-area">
                    <div class="input-capsule key-mode">
                        <div class="icon-slot"><el-icon><Key /></el-icon></div>
                        <input v-model="inputCode" type="text" placeholder="粘贴您的激活码" @keyup.enter="handleActivate"/>
                    </div>
                    <button class="submit-btn-modern primary-gradient" @click="handleActivate" :disabled="isSubmitting">
                        <span v-if="!isSubmitting"><el-icon><Lock /></el-icon> 立即激活</span>
                        <span v-else class="loading-dots">验证中...</span>
                    </button>
                </div>
                <div class="helper-row">
                    <span class="link-text"><el-icon><WarningFilled /></el-icon> 如何获取激活码?</span>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout { 
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    display: flex; flex-direction: column; background: #e0e0e0; 
    overflow: hidden; user-select: none; 
}

/* =========================================
   [Design System] 灵动光珠体系 v6.0
   ========================================= */
.status-orb-container {
    position: absolute; top: 60px; right: 20px; z-index: 500;
    pointer-events: auto; font-family: 'Inter', system-ui, sans-serif;
    perspective: 1200px;
}

/* --- 主题变量定义 --- */
.theme-hour { --orb-bg: rgba(240, 253, 250, 0.9); --orb-border: rgba(153, 246, 228, 0.8); --accent: #0d9488; --glow: rgba(45, 212, 191, 0.6); --text-main: #115e59; --text-sub: #14b8a6; --card-grad: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); }
.theme-day { --orb-bg: rgba(240, 253, 244, 0.9); --orb-border: rgba(134, 239, 172, 0.8); --accent: #16a34a; --glow: rgba(74, 222, 128, 0.6); --text-main: #14532d; --text-sub: #4ade80; --card-grad: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); }
.theme-week { --orb-bg: rgba(239, 246, 255, 0.9); --orb-border: rgba(147, 197, 253, 0.8); --accent: #2563eb; --glow: rgba(96, 165, 250, 0.6); --text-main: #1e3a8a; --text-sub: #3b82f6; --card-grad: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
.theme-month { --orb-bg: rgba(238, 242, 255, 0.95); --orb-border: rgba(165, 180, 252, 0.8); --accent: #4f46e5; --glow: rgba(129, 140, 248, 0.6); --text-main: #312e81; --text-sub: #818cf8; --card-grad: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); }
.theme-year { --orb-bg: rgba(250, 245, 255, 0.95); --orb-border: rgba(216, 180, 254, 0.8); --accent: #9333ea; --glow: rgba(192, 132, 252, 0.6); --text-main: #581c87; --text-sub: #a855f7; --card-grad: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); }

.theme-forever { 
    --orb-bg: rgba(255, 255, 255, 0.95);
    --orb-border: rgba(255, 255, 255, 0.9);
    --orb-shadow: rgba(0, 0, 0, 0.1);
    --text-main: #1e293b;
    --text-sub: #64748b;
    --accent: #f59e0b; 
    --glow: rgba(251, 191, 36, 0.5);
    --card-grad: linear-gradient(135deg, #ffffff 0%, #fefce8 100%);
}

.orb-capsule {
    display: flex; align-items: center;
    background: var(--orb-bg);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid var(--orb-border);
    border-radius: 36px; 
    padding: 4px;
    box-shadow: 0 4px 20px var(--orb-shadow, rgba(0,0,0,0.06)), inset 0 0 0 1px rgba(255, 255, 255, 0.6);
    height: 48px;
    max-width: 48px;
    overflow: hidden; /* 这里会裁切掉溢出的内容，所以卫星轨道必须足够小才能看见 */
    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
    cursor: default;
    position: relative;
    z-index: 10;
    /* [修复] 显式居中，确保所有会员卡类型在闲置时头像都位于圆心 */
    justify-content: center;
}

.theme-forever .orb-capsule {
    border: 2px solid transparent;
    background-image: linear-gradient(white, white), conic-gradient(from 0deg, #f59e0b, #ec4899, #3b82f6, #f59e0b);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15), inset 0 0 20px rgba(255,255,255,0.8);
    padding: 2px;
    justify-content: center;
    transition: 
        max-width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), 
        padding-right 0.6s ease,
        /* [修复] 增加 padding-left 的过渡效果，解决展开时的遮挡问题 */
        padding-left 0.6s ease,
        transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.4s ease;
    transform-style: preserve-3d; 
}

.theme-forever .orb-capsule:hover {
    max-width: 300px; 
    justify-content: flex-start;
    padding-right: 12px;
    /* [修复] 展开后增加左侧内边距，防止头像被左侧圆角裁切遮挡 */
    padding-left: 8px;
    background: var(--orb-bg);
    box-shadow: 
        0 20px 60px rgba(245, 158, 11, 0.5), 
        0 0 0 2px rgba(255,255,255,0.95), 
        inset 0 0 20px rgba(255,255,255,0.7);
    transform: translateY(-6px) scale(1.08) rotateX(10deg);
}

/* [修复] 扫光特效 */
.shine-scan {
    position: absolute; top: 0; left: -120%; width: 50%; height: 100%;
    /* 增强了不透明度，确保可见 */
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
    transform: skewX(-20deg); pointer-events: none; 
    /* 提高层级，防止被背景遮挡 */
    z-index: 50; 
    opacity: 0;
}
.theme-forever .orb-capsule:hover .shine-scan {
    opacity: 1;
    /* 增加少许延迟，等待胶囊展开一点后再掠过，视觉更自然 */
    animation: scan-right 0.7s ease-out 0.1s forwards;
}
@keyframes scan-right { 0% { left: -50%; } 100% { left: 180%; } }

.orb-capsule:hover {
    width: auto; 
    max-width: 300px;
    padding-right: 24px;
    background: var(--orb-bg);
    box-shadow: 0 16px 48px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.8);
    transform: translateY(-2px) scale(1.02);
    /* [修复] 展开时恢复左对齐，确保头像固定在左侧 */
    justify-content: flex-start;
}

.orb-core {
    width: 40px; height: 40px;
    position: relative; flex-shrink: 0; z-index: 10;
    display: flex; align-items: center; justify-content: center;
}

/* [修复] 星球环绕效果 */
.satellite-ring {
    position: absolute; top: 50%; left: 50%; 
    /* 尺寸调整：idle状态下必须小于胶囊高度(48px)，否则被overflow:hidden裁切 */
    width: 44px; height: 44px;
    transform: translate(-50%, -50%); pointer-events: none; z-index: 0;
    border: 1px dashed rgba(245, 158, 11, 0.4); /* 增加可见度 */
    border-radius: 50%;
    /* 默认慢速旋转 */
    animation: orbit-spin 8s linear infinite;
    transition: all 0.5s ease;
    display: block; /* 确保显示 */
}

/* [新增] 增强的呼吸闪动动画，仅在未悬停时生效 */
.theme-forever .pulsing-ring:not(:hover) {
    animation: orbit-spin 8s linear infinite, ring-glow-pulse 3s ease-in-out infinite;
}

@keyframes ring-glow-pulse {
    0%, 100% { 
        box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.1); 
        border-color: rgba(245, 158, 11, 0.3);
    }
    50% { 
        box-shadow: 0 0 12px 2px rgba(245, 158, 11, 0.4); 
        border-color: rgba(245, 158, 11, 0.8);
    }
}

.theme-forever .orb-capsule:hover .satellite-ring {
    border-color: rgba(245, 158, 11, 0.7);
    /* 展开时稍微变大一点点，但不能太大以免被切掉 */
    width: 46px; height: 46px; 
    /* 展开后加速 */
    animation-duration: 2s; 
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
}
.satellite-body {
    position: absolute; top: -2px; left: 50%; width: 5px; height: 5px;
    background: #f59e0b; border-radius: 50%;
    box-shadow: 0 0 6px #f59e0b;
}
/* 闲置气泡 */
.idle-bubble {
    position: absolute; background: #fbbf24; border-radius: 50%; opacity: 0;
    animation: bubble-float 3s infinite ease-in;
}
.b1 { width: 4px; height: 4px; top: 20%; right: -5px; animation-delay: 0s; }
.b2 { width: 3px; height: 3px; top: 70%; right: -2px; animation-delay: 1.5s; }

.theme-forever .orb-capsule:hover .idle-bubble { display: none; } /* 展开时隐藏气泡 */

@keyframes bubble-float {
    0% { transform: translateY(0) scale(0); opacity: 0; }
    50% { opacity: 0.8; }
    100% { transform: translateY(-15px) scale(1.2); opacity: 0; }
}
@keyframes orbit-spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }

.avatar-mask {
    width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: #fff;
    border: 2px solid #fff; 
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    transition: all 0.3s ease;
    z-index: 5;
    position: relative;
}

.theme-forever .avatar-mask {
    border: 2px solid #fbbf24;
    box-shadow: 0 0 15px rgba(251, 191, 36, 0.5);
}

.theme-forever .orb-capsule:hover .avatar-mask {
    transform: rotate(360deg) scale(1.15);
    transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    border-color: #fbbf24; 
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.6);
}

.orb-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.core-icon { font-size: 20px; color: var(--accent); }
.theme-forever .core-icon { 
    background: linear-gradient(135deg, #d97706, #fbbf24); 
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; 
}

/* 水波纹动画 */
.ripple-ring {
    position: absolute; top: 50%; left: 50%;
    width: 100%; height: 100%;
    transform: translate(-50%, -50%);
    border-radius: 50%; 
    background: transparent;
    opacity: 0; z-index: 1; pointer-events: none;
    box-shadow: 0 0 0 0 var(--glow);
}
.ring-1 { animation: ripple-spread 3s infinite cubic-bezier(0.25, 0.8, 0.25, 1); }
.ring-2 { animation: ripple-spread 3s infinite cubic-bezier(0.25, 0.8, 0.25, 1) 1s; } 
.ring-3 { animation: ripple-spread 3s infinite cubic-bezier(0.25, 0.8, 0.25, 1) 2s; } 

@keyframes ripple-spread {
    0% { box-shadow: 0 0 0 0 var(--glow); opacity: 0.8; }
    100% { box-shadow: 0 0 0 24px rgba(255,255,255,0); opacity: 0; }
}

.holographic-glow {
    position: absolute; inset: -20px;
    background: radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.3), transparent 70%);
    filter: blur(10px);
    animation: pulse-glow 3s infinite ease-in-out;
    pointer-events: none; z-index: 0;
}
@keyframes pulse-glow { 
    0%, 100% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.2); opacity: 0.8; }
}

.orb-content {
    max-width: 0; margin-left: 0; opacity: 0; 
    transform: translateX(-10px);
    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
    white-space: nowrap; overflow: hidden;
    position: relative; z-index: 5;
}

.orb-capsule:hover .orb-content {
    max-width: 200px; margin-left: 14px; opacity: 1; 
    transform: translateX(0); transition-delay: 0.05s;
}

.card-bg-decoration {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--card-grad);
    opacity: 0; transition: opacity 0.4s;
    pointer-events: none; z-index: -1;
}
.orb-capsule:hover .card-bg-decoration { opacity: 1; }

.theme-forever .card-bg-decoration {
    background: linear-gradient(120deg, rgba(255,255,255,0.8), rgba(254, 252, 232, 0.9), rgba(255,255,255,0.8));
    background-size: 200% 200%;
    animation: gradient-shift 3s ease infinite;
}
@keyframes gradient-shift { 
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

.info-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }

.theme-forever .orb-content .info-top {
    transform: translateX(-30px); opacity: 0;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.theme-forever .orb-capsule:hover .orb-content .info-top {
    transform: translateX(0); opacity: 1; transition-delay: 0.15s; 
}

.user-name { font-size: 14px; font-weight: 700; color: var(--text-main); letter-spacing: -0.3px; }

@keyframes text-shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
}

.theme-forever .user-name {
    background: linear-gradient(to right, #b45309 0%, #f59e0b 50%, #b45309 100%);
    background-size: 200% auto;
    -webkit-background-clip: text; 
    -webkit-text-fill-color: transparent;
    font-weight: 800;
}

.theme-forever .orb-capsule:hover .user-name {
    animation: text-shimmer 2s linear infinite;
}

.badge-capsule {
    padding: 1px 7px; border-radius: 12px;
    background: rgba(255,255,255,0.6); color: var(--accent);
    font-size: 9px; font-weight: 800; letter-spacing: 0.5px;
    border: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.theme-forever .badge-capsule {
    background: linear-gradient(90deg, #fff 0%, #fff7ed 100%);
    border: 1px solid #fcd34d; 
    color: #d97706;
    box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
    /* [新增] 增加左边距，使标志往右移动一点，离名字更远 */
    margin-left: 6px;
}

.info-bottom { display: flex; align-items: center; gap: 6px; }

.theme-forever .orb-content .info-bottom {
    transform: translateX(-40px); opacity: 0;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.theme-forever .orb-capsule:hover .orb-content .info-bottom {
    transform: translateX(0); opacity: 1; transition-delay: 0.25s; 
}

.status-dot-pulse {
    width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
    box-shadow: 0 0 0 0 rgba(var(--accent), 0.6);
    animation: dot-beat 2s infinite;
}
.theme-forever .status-dot-pulse { 
    background: #f59e0b; 
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); 
    animation: dot-beat 1.5s infinite;
}

@keyframes dot-beat {
    0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(var(--accent), 0.6); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(var(--accent), 0); }
    100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(var(--accent), 0); }
}

.expiry-text { 
    font-family: 'Roboto Mono', monospace; 
    font-size: 11px; font-weight: 600; color: var(--text-main); opacity: 0.8;
}
.theme-forever .expiry-text { 
    color: #b45309; font-weight: 700; opacity: 1; 
    text-shadow: 0 1px 1px rgba(255,255,255,0.8);
}
.countdown-nums { font-variant-numeric: tabular-nums; }

/* 试用状态 fallback */
.theme-trial { --orb-bg: #fff; --accent: #94a3b8; --glow: #cbd5e1; --text-main: #64748b; --card-grad: #f8fafc; }

/* --- Activation UI --- */
.activation-layer-modern { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; z-index: 9999; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.ambient-light { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.6; animation: float-light 10s ease-in-out infinite; }
.light-1 { width: 400px; height: 400px; background: #e0f2fe; top: -100px; left: -100px; }
.light-2 { width: 300px; height: 300px; background: #f0f9ff; bottom: -50px; right: -50px; animation-delay: -5s; }
@keyframes float-light { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 30px); } }

.auth-card-glass { position: relative; z-index: 10; width: 360px; padding: 40px 32px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02), inset 0 0 0 1px rgba(255, 255, 255, 0.5); transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
.auth-card-glass.mode-register { border-top: 4px solid #3b82f6; }
.fade-in-scale { animation: fadeScale 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeScale { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.avatar-uploader-wrapper { position: relative; width: 80px; height: 80px; margin: 0 auto 12px; }
.avatar-preview { width: 100%; height: 100%; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #94a3b8; overflow: hidden; position: relative; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: all 0.3s; }
.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.avatar-preview.is-loading { border-color: #3b82f6; }

.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #3b82f6; font-size: 10px; font-weight: 600; }
.spin-icon { font-size: 20px; margin-bottom: 2px; }

.upload-mask { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; opacity: 0; transition: opacity 0.2s; cursor: pointer; z-index: 5; }
.avatar-preview:hover .upload-mask { opacity: 1; }
.hidden-input { position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer; left: 0; top: 0; z-index: 20; }

.toggle-link-btn { position: absolute; bottom: 0; right: -4px; width: 24px; height: 24px; background: #3b82f6; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3); font-size: 12px; transition: transform 0.2s; z-index: 25; }
.toggle-link-btn:hover { transform: scale(1.1); }

.url-input-box { max-height: 0; overflow: hidden; transition: all 0.3s ease; opacity: 0; margin-bottom: 0; }
.url-input-box.show { max-height: 40px; opacity: 1; margin-bottom: 12px; }
.url-input-box input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 12px; outline: none; background: rgba(255,255,255,0.8); }
.url-input-box input:focus { border-color: #3b82f6; }

.visual-header { text-align: center; margin-bottom: 32px; }
.visual-header.compact { margin-bottom: 24px; text-align: left; }
.title-text { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 8px; letter-spacing: -0.5px; }
.subtitle-text { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }
.mt-3 { margin-top: 12px; }

.user-profile-pill { display: flex; align-items: center; gap: 12px; background: #f1f5f9; border-radius: 16px; padding: 6px 16px 6px 6px; margin-bottom: 32px; border: 1px solid rgba(255,255,255,0.5); }
.avatar-ring { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3); overflow: hidden; }
.real-avatar { width: 100%; height: 100%; object-fit: cover; }
.profile-meta { display: flex; flex-direction: column; flex: 1; }
.profile-meta .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.profile-meta .value { font-size: 14px; font-weight: 600; color: #334155; }
.status-tag { font-size: 10px; padding: 2px 6px; background: #fee2e2; color: #ef4444; border-radius: 6px; font-weight: 600; }

.form-area { display: flex; flex-direction: column; gap: 16px; }
.input-capsule { display: flex; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 4px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.01); }
.input-capsule:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); transform: translateY(-1px); }
.input-capsule.key-mode:focus-within { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }
.icon-slot { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 18px; border-right: 1px solid #f1f5f9; }
.input-capsule input { border: none; outline: none; background: transparent; padding: 0 12px; font-size: 14px; color: #334155; width: 100%; height: 36px; font-weight: 500; }
.input-capsule input::placeholder { color: #cbd5e1; font-weight: 400; }

.submit-btn-modern { width: 100%; height: 44px; border: none; border-radius: 12px; background: #1e293b; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; position: relative; overflow: hidden; }
.submit-btn-modern:hover { background: #0f172a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15); }
.submit-btn-modern:active { transform: translateY(0); }
.submit-btn-modern:disabled { background: #cbd5e1; cursor: not-allowed; transform: none; box-shadow: none; }
.submit-btn-modern.primary-gradient { background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); }
.submit-btn-modern.primary-gradient:hover { box-shadow: 0 4px 16px rgba(79, 70, 229, 0.25); }
.loading-dots { font-size: 13px; opacity: 0.9; }

.helper-row { margin-top: 24px; text-align: center; }
.link-text { font-size: 12px; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: color 0.2s; padding: 4px 8px; border-radius: 6px; }
.link-text:hover { color: #4f46e5; background: #f5f3ff; }
</style>