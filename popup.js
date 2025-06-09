// Import the API module and auth module
import { testBackendConnection } from './api.js';

// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', async function() {
  const toggleBtn = document.getElementById('toggle-btn');
  const signupBtn = document.getElementById('signup-btn');
  const signinBtn = document.getElementById('signin-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const proLogoutBtn = document.getElementById('pro-logout-btn');

  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');

  // 检查认证状态
  checkAuthAndUpdateUI();

  // 获取当前进度条隐藏状态
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const isHidden = result.dayProgressBarHidden || false;
    updateButtonState(toggleBtn, isHidden);
  });

  // 为进度条按钮添加点击事件
  toggleBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
      const currentlyHidden = result.dayProgressBarHidden || false;
      const newState = !currentlyHidden;

      // 保存新的状态
      chrome.storage.sync.set({ 'dayProgressBarHidden': newState }, function() {
        // 更新按钮状态
        updateButtonState(toggleBtn, newState);

        // 尝试向当前活动标签页发送消息（如果可用）
        updateActiveTab(newState);
      });
    });
  });

  // 注册按钮点击事件
  if (signupBtn) {
    signupBtn.addEventListener('click', function() {
      openAuthPage('sign-up');
    });
  }

  // 登录按钮点击事件
  if (signinBtn) {
    signinBtn.addEventListener('click', function() {
      openAuthPage('sign-in');
    });
  }

  // 登出按钮点击事件
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      logout();
    });
  }

  // Pro用户登出按钮
  if (proLogoutBtn) {
    proLogoutBtn.addEventListener('click', function() {
      logout();
    });
  }

  // 监听存储变化，检测认证状态变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('存储变化 - namespace:', namespace, 'changes:', changes);

    // 如果chrome.storage.local发生变化，并且是认证相关的数据
    if (namespace === 'local' &&
       (changes.clerkToken || changes.clerkUser || changes.authComplete)) {
      console.log('检测到认证相关数据变化');

      // 检查认证状态并更新UI
      checkAuthAndUpdateUI();
    }
  });
});

/**
 * 打开认证页面
 */
function openAuthPage(page = 'sign-in') {
  try {
    console.log(`打开${page}页面...`);

    // 获取扩展ID
    const extensionId = chrome.runtime.id;

    // 使用nextjs后端的URL并添加扩展ID参数
    const authUrl = `http://localhost:3000/${page}?extension_id=${extensionId}`;

    console.log('打开认证页面:', authUrl);

    // 在新标签页中打开登录页面
    chrome.tabs.create({ url: authUrl });
  } catch (error) {
    console.error('打开认证页面失败:', error);
    alert('打开认证页面失败，请稍后再试。');
  }
}

/**
 * 退出登录
 */
function logout() {
  chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete'], function() {
    console.log('已清除认证数据');
    checkAuthAndUpdateUI();
  });
}

/**
 * 获取订阅数据
 */
async function getSubscriptionData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['subscription'], (result) => {
      resolve(result.subscription || { status: 'free' });
    });
  });
}

/**
 * 更新活动标签页
 */
function updateActiveTab(hidden) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
      const activeTab = tabs[0];

      // 检查是否为允许的URL
      const url = activeTab.url || '';
      const isAllowedUrl = url.startsWith('http') || url.startsWith('https');

      if (isAllowedUrl) {
        try {
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'toggleProgressBar', hidden: hidden },
            function(response) {
              // 检查消息是否成功传递
              if (chrome.runtime.lastError) {
                console.log('无法发送消息到内容脚本:', chrome.runtime.lastError.message);

                // 尝试注入内容脚本
                chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['content.js']
                }, function() {
                  if (chrome.runtime.lastError) {
                    console.error('无法注入内容脚本:', chrome.runtime.lastError.message);
                  } else {
                    // 脚本注入成功后重试发送消息
                    setTimeout(() => {
                      chrome.tabs.sendMessage(
                        activeTab.id,
                        { action: 'toggleProgressBar', hidden: hidden }
                      );
                    }, 100);
                  }
                });
              } else if (response) {
                console.log('内容脚本响应:', response);
              }
            }
          );
        } catch (e) {
          console.error('发送消息时出错:', e);
        }
      }
    }
  });
}

/**
 * 更新按钮状态
 */
function updateButtonState(button, isHidden) {
  if (isHidden) {
    button.textContent = "SHOW";
  } else {
    button.textContent = "HIDE";
  }
}

/**
 * 检查认证状态并更新UI
 */
function checkAuthAndUpdateUI() {
  chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], async function(data) {
    console.log('检查认证状态:', data);

    const notLoggedInSection = document.getElementById('not-logged-in');
    const freeUserSection = document.getElementById('free-user');
    const proUserSection = document.getElementById('pro-user');

    const userAvatarElement = document.getElementById('user-avatar');
    const userNameElement = document.getElementById('user-name');

    // 隐藏所有部分
    notLoggedInSection.style.display = 'none';
    freeUserSection.style.display = 'none';
    proUserSection.style.display = 'none';

    // 检查用户是否已登录
    const isSignedIn = !!(data.clerkToken && data.clerkUser);

    if (isSignedIn) {
      const user = JSON.parse(data.clerkUser);
      console.log('已登录的用户:', user);

      // 获取用户订阅数据
      const subscription = await getSubscriptionData();
      console.log('订阅数据:', subscription);

      // 设置用户头像和名称
      if (userAvatarElement) {
        const firstLetter = (user.firstName || user.email || 'U').charAt(0).toUpperCase();
        userAvatarElement.textContent = firstLetter;
      }

      if (userNameElement) {
        userNameElement.textContent = user.firstName || user.email.split('@')[0];
      }

      // 根据订阅状态显示不同UI
      if (subscription.status === 'active' || subscription.status === 'pro') {
        // Pro用户
        proUserSection.style.display = 'block';
      } else {
        // 免费用户
        freeUserSection.style.display = 'block';
      }
    } else {
      // 未登录状态
      notLoggedInSection.style.display = 'block';
    }
  });
}