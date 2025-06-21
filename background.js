// Day Progress Bar - Background Script

// IIFE防止全局变量泄漏
(async function() {
  'use strict';

  // 检查是否为开发模式（发布前修改为false）
  const DEVELOPMENT_MODE = true;

  // 详细日志控制
  const VERBOSE_LOGGING = DEVELOPMENT_MODE;

  // 调试日志函数
  function debugLog(...args) {
    if (VERBOSE_LOGGING) {
      console.log('[BACKGROUND]', ...args);
    }
  }

  /**
   * 安全地获取存储值
   * @param {string|array|object} keys - 要获取的键或键的集合
   * @param {object} defaultValue - 默认值
   * @returns {Promise<object>} 存储值
   */
  async function safeGetStorage(keys, defaultValue = {}) {
    try {
      return await chrome.storage.sync.get(keys);
    } catch (error) {
      console.error('获取存储错误:', error);
      return defaultValue;
    }
  }

  /**
   * 安全地设置存储值
   * @param {object} data - 要存储的数据
   */
  async function safeSetStorage(data) {
    try {
      await chrome.storage.sync.set(data);
      return true;
    } catch (error) {
      console.error('设置存储错误:', error);
      return false;
    }
  }

  /**
   * 安全的API调用包装
   * @param {Function} apiCall - 要执行的API调用函数
   * @param {*} fallbackValue - 失败时返回的值
   */
  async function safeApiCall(apiCall, fallbackValue) {
    try {
      return await apiCall();
    } catch (error) {
      console.error('API调用错误:', error);
      return fallbackValue;
    }
  }

  // 初始化扩展
  async function initializeExtension() {
    debugLog('初始化扩展...');

    // 检查是否需要设置默认工作时间
    const settings = await safeGetStorage(['startTime', 'endTime']);

    if (!settings.startTime || !settings.endTime) {
      debugLog('设置默认工作时间 08:00-16:00');
      await safeSetStorage({
        startTime: '08:00',
        endTime: '16:00'
      });
    }

    // 设置默认的进度条状态（如果不存在）
    const visibilitySettings = await safeGetStorage(['dayProgressBarHidden']);

    if (visibilitySettings.dayProgressBarHidden === undefined) {
      debugLog('设置默认进度条可见性: 显示');
      await safeSetStorage({
        dayProgressBarHidden: false
      });
    }
  }

  // 注册消息处理器
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 使用异步处理，但需要返回true以保持消息通道开放
    handleMessage(message, sender).then(sendResponse);
    return true;
  });

  // 异步消息处理函数
  async function handleMessage(message, sender) {
    debugLog('收到消息:', message);

    if (!message || !message.action) {
      return { error: 'Invalid message format' };
    }

    switch (message.action) {
      case 'updateProgressBarState':
        return await handleUpdateProgressBarState(message);

      case 'checkFeature':
        return await handleCheckFeature(message);

      case 'redirect-to-website':
        return await handleRedirect(message);

      default:
        debugLog('未知操作:', message.action);
        return { error: 'Unknown action' };
    }
  }

  // 处理进度条状态更新
  async function handleUpdateProgressBarState(message) {
    if (message.hidden !== undefined) {
      debugLog('更新进度条状态:', message.hidden ? '隐藏' : '显示');

      try {
        await safeSetStorage({
          dayProgressBarHidden: message.hidden
        });
        return { success: true };
      } catch (error) {
        debugLog('更新进度条状态失败:', error);
        return { error: error.message };
      }
    }

    return { error: 'Missing required parameter: hidden' };
  }

  // 处理功能检查
  async function handleCheckFeature(message) {
    if (!message.feature) {
      return { error: 'Missing feature parameter' };
    }

    // 简单功能检查实现
    switch (message.feature) {
      case 'countdown':
        // 在开发模式下总是启用倒计时功能
        return { enabled: true };

      default:
        return { enabled: false, error: 'Unknown feature' };
    }
  }

  // 处理重定向请求
  async function handleRedirect(message) {
    if (!message.url) {
      return { error: 'Missing URL parameter' };
    }

    try {
      await chrome.tabs.create({ url: message.url });
      return { success: true };
    } catch (error) {
      debugLog('创建标签页失败:', error);
      return { error: error.message };
    }
  }

  // 扩展启动时运行初始化
  try {
    await initializeExtension();
  } catch (error) {
    console.error('初始化扩展时出错:', error);
  }
})();

