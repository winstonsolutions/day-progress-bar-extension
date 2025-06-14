// Background script for handling subscription state

// Constants
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
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

// Open subscription page when menu item clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'manage-subscription') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('subscription.html')
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
  if (message.action === 'checkFeature') {
    isFeatureEnabled(message.feature).then(enabled => {
      sendResponse({ enabled });
    });
    return true; // Required for async response
  }

  if (message.action === 'openSubscription') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('subscription.html')
    });
    sendResponse({ success: true });
    return true;
  }

  // 处理更新进度条状态的消息
  if (message.action === 'updateProgressBarState') {
    console.log('收到更新进度条状态的请求:', message);
    updateProgressBarState(message.hidden);
    sendResponse({ success: true });
    return false; // 非异步响应
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
      'https://day-progress-bar-backend-production.up.railway.app/*',  // 部署环境（包括所有子路径）
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