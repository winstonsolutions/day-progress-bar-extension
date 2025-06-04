// Import the Clerk authentication module
import { initClerk, openSignInModal, getCurrentUser, isAuthenticated } from './clerk-auth.js';

// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', async function() {
  const toggleBtn = document.getElementById('toggle-btn');
  const loginBtn = document.getElementById('login-btn');
  const accountBtn = document.getElementById('account-btn');
  const notLoggedInSection = document.getElementById('not-logged-in');
  const loggedInSection = document.getElementById('logged-in');

  // 初始化Clerk
  try {
    await initClerk();
    updateAuthenticationUI();
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
  }

  // 获取当前进度条隐藏状态
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const isHidden = result.dayProgressBarHidden || false;
    updateButtonState(toggleBtn, isHidden);
  });

  // 为按钮添加点击事件
  toggleBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
      const currentlyHidden = result.dayProgressBarHidden || false;
      const newState = !currentlyHidden;

      // 保存新的状态
      chrome.storage.sync.set({ 'dayProgressBarHidden': newState }, function() {
        // 更新按钮状态
        updateButtonState(toggleBtn, newState);

        // 存储状态后立即更新按钮，无论内容脚本是否响应
        // 这确保了即使没有可用的标签页，UI也能正确显示

        // 尝试向当前活动标签页发送消息（如果可用）
        updateActiveTab(newState);
      });
    });
  });

  // 登录按钮点击事件
  if (loginBtn) {
    loginBtn.addEventListener('click', async function() {
      try {
        const user = await openSignInModal();
        if (user) {
          updateAuthenticationUI();
        }
      } catch (error) {
        console.error('Login failed:', error);
      }
    });
  }

  // 账户管理按钮点击事件
  if (accountBtn) {
    accountBtn.addEventListener('click', function() {
      chrome.tabs.create({ url: chrome.runtime.getURL('account.html') });
    });
  }
});

// 更新认证状态UI
async function updateAuthenticationUI() {
  const notLoggedInSection = document.getElementById('not-logged-in');
  const loggedInSection = document.getElementById('logged-in');
  const userNameElement = document.getElementById('user-name');
  const userAvatarElement = document.getElementById('user-avatar');
  const subscriptionStatusElement = document.getElementById('subscription-status');
  const proBadgeElement = document.getElementById('pro-badge');
  const freeBadgeElement = document.getElementById('free-badge');

  if (isAuthenticated()) {
    // 用户已登录
    const user = getCurrentUser();

    // 更新用户信息
    if (userNameElement && user) {
      userNameElement.textContent = user.firstName || user.email.split('@')[0];
    }

    if (userAvatarElement && user) {
      const initial = (user.firstName || user.email).charAt(0).toUpperCase();
      userAvatarElement.textContent = initial;
    }

    // 获取订阅状态
    const subscriptionData = await getSubscriptionData();
    const isProUser = subscriptionData.status === 'active' || subscriptionData.status === 'trial';

    if (subscriptionStatusElement) {
      if (isProUser) {
        subscriptionStatusElement.textContent = 'Premium';
        if (proBadgeElement) proBadgeElement.classList.remove('hidden');
        if (freeBadgeElement) freeBadgeElement.classList.add('hidden');
      } else {
        subscriptionStatusElement.textContent = 'Free';
        if (proBadgeElement) proBadgeElement.classList.add('hidden');
        if (freeBadgeElement) freeBadgeElement.classList.remove('hidden');
      }
    }

    // 显示已登录区域，隐藏未登录区域
    if (notLoggedInSection) notLoggedInSection.classList.add('hidden');
    if (loggedInSection) loggedInSection.classList.remove('hidden');
  } else {
    // 用户未登录
    if (notLoggedInSection) notLoggedInSection.classList.remove('hidden');
    if (loggedInSection) loggedInSection.classList.add('hidden');
  }
}

// 获取订阅状态
async function getSubscriptionData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['subscription'], function(result) {
      resolve(result.subscription || { status: 'free' });
    });
  });
}

// 向活动标签页发送消息的函数
function updateActiveTab(hidden) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      console.log('没有活动的标签页');
      return;
    }

    const activeTab = tabs[0];

    // 首先发送一个检查消息，看内容脚本是否已加载
    try {
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: 'ping' },
        function(response) {
          // 检查runtime.lastError，这是处理Chrome扩展消息错误的标准方式
          if (chrome.runtime.lastError) {
            console.log('内容脚本未加载或未准备好:', chrome.runtime.lastError.message);
            return; // 内容脚本未准备好，退出
          }

          // 内容脚本已准备好，可以发送实际消息
          if (response && response.pong) {
            chrome.tabs.sendMessage(
              activeTab.id,
              {
                action: 'toggleProgressBarVisibility',
                hidden: hidden
              },
              function(response) {
                if (chrome.runtime.lastError) {
                  console.log('更新状态时发生错误:', chrome.runtime.lastError.message);
                  return;
                }
                console.log('状态更新完成', response);
              }
            );
          }
        }
      );
    } catch (error) {
      console.error('发送消息时出错:', error);
    }
  });
}

// 更新按钮状态的辅助函数
function updateButtonState(button, isHidden) {
  button.textContent = isHidden ? 'Show Progress Bar' : 'Hide Progress Bar';

  // 根据状态更新按钮样式
  if (isHidden) {
    // 显示进度条按钮 - 蓝色主要按钮
    button.className = 'primary-btn';
  } else {
    // 隐藏进度条按钮 - 灰色次要按钮
    button.className = 'secondary-btn';
  }
}