// 声明API函数变量
let apiModule;
try {
  // 尝试从api.js导入函数
  if (typeof importScripts === 'function') {
    importScripts('api.js');
    // 检查是否成功导入
    if (typeof self.DayProgressBarAPI !== 'undefined') {
      apiModule = self.DayProgressBarAPI;
      console.log('成功导入API函数');
    } else {
      console.error('DayProgressBarAPI 未定义');
    }
  }
} catch (e) {
  console.error('导入API函数失败:', e);
}

// Background script for handling subscription state

// Constants
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
};

// 用户状态相关常量
const USER_STATUS = {
  FREE: 'free',
  TRIAL: 'trial',
  PRO: 'pro'
};

// 存储进度条当前状态
let currentProgressBarState = {
  hidden: false
};

// 添加一个标志，用于防止处理过程中的重复更新
let isProcessingUpdate = false;

// Check subscription status
function checkSubscriptionStatus() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['subscription'], (result) => {
      const subscription = result.subscription || {
        status: STATUS.FREE,
        features: {
          countdown: false
        }
      };

      // Check if trial has expired
      if (subscription.status === STATUS.TRIAL) {
        const now = new Date();
        const trialEnds = new Date(subscription.trialEnds);

        if (now > trialEnds) {
          subscription.status = STATUS.EXPIRED;
          subscription.features.countdown = false;

          // Save the updated status
          chrome.storage.sync.set({ subscription });
        }
      }

      resolve(subscription);
    });
  });
}

// 在背景页初始化时从存储中加载进度条状态
function loadProgressBarState() {
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    if (result.hasOwnProperty('dayProgressBarHidden')) {
      currentProgressBarState.hidden = result.dayProgressBarHidden;
      console.log('从存储加载进度条状态:', currentProgressBarState);
    }
  });
}

// 更新进度条状态
function updateProgressBarState(hidden) {
  currentProgressBarState.hidden = hidden;
  console.log('更新进度条状态:', currentProgressBarState);

  // 同步保存到存储
  chrome.storage.sync.set({ dayProgressBarHidden: hidden });
}

// Check if a specific feature is enabled
async function isFeatureEnabled(featureName) {
  // 获取订阅状态
  const subscription = await checkSubscriptionStatus();

  // 检查特定功能是否已启用
  const isEnabled = subscription.features && subscription.features[featureName] === true;

  console.log(`功能 ${featureName} 检查结果:`, isEnabled ? '已启用' : '未启用', '订阅状态:', subscription.status);

  return isEnabled;
}

// 检查用户是否已登录
function checkUserLoginStatus() {
  return new Promise(resolve => {
    chrome.storage.local.get(['clerkToken', 'clerkUser'], (data) => {
      // 如果有token和用户数据，认为用户已登录
      const isLoggedIn = !!(data.clerkToken && data.clerkUser);
      console.log('用户登录状态检查:', isLoggedIn ? '已登录' : '未登录');
      resolve(isLoggedIn);
    });
  });
}

// Add context menu for subscription management
function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'manage-subscription',
    title: 'Manage Subscription',
    contexts: ['action']
  });
}

// Open backend home page when menu item clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'manage-subscription') {
    chrome.tabs.create({
      url: 'http://localhost:3000'
    });
  }
});

