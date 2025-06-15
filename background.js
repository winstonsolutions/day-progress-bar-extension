// Day Progress Bar - Background Script

// 添加 Supabase 配置导入
try {
  importScripts('supabase-config.js');
  console.log('Supabase配置已导入到background.js');
} catch (e) {
  console.error('无法导入Supabase配置:', e);
}

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
  // 检查用户是否已经登录
  const isLoggedIn = await checkUserLoginStatus();

  // 如果是倒计时功能且用户已登录，直接启用
  if (featureName === 'countdown' && isLoggedIn) {
    console.log('用户已登录，自动启用倒计时功能');
    return true;
  }

  // 如原来的逻辑一样检查订阅数据
  const subscription = await checkSubscriptionStatus();
  return subscription.features && subscription.features[featureName] === true;
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

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);

  if (message.action === 'checkFeature') {
    isFeatureEnabled(message.feature).then(enabled => {
      sendResponse({ enabled });
    });
    return true; // Required for async response
  }

  if (message.action === 'openSubscription') {
    // Redirect to backend home or specific URL if provided
    const url = message.url || 'http://localhost:3000';
    console.log('打开订阅页面或后端主页:', url);
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }

  // 处理更新进度条状态的消息
  if (message.action === 'updateProgressBarState') {
    console.log('收到更新进度条状态的请求:', message);
    updateProgressBarState(message.hidden);
    sendResponse({ success: true });
    return true;
  }

  // 处理获取试用状态的请求
  if (message.action === 'get-trial-status') {
    console.log('收到获取试用状态的请求');
    getUserStatus().then(status => {
      // 检查试用状态
      if (status.isTrialActive) {
        // 广播试用状态到所有标签页
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, {
                action: "trial-status-updated",
                isActive: true,
                trialStartTime: status.trialStartTime,
                trialEndTime: status.trialEndTime
              });
            } catch (e) {
              // 忽略可能的错误（比如无法向某些标签页发送消息）
              console.log(`无法向标签页 ${tab.id} 发送试用状态:`, e);
            }
          });
        });

        // 直接响应
        sendResponse({
          success: true,
          isActive: true,
          trialStartTime: status.trialStartTime,
          trialEndTime: status.trialEndTime
        });
      } else {
        // 没有活跃的试用
        sendResponse({
          success: true,
          isActive: false
        });
      }
    }).catch(error => {
      console.error('获取试用状态失败:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
    return true; // 表示我们将异步返回响应
  }

  // 处理启动试用的请求
  if (message.action === 'start-trial') {
    console.log('收到启动试用的请求:', message);
    startProTrial(message.userId, message.email).then(result => {
      if (result.success) {
        // 广播试用状态到所有标签页
        const trialStartTime = result.trialStartTime;
        const trialEndTime = trialStartTime + (60 * 60 * 1000); // 1小时

        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, {
                action: "trial-status-updated",
                isActive: true,
                trialStartTime: trialStartTime,
                trialEndTime: trialEndTime
              });
            } catch (e) {
              // 忽略可能的错误
              console.log(`无法向标签页 ${tab.id} 发送试用状态:`, e);
            }
          });
        });
      }
      sendResponse(result);
    }).catch(error => {
      console.error('启动试用失败:', error);
      sendResponse({
        success: false,
        message: error.message
      });
    });
    return true;
  }

  // 处理从dashboard.html页面接收的Clerk认证结果
  if (message.action === 'clerk-auth-success') {
    console.log('收到clerk-auth-success消息，处理认证成功', message);

    // 如果消息包含token
    if (message.token) {
      // 检测是否为测试token
      const isTestToken = message.token === 'test_token_for_debugging';

      if (isTestToken) {
        console.log('检测到测试token，跳过API验证，直接使用模拟用户数据');

        // 创建一个测试用户
        const testUser = {
          id: 'test_user_id',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        };

        // 存储测试认证信息
        chrome.storage.local.set({
          clerkToken: message.token,
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

      // 处理user对象
      let userObj;
      if (message.user && typeof message.user === 'object') {
        // 如果消息中已经包含user对象，直接使用
        userObj = message.user;
        console.log('使用消息中包含的用户信息:', userObj);
      } else {
        // 如果没有提供user对象，创建一个最小的占位符对象
        console.log('消息中没有包含用户信息，将使用占位符');
        userObj = {
          id: 'id_from_token',
          email: 'user@example.com',
          firstName: '',
          lastName: ''
        };
      }

      // 存储认证信息到chrome.storage
      chrome.storage.local.set({
        clerkToken: message.token,
        clerkUser: JSON.stringify(userObj),
        authComplete: true,
        isTestMode: false
      }, () => {
        console.log('成功将认证信息存储到chrome.storage');
      });

      // 发送响应
      sendResponse({ success: true });
      return true;
    }
  }

  // 获取用户状态
  if (message.action === 'get-user-status') {
    getUserStatus().then(status => {
      sendResponse(status);
    });
    return true; // 异步响应
  }

  // 购买许可证
  if (message.action === 'buy-license') {
    createCheckoutSession(message.price, message.email)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('创建结账会话时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    return true; // 异步响应
  }

  // 激活许可证
  if (message.action === 'activate-license') {
    activateLicense(message.licenseKey, message.userId, message.email)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('激活许可证时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    return true; // 异步响应
  }

  // 打开仪表盘
  if (message.action === 'openDashboard') {
    openDashboard()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('打开仪表盘时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    return true; // 异步响应
  }

  // 重新打开支付页面
  if (message.action === 'reopenPayment') {
    openPaymentPage()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('打开支付页面时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    return true; // 异步响应
  }

  // 处理初始化Supabase的请求
  if (message.action === 'initSupabase') {
    console.log('收到初始化Supabase的请求');
    if (apiModule && typeof apiModule.initSupabase === 'function') {
      const supabaseClient = apiModule.initSupabase(message.url, message.anonKey);
      sendResponse({
        success: !!supabaseClient
      });
    } else {
      sendResponse({
        success: false,
        error: 'Supabase API模块未加载'
      });
    }
    return true;
  }

  // 处理获取Supabase用户数据的请求
  if (message.action === 'getUserFromSupabase') {
    console.log('收到获取Supabase用户数据的请求:', message.clerkId);
    if (apiModule && typeof apiModule.getUserFromSupabase === 'function') {
      apiModule.getUserFromSupabase(message.clerkId)
        .then(data => {
          sendResponse({
            success: true,
            data: data
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });
    } else {
      sendResponse({
        success: false,
        error: 'Supabase API模块未加载'
      });
    }
    return true;
  }

  return true; // 表示我们会异步处理消息
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

    // 如果本地没有试用数据，尝试从Supabase获取
    if (userData.userData && userData.userData.email) {
      try {
        // 使用api.js中的函数获取用户的Supabase数据
        if (typeof apiModule !== 'undefined' && typeof apiModule.getUserFromSupabase === 'function') {
          const supabaseUser = await apiModule.getUserFromSupabase(userData.userData.id);

          if (supabaseUser && supabaseUser.trial_started_at) {
            const trialStartTime = new Date(supabaseUser.trial_started_at).getTime();
            const currentTime = Date.now();
            const trialEndTime = trialStartTime + (60 * 60 * 1000); // 1小时(毫秒)

            // 如果试用未过期，更新本地存储并返回活跃状态
            if (currentTime < trialEndTime) {
              // 更新本地存储
              const trialData = {
                userId: userData.userData.id,
                email: userData.userData.email,
                startTime: trialStartTime,
                status: 'trial'
              };

              chrome.storage.sync.set({ trialData });

              return {
                isPro: false,
                isTrialActive: true,
                trialStartTime: trialStartTime,
                trialEndTime: trialEndTime
              };
            }
          }
        }
      } catch (supabaseError) {
        console.error('从Supabase获取试用状态失败:', supabaseError);
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

        // 尝试同步到Supabase
        try {
          if (typeof apiModule !== 'undefined' && typeof apiModule.updateUserTrialStatus === 'function') {
            await apiModule.updateUserTrialStatus(clerkUser.id, new Date(trialData.startTime).toISOString());
          }
        } catch (e) {
          console.error('同步试用状态到Supabase失败:', e);
        }

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
    // 检查用户是否已经在试用中
    const userData = await new Promise((resolve) => {
      chrome.storage.sync.get(['trialData'], (result) => {
        resolve(result);
      });
    });

    if (userData.trialData) {
      const trialStartTime = userData.trialData.startTime;
      const currentTime = Date.now();
      const trialEndTime = trialStartTime + (60 * 60 * 1000); // 1小时(毫秒)

      if (currentTime < trialEndTime) {
        return {
          success: false,
          message: '您已经在试用期内',
          trialStartTime: trialStartTime,
          trialEndTime: trialEndTime
        };
      }
    }

    // 开始新的试用
    const trialData = {
      userId: userId,
      email: email,
      startTime: Date.now(),
      status: USER_STATUS.TRIAL
    };

    // 保存试用数据
    await new Promise((resolve) => {
      chrome.storage.sync.set({ trialData }, () => {
        resolve();
      });
    });

    // 同步到Supabase
    try {
      // 检查是否可以访问API函数
      if (typeof apiModule.updateUserTrialStatus === 'function') {
        console.log('同步试用状态到Supabase...');
        await apiModule.updateUserTrialStatus(userId, new Date(trialData.startTime).toISOString());
        console.log('成功同步试用状态到Supabase');
      } else {
        console.log('updateUserTrialStatus函数不可用，无法同步到Supabase');
      }
    } catch (supabaseError) {
      console.error('同步试用状态到Supabase失败:', supabaseError);
      // 继续处理，不影响本地试用
    }

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

// 激活许可证
async function activateLicense(licenseKey, userId, email) {
  try {
    if (!licenseKey) {
      return { success: false, message: '无效的许可证密钥' };
    }

    // 验证许可证密钥
    const isValid = await verifyLicenseKey(licenseKey);

    if (!isValid.valid) {
      return { success: false, message: isValid.message || '无效的许可证密钥' };
    }

    // 保存许可证数据
    const licenseData = {
      userId: userId,
      email: email,
      licenseKey: licenseKey,
      activatedAt: Date.now(),
      isActive: true
    };

    await new Promise((resolve) => {
      chrome.storage.sync.set({ licenseData }, () => {
        resolve();
      });
    });

    // 可选：同步到Supabase
    // ... code to sync license data to Supabase ...

    return { success: true };
  } catch (error) {
    console.error('激活许可证时出错:', error);
    return { success: false, message: error.message };
  }
}

// 验证许可证密钥
async function verifyLicenseKey(licenseKey) {
  try {
    // 从 api.js 导入的函数或直接在这里实现
    // 首先检查本地存储中是否有这个许可证
    const storedLicenses = await new Promise((resolve) => {
      chrome.storage.sync.get(['validLicenses'], (result) => {
        resolve(result.validLicenses || []);
      });
    });

    // 检查本地存储的许可证
    const matchedLicense = storedLicenses.find(license => license.key === licenseKey);
    if (matchedLicense) {
      return { valid: true };
    }

    // 如果本地没有，则调用API进行验证
    // 实际项目中，应该调用verifyLicense API函数
    // const apiResult = await verifyLicense(licenseKey);
    // return apiResult;

    // 模拟API验证
    // 注意：在实际项目中，这里应该替换为真正的API调用
    if (licenseKey.length >= 8) {
      // 添加到本地存储以便将来验证
      storedLicenses.push({ key: licenseKey, activatedAt: Date.now() });
      await new Promise((resolve) => {
        chrome.storage.sync.set({ validLicenses: storedLicenses }, () => {
          resolve();
        });
      });

      return { valid: true };
    } else {
      return { valid: false, message: '无效的许可证密钥格式' };
    }
  } catch (error) {
    console.error('验证许可证时出错:', error);
    return { valid: false, message: error.message };
  }
}

// 创建结账会话(从payment.js中提取)
async function createCheckoutSession(priceInUSD, email) {
  try {
    // 在实际项目中，这应该调用API创建Stripe结账会话
    // 重定向到后端支付页面
    const backendPaymentUrl = `http://localhost:3000/payment?price=${priceInUSD}&email=${encodeURIComponent(email)}`;

    return {
      success: true,
      checkoutUrl: backendPaymentUrl
    };
  } catch (error) {
    console.error('创建结账会话时出错:', error);
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

// 打开支付页面
async function openPaymentPage() {
  try {
    const userData = await new Promise((resolve) => {
      chrome.storage.sync.get(['userData'], (result) => {
        resolve(result.userData || {});
      });
    });

    // 使用后端支付页面
    const backendPaymentUrl = 'http://localhost:3000/payment';
    if (userData.email) {
      chrome.tabs.create({ url: `${backendPaymentUrl}?email=${encodeURIComponent(userData.email)}` });
    } else {
      chrome.tabs.create({ url: backendPaymentUrl });
    }
  } catch (error) {
    console.error('打开支付页面时出错:', error);
    chrome.tabs.create({ url: 'http://localhost:3000/payment' });
  }
}