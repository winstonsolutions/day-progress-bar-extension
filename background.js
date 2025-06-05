// Background script for handling subscription state

// Constants
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
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

// Check if a specific feature is enabled
async function isFeatureEnabled(featureName) {
  const subscription = await checkSubscriptionStatus();
  return subscription.features && subscription.features[featureName] === true;
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

  // 处理从dashboard.html页面接收的Clerk认证结果
  if (message.action === 'clerk-auth-success') {
    console.log('收到clerk-auth-success消息，处理认证成功');

    // 如果消息包含token
    if (message.token) {
      // 调用API获取用户信息
      fetch('https://api.clerk.dev/v1/me', {
        headers: {
          'Authorization': `Bearer ${message.token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API返回错误: ${response.status}`);
        }
        return response.json();
      })
      .then(userData => {
        console.log('从Clerk API获取到用户数据:', userData);

        // 构建用户对象
        const user = {
          id: userData.id,
          email: userData.email_addresses?.[0]?.email_address || '',
          firstName: userData.first_name || '',
          lastName: userData.last_name || ''
        };

        // 存储认证信息到chrome.storage
        chrome.storage.local.set({
          clerkToken: message.token,
          clerkUser: user,
          authComplete: true
        }, () => {
          console.log('成功将认证信息存储到chrome.storage');
        });

        // 发送响应
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('处理Clerk认证失败:', error);
        sendResponse({ success: false, error: error.message });
      });

      return true; // 表示将异步发送响应
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
        // 处理与上面相同的认证逻辑
        fetch('https://api.clerk.dev/v1/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`API返回错误: ${response.status}`);
          }
          return response.json();
        })
        .then(userData => {
          console.log('从Clerk API获取到用户数据:', userData);

          // 构建用户对象
          const user = {
            id: userData.id,
            email: userData.email_addresses?.[0]?.email_address || '',
            firstName: userData.first_name || '',
            lastName: userData.last_name || ''
          };

          // 存储认证信息
          chrome.storage.local.set({
            clerkToken: token,
            clerkUser: user,
            authComplete: true
          }, () => {
            console.log('成功将认证信息存储到chrome.storage');

            // 尝试关闭dashboard标签页
            if (sender.tab && sender.tab.id) {
              chrome.tabs.remove(sender.tab.id);
            }
          });

          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('处理Clerk认证失败:', error);
          sendResponse({ success: false, error: error.message });
        });

        return true; // 表示将异步发送响应
      }
    }

    return false;
  }
);

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("扩展已安装，添加监听器监听来自网页的消息");

  // 添加内容脚本，用于接收网页中的postMessage消息
  chrome.scripting.registerContentScripts([{
    id: 'clerk-message-listener',
    matches: ['http://localhost:3000/*'],  // 只匹配本地测试页面
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