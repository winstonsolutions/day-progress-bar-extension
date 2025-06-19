// Day Progress Bar - Background Script

// 移除 Supabase 库导入

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
  console.log('收到消息:', message);

  // 处理更新进度条状态的消息
  if (message.action === 'updateProgressBarState') {
    console.log('收到更新进度条状态消息:', message);

    // 如果已经在处理更新，或消息来自存储变化，则跳过
    if (isProcessingUpdate || message.fromStorageChange) {
      console.log('跳过更新，因为', isProcessingUpdate ? '正在处理另一个更新' : '消息来自存储变化');
      sendResponse({ success: true, skipped: true });
      return true;
    }

    // 标记正在处理更新
    isProcessingUpdate = true;

    // 检查是否需要更新（只有当状态实际变化时才更新）
    if (currentProgressBarState.hidden !== message.hidden) {
      // 更新本地状态
      updateProgressBarState(message.hidden);

      // 广播到所有标签页，使用延迟确保不会阻塞
      setTimeout(() => {
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            // 只发送到http/https页面
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
              // 不要发送到源标签页（避免循环）
              if (!sender || sender.tab?.id !== tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'toggleProgressBar',
                  hidden: message.hidden,
                  fromBackgroundSync: true  // 标记这是来自后台的同步，避免内容脚本再次触发更新
                }, function() {
                  // 使用chrome.runtime.lastError检查错误
                  if (chrome.runtime.lastError) {
                    // 忽略错误，某些标签页可能没有内容脚本
                    console.log(`向标签页 ${tab.id} 发送消息失败 (可忽略):`, chrome.runtime.lastError.message);
                  }
                });
              }
            }
          });

          // 处理完成后，重置标志
          isProcessingUpdate = false;
        });
      }, 50);
    } else {
      console.log('进度条状态未变化，跳过更新');
      isProcessingUpdate = false;
    }

    sendResponse({ success: true });
    return true;
  }

  // 处理获取用户状态的请求
  if (message.action === 'get-user-status') {
    getUserStatus()
      .then(status => {
        sendResponse(status);
      })
      .catch(error => {
        console.error('获取用户状态时出错:', error);
        sendResponse({ error: error.message });
      });
    return true; // 异步响应
  }

  // 处理开始试用的请求
  if (message.action === 'start-trial') {
    startProTrial(message.userId, message.email)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('开始试用时出错:', error);
        sendResponse({ success: false, message: error.message });
      });
    return true; // 异步响应
  }

  // 重定向到网站
  if (message.action === 'redirect-to-website') {
    const url = message.url || 'http://localhost:3000/dashboard';
    chrome.tabs.create({ url });
    sendResponse({ success: true });
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
    console.log('收到获取Supabase用户数据的请求, clerkId:', message.clerkId);
    if (!message.clerkId) {
      console.error('错误: 获取Supabase用户数据请求缺少clerkId');
      sendResponse({
        success: false,
        error: 'Missing clerkId parameter'
      });
      return true;
    }

    if (apiModule && typeof apiModule.getUserFromSupabase === 'function') {
      apiModule.getUserFromSupabase(message.clerkId)
        .then(data => {
          console.log('Supabase用户数据查询结果:', data ? '成功' : '未找到数据');
          sendResponse({
            success: true,
            data: data
          });
        })
        .catch(error => {
          console.error('Supabase用户数据查询错误:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        });
    } else {
      console.error('Supabase API模块未正确加载');
      sendResponse({
        success: false,
        error: 'Supabase API模块未加载'
      });
    }
    return true;
  }

  // 处理检查用户许可证的请求
  if (message.action === 'checkUserLicense') {
    console.log('收到检查用户许可证的请求, userId:', message.userId);
    if (!message.userId) {
      console.error('错误: 检查用户许可证请求缺少userId');
      sendResponse({
        success: false,
        error: 'Missing userId parameter'
      });
      return true;
    }

    if (apiModule && typeof apiModule.checkUserLicense === 'function') {
      apiModule.checkUserLicense(message.userId)
        .then(data => {
          console.log('许可证检查结果:', data ? '找到有效许可证' : '未找到有效许可证');
          sendResponse({
            success: true,
            data: data
          });
        })
        .catch(error => {
          console.error('许可证检查错误:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        });
    } else {
      console.error('Supabase API模块未正确加载或缺少checkUserLicense函数');
      sendResponse({
        success: false,
        error: 'Supabase API模块未加载或缺少checkUserLicense函数'
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

          // 同步用户数据到Supabase
          if (apiModule && typeof apiModule.createOrUpdateUserInSupabase === 'function' && userObj.id) {
            console.log('尝试将用户数据同步到Supabase:', userObj);

            // 构建用户数据对象
            const supabaseUserData = {
              clerkId: userObj.id,
              email: userObj.email || `user_${userObj.id.substring(0, 8)}@example.com`,
              firstName: userObj.firstName || userObj.first_name || '',
              lastName: userObj.lastName || userObj.last_name || ''
            };

            // 创建或更新Supabase中的用户
            apiModule.createOrUpdateUserInSupabase(supabaseUserData)
              .then(result => {
                console.log('用户数据同步到Supabase结果:', result);
              })
              .catch(err => {
                console.error('同步用户数据到Supabase失败:', err);
              });
          }
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

          // 同步用户数据到Supabase
          if (apiModule && typeof apiModule.getUserFromSupabase === 'function' && userData.id) {
            console.log('尝试从Supabase获取用户数据，clerkId:', userData.id);

            // 先尝试获取用户
            apiModule.getUserFromSupabase(userData.id)
              .then(data => {
                console.log('Supabase用户查询结果:', data ? '找到用户' : '未找到用户');
                // 如果用户存在，不需要额外操作
                // 如果用户不存在，后面的getUserFromSupabase会自动创建
              })
              .catch(err => {
                console.error('从Supabase获取用户数据失败:', err);
              });
          }

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

    // 尝试从Supabase获取许可证信息
    try {
      // 首先获取用户认证信息
      const authData = await new Promise((resolve) => {
        chrome.storage.local.get(['clerkUser'], (result) => {
          resolve(result);
        });
      });

      // 解析clerkUser数据
      let clerkUserObj = null;
      if (authData.clerkUser) {
        try {
          clerkUserObj = typeof authData.clerkUser === 'string' ?
            JSON.parse(authData.clerkUser) : authData.clerkUser;
        } catch (e) {
          console.error('解析clerkUser数据失败:', e);
        }
      }

      if (clerkUserObj && clerkUserObj.id && apiModule && typeof apiModule.getUserFromSupabase === 'function') {
        console.log('尝试从Supabase获取用户数据，clerkId:', clerkUserObj.id);

        // 获取用户数据
        const supabaseUser = await apiModule.getUserFromSupabase(clerkUserObj.id);

        if (supabaseUser && supabaseUser.id && typeof apiModule.checkUserLicense === 'function') {
          console.log('找到Supabase用户，检查许可证状态，userId:', supabaseUser.id);

          // 检查用户许可证
          const licenseData = await apiModule.checkUserLicense(supabaseUser.id);

          if (licenseData && licenseData.isActive) {
            console.log('找到有效许可证:', licenseData);

            // 保存许可证数据到本地存储
            chrome.storage.sync.set({ licenseData });

            return {
              isPro: true,
              licenseKey: licenseData.licenseKey,
              expiresAt: licenseData.expiresAt
            };
          } else {
            console.log('未找到有效许可证或许可证已过期');
          }
        } else {
          console.log('未找到Supabase用户或checkUserLicense函数不可用');
        }
      }
    } catch (licenseError) {
      console.error('检查许可证状态时出错:', licenseError);
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

    // 同步到Supabase（如果可用）
    try {
      if (apiModule && typeof apiModule.updateUserTrialStatus === 'function') {
        await apiModule.updateUserTrialStatus(userId, new Date(now).toISOString());
        console.log('试用状态已同步到Supabase');
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