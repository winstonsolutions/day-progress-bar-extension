// Import the Clerk authentication module
import {
  initClerk,
  openSignInModal,
  getCurrentUser,
  isAuthenticated,
  signOut,
  storeUserData,
  initializeFromStorage
} from './clerk-auth.js';
import { testBackendConnection } from './api.js';

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
        console.log('Login button clicked, opening sign-in modal...');

        // Show loading state on button
        loginBtn.textContent = 'Loading...';
        loginBtn.disabled = true;

        // Open the sign-in modal in a new tab
        await openSignInModal();

        // Reset button after open
        loginBtn.textContent = 'Sign In / Create Account';
        loginBtn.disabled = false;

        // Note: Authentication state will be updated when the user comes back to this page
        // after completing the auth flow and closing the auth tab
      } catch (error) {
        console.error('Login failed:', error);
        alert('Failed to open authentication page. Please try again.');

        // Reset button
        loginBtn.textContent = 'Sign In / Create Account';
        loginBtn.disabled = false;
      }
    });

    // Check if we're returning from an auth flow - look for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      console.log('Storage changed - namespace:', namespace, 'changes:', changes);

      // 如果chrome.storage.local发生变化，并且是clerk相关的数据
      if (namespace === 'local' &&
         (changes.clerkToken || changes.clerkUser || changes.authComplete)) {
        console.log('检测到 Clerk 相关数据变化');

        // 全面刷新状态，重新初始化Clerk
        initializeClerkState().then(() => {
          // 初始化成功后检查认证状态并更新UI
          checkAuthAndUpdateUI();
        });
      }
    });
  }

  // 账户管理按钮点击事件
  if (accountBtn) {
    accountBtn.addEventListener('click', function() {
      chrome.tabs.create({ url: chrome.runtime.getURL('account.html') });
    });
  }

  // 绑定调试工具事件
  const testBackendButton = document.getElementById('test-backend-button');
  const debugInfoElement = document.getElementById('debug-info');

  // 测试后端连接按钮
  testBackendButton.addEventListener('click', async () => {
    testBackendButton.disabled = true;
    testBackendButton.textContent = 'Testing...';
    debugInfoElement.style.display = 'block';
    debugInfoElement.textContent = 'Testing backend connection...';

    try {
      const result = await testBackendConnection();
      console.log('后端连接测试结果:', result);
      debugInfoElement.textContent = JSON.stringify(result, null, 2);

      // 添加测试 storeUserData 的代码
      console.log('正在测试 storeUserData 函数...');
      try {
        const testUser = {
          firstName: 'Test',
          lastName: 'User',
          email: `test-${Date.now()}@example.com`
        };
        console.log('测试用户数据:', testUser);
        const storeResult = await storeUserData(testUser);
        console.log('storeUserData 测试结果:', storeResult);
        debugInfoElement.textContent += '\n\n--- storeUserData 测试 ---\n' + JSON.stringify(storeResult, null, 2);
      } catch (storeError) {
        console.error('storeUserData 测试失败:', storeError);
        debugInfoElement.textContent += '\n\n--- storeUserData 测试失败 ---\n' + storeError.message;
      }
    } catch (error) {
      console.error('测试后端连接失败:', error);
      debugInfoElement.textContent = `测试失败: ${error.message}\n${error.stack || ''}`;
    } finally {
      testBackendButton.disabled = false;
      testBackendButton.textContent = 'Test Backend Connection';
    }
  });

  // 在页面加载时也尝试初始化Clerk状态
  await initializeClerkState();

  // 初始化UI
  checkAuthAndUpdateUI();
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
    console.log('User is authenticated:', user);

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
    console.log('User is not authenticated');
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

// 初始化Clerk状态的函数 - 确保Clerk全局变量与存储同步
async function initializeClerkState() {
  try {
    // 从存储中获取最新的clerk数据
    const storedData = await chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete']);

    // 如果有clerk数据，确保clerk-auth.js中的全局状态被正确设置
    if (storedData.clerkToken && storedData.clerkUser && storedData.authComplete) {
      console.log('从storage获取到认证数据，初始化clerk-auth状态');

      // 这里需要访问clerk-auth.js中的函数来设置全局状态
      // 这个函数需要在clerk-auth.js中添加，用于手动设置认证状态
      if (typeof initializeFromStorage === 'function') {
        await initializeFromStorage(storedData.clerkToken, storedData.clerkUser);
        console.log('成功初始化clerk-auth状态');
        return true;
      } else {
        console.error('initializeFromStorage函数不可用，请确保clerk-auth.js已正确加载');
        return false;
      }
    } else {
      console.log('存储中没有完整的认证数据');
      return false;
    }
  } catch (error) {
    console.error('初始化Clerk状态失败:', error);
    return false;
  }
}

// 检查认证状态并更新UI
function checkAuthAndUpdateUI() {
  // 检查认证状态
  if (isAuthenticated()) {
    const user = getCurrentUser();
    console.log('用户已认证:', user);

    // 更新UI显示用户信息
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('user-section').style.display = 'block';

    // 设置用户信息
    if (user) {
      document.querySelector('.user-name').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      document.querySelector('.user-email').textContent = user.email || '';

      // 尝试保存用户数据到MongoDB
      console.log('找到用户数据，准备保存到MongoDB:', user);
      storeUserData({
        firstName: user.firstName,
        lastName: user.lastName
      }).catch(error => {
        console.error('保存用户数据到MongoDB失败:', error);
      });
    }
  } else {
    console.log('User is not authenticated');
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('user-section').style.display = 'none';
  }
}