// 监听标签页创建事件，在新标签页完成加载后应用当前进度条状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 仅当标签页完成加载且URL是http或https时处理
  if (changeInfo.status === 'complete' && tab.url &&
      (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {

    console.log(`新标签页加载完成: ${tabId}, 应用进度条状态:`, currentProgressBarState);

    // 延迟一段时间，确保内容脚本已加载
    setTimeout(() => {
      // 首先检查内容脚本是否已加载
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
        if (chrome.runtime.lastError) {
          console.log(`标签页 ${tabId} 内容脚本未加载，正在注入...`);
          // 如果内容脚本未加载，注入内容脚本
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, function() {
            if (chrome.runtime.lastError) {
              // 改进错误处理 - 检查是否为受限页面
              const errorMsg = chrome.runtime.lastError.message || '';

              // 判断是否为常见的受限页面错误
              if (errorMsg.includes('cannot access') ||
                  errorMsg.includes('cannot be accessed') ||
                  errorMsg.includes('cannot run scripts') ||
                  errorMsg.includes('permission')) {
                console.log(`标签页 ${tabId} 是受限页面，无法注入内容脚本:`, errorMsg);
              } else {
                console.error(`无法向标签页 ${tabId} 注入内容脚本:`, errorMsg);
              }
            } else {
              // 脚本注入成功后，应用进度条状态
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, {
                  action: 'toggleProgressBar',
                  hidden: currentProgressBarState.hidden
                }, function(response) {
                  // 添加错误处理，防止消息发送失败
                  if (chrome.runtime.lastError) {
                    console.log(`向标签页 ${tabId} 发送消息失败:`, chrome.runtime.lastError.message);
                  }
                });
              }, 200);
            }
          });
        } else {
          // 内容脚本已加载，直接应用进度条状态
          chrome.tabs.sendMessage(tabId, {
            action: 'toggleProgressBar',
            hidden: currentProgressBarState.hidden
          });
        }
      });
    }, 500); // 延迟500ms确保页面完全加载
  }
});

// Listen for external messages (from web pages)
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    console.log('收到外部消息:', message);

    // 处理从dashboard.html页面接收的Clerk认证结果
    if (message.action === 'clerk-auth-success' || message.type === 'clerk-auth-success') {
      console.log('收到外部clerk-auth-success消息');

      const token = message.token;
      if (token) {
        // 检测是否为测试token
        const isTestToken = token === 'test_token_for_debugging';

        if (isTestToken) {
          console.log('检测到测试token，跳过API验证');

          // 创建一个测试用户
          const testUser = {
            id: 'test_user_id',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          };

          // 存储测试认证信息
          chrome.storage.local.set({
            clerkToken: token,
            clerkUser: JSON.stringify(testUser),
            authComplete: true,
            isTestMode: true
          }, () => {
            console.log('成功将测试认证信息存储到chrome.storage');
          });

          // 发送成功响应
          sendResponse({ success: true, isTestMode: true });
          return true;
        }

        // 处理真实token - 避免直接调用Clerk API
        console.log('处理真实token');

        // 从消息中提取用户信息
        let userObj;
        if (message.user && typeof message.user === 'object') {
          // 如果消息中已经包含user对象，直接使用
          userObj = message.user;
          console.log('使用消息中包含的用户信息:', userObj);
        } else {
          // 如果没有提供user对象，尝试通过我们自己的后端API验证token
          console.log('尝试通过自己的后端API验证token');

          // 创建一个基本的用户对象
          userObj = {
            id: 'id_from_token',
            email: 'user@example.com',
            firstName: '',
            lastName: ''
          };
        }

        // 存储认证信息
        chrome.storage.local.set({
          clerkToken: token,
          clerkUser: JSON.stringify(userObj),
          authComplete: true,
          isTestMode: false
        }, () => {
          console.log('成功将认证信息存储到chrome.storage');
        });

        sendResponse({ success: true });
        return true;
      }
    }

    // 处理新的auth-sync消息
    if (message.action === 'auth-sync') {
      console.log('收到auth-sync消息:', message);

      if (message.data && message.data.signedIn && message.data.token) {
        // 从消息中获取用户数据
        if (!message.data.user || !message.data.user.id) {
          console.error('错误: auth-sync消息中缺少有效的用户ID');
          sendResponse({ success: false, error: '缺少有效的用户ID' });
          return true;
        }

        const userData = message.data.user;

        // 记录详细的用户ID信息以便调试
        console.log('接收到的Clerk用户ID:', userData.id);
        console.log('完整用户数据:', userData);

        // 存储认证信息
        chrome.storage.local.set({
          clerkToken: message.data.token,
          clerkUser: JSON.stringify(userData),
          authComplete: true,
          authSyncComplete: true
        }, () => {
          console.log('成功通过auth-sync存储认证信息');

          // 直接从userData中获取isPro状态并更新subscription状态
          const isPro = !!userData.isPro; // 确保转换为布尔值
          console.log('从NextJS接收到的Pro状态:', isPro);

          // 更新subscription状态
          chrome.storage.sync.set({
            subscription: {
              status: isPro ? 'pro' : 'free',
              features: {
                countdown: isPro // Pro用户启用countdown功能
              }
            },
            subscriptionSource: 'nextjs-sync' // 添加来源标记，便于调试
          }, () => {
            console.log('已根据NextJS传递的isPro字段更新subscription状态:', isPro ? 'pro' : 'free');
          });

          // 通知popup页面更新
          chrome.runtime.sendMessage({
            action: 'auth-state-changed',
            isAuthenticated: true
          }).catch(err => {
            // 忽略错误，popup可能没有打开
            console.log('通知popup时出现错误 (可忽略):', err);
          });
        });

        sendResponse({ success: true });
        return true;
      } else {
        console.log('auth-sync消息缺少必要数据');
        sendResponse({ success: false, error: 'Missing required auth data' });
        return true;
      }
    }

    return false;
  }
);

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("扩展已安装，添加监听器监听来自网页的消息");

  // 加载进度条状态
  loadProgressBarState();

  // 添加内容脚本，用于接收网页中的postMessage消息
  chrome.scripting.registerContentScripts([{
    id: 'clerk-message-listener',
    matches: [
      'http://localhost:3000/*',  // 本地测试环境
      'http://localhost/*',       // 本地部署环境（默认80端口）
      'http://127.0.0.1/*',       // 本地部署环境 - 另一种表示方式
      'http://localhost:5000/*',  // 另一个常用的Node服务器端口
      'http://localhost:8080/*',  // 另一个常用的开发端口
      'http://localhost:8000/*'   // 另一个常用的开发端口
    ],
    js: ['content-message-bridge.js'],
    runAt: 'document_idle'
  }])
  .catch(err => console.error('注册内容脚本失败:', err));

  // Check if permissions exist for context menus
  if (chrome.contextMenus) {
    setupContextMenu();
  }

  // Initialize subscription status if not set
  checkSubscriptionStatus();
});

// 监听存储变化，当dayProgressBarHidden状态改变时，广播到所有标签页
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.dayProgressBarHidden) {
    console.log('检测到进度条隐藏状态变化:', changes.dayProgressBarHidden);

    // 获取新的状态
    const newHiddenState = changes.dayProgressBarHidden.newValue;

    // 只有当状态实际发生变化时才更新和广播
    // 这可以防止无限循环
    if (currentProgressBarState.hidden !== newHiddenState) {
      console.log('进度条状态已改变，从', currentProgressBarState.hidden, '变为', newHiddenState);

      // 更新本地状态缓存，但不触发另一个存储更新
      currentProgressBarState.hidden = newHiddenState;

      // 广播到所有标签页，但使用延迟确保不会造成死锁
      setTimeout(() => {
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            // 只发送到http/https页面
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'toggleProgressBar',
                hidden: newHiddenState,
                // 添加源标识，防止接收方再次触发更新
                fromStorageChange: true
              }, function() {
                // 使用chrome.runtime.lastError检查错误
                if (chrome.runtime.lastError) {
                  // 忽略错误，某些标签页可能没有内容脚本
                  console.log(`向标签页 ${tab.id} 发送进度条状态变更消息失败 (可忽略):`, chrome.runtime.lastError.message);
                }
              });
            }
          });
        });
      }, 50); // 短暂延迟，避免阻塞主线程
    } else {
      console.log('进度条状态未变化，跳过广播');
    }
  }
});

// 获取当前用户状态
async function getUserStatus() {
  try {
    const userData = await new Promise((resolve) => {
      chrome.storage.sync.get(['userData', 'trialData', 'licenseData'], (result) => {
        resolve(result);
      });
    });

    // 检查是否有有效的许可证
    if (userData.licenseData && userData.licenseData.isActive) {
      console.log('从本地存储找到有效许可证');
      return {
        isPro: true,
        licenseKey: userData.licenseData.licenseKey
      };
    }

    // 检查本地存储的试用状态
    if (userData.trialData) {
      const trialStartTime = userData.trialData.startTime;
      const currentTime = Date.now();
      const trialEndTime = trialStartTime + (60 * 60 * 1000); // 1小时(毫秒)

      if (currentTime < trialEndTime) {
        return {
          isPro: false,
          isTrialActive: true,
          trialStartTime: trialStartTime,
          trialEndTime: trialEndTime
        };
      }
    }

    // 获取认证状态，检查是否为新用户
    const authData = await new Promise((resolve) => {
      chrome.storage.local.get(['clerkUser', 'authComplete'], (result) => {
        resolve(result);
      });
    });

    // 如果是新用户且没有试用记录，自动开始试用
    if (authData.clerkUser && authData.authComplete) {
      let clerkUser;
      try {
        clerkUser = typeof authData.clerkUser === 'string' ?
          JSON.parse(authData.clerkUser) : authData.clerkUser;
      } catch (e) {
        console.error('解析用户数据失败:', e);
        clerkUser = authData.clerkUser;
      }

      if (clerkUser && clerkUser.id) {
        console.log('检测到新用户登录，自动启动试用');

        // 开始新的试用
        const trialData = {
          userId: clerkUser.id,
          email: clerkUser.email || '',
          startTime: Date.now(),
          status: 'trial'
        };

        // 保存试用数据
        await new Promise((resolve) => {
          chrome.storage.sync.set({ trialData }, () => {
            resolve();
          });
        });

        return {
          isPro: false,
          isTrialActive: true,
          trialStartTime: trialData.startTime,
          trialEndTime: trialData.startTime + (60 * 60 * 1000)
        };
      }
    }

    // 默认为免费用户
    return {
      isPro: false,
      isTrialActive: false
    };
  } catch (error) {
    console.error('获取用户状态时出错:', error);
    return {
      isPro: false,
      isTrialActive: false,
      error: error.message
    };
  }
}

// 开始Pro功能试用
async function startProTrial(userId, email) {
  try {
    console.log('开始试用, userId:', userId, 'email:', email);

    // 创建试用数据
    const now = Date.now();
    const trialDuration = 60 * 60 * 1000; // 1小时(毫秒)
    const trialEndTime = now + trialDuration;

    const trialData = {
      startTime: now,
      endTime: trialEndTime,
      isActive: true
    };

    // 保存试用数据到chrome.storage
    await new Promise((resolve) => {
      chrome.storage.sync.set({ trialData }, () => {
        resolve();
      });
    });

    console.log('试用数据已保存:', trialData);

    return {
      success: true,
      trialStartTime: trialData.startTime
    };
  } catch (error) {
    console.error('开始试用时出错:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// 打开仪表盘
async function openDashboard() {
  try {
    const userData = await new Promise((resolve) => {
      chrome.storage.sync.get(['userData'], (result) => {
        resolve(result.userData || {});
      });
    });

    // 检查是否有dashboardUrl，如果有直接使用
    if (userData.dashboardUrl) {
      chrome.tabs.create({ url: userData.dashboardUrl });
      return;
    }

    // 没有保存的URL，使用localhost:3000
    const dashboardUrl = 'http://localhost:3000/dashboard';
    chrome.tabs.create({ url: dashboardUrl });

    // 保存URL以便将来使用
    chrome.storage.sync.set({
      userData: {
        ...userData,
        dashboardUrl: dashboardUrl
      }
    });
  } catch (error) {
    console.error('打开仪表盘时出错:', error);
    // 备用方案：打开后端的账户页面
    chrome.tabs.create({ url: 'http://localhost:3000/account' });
  }
}