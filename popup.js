// Import the API module and auth module
import { testBackendConnection } from './api.js';

// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', async function() {
  const toggleBtn = document.getElementById('toggle-btn');
  const signupBtn = document.getElementById('signup-btn');
  const signinBtn = document.getElementById('signin-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const proLogoutBtn = document.getElementById('pro-logout-btn');
  const debugSection = document.getElementById('debug-section');
  const debugStatus = document.getElementById('debug-status');

  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');

  // 启用调试模式（开发时使用，生产环境可删除）
  const debug = true;

  if (debug) {
    debugSection.style.display = 'block';
    debugStatus.textContent = 'Initializing...';

    // 添加双击标题以显示调试信息
    document.querySelector('h1').addEventListener('dblclick', function() {
      showDebugInfo();
    });
  }

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
 * 显示调试信息
 */
function showDebugInfo() {
  const debugSection = document.getElementById('debug-section');
  const debugStatus = document.getElementById('debug-status');

  debugSection.style.display = 'block';
  debugStatus.textContent = 'Loading debug info...';

  chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], function(data) {
    let debugText = 'AUTH STATUS:\n';

    if (data.clerkToken) {
      const tokenPreview = data.clerkToken.substring(0, 10) + '...';
      debugText += `- Token: ${tokenPreview}\n`;
    } else {
      debugText += '- No token found\n';
    }

    if (data.clerkUser) {
      debugText += `- User data found: ${typeof data.clerkUser}\n`;
      if (typeof data.clerkUser === 'string') {
        try {
          const user = JSON.parse(data.clerkUser);
          debugText += `- User parsed: ${user.firstName || 'No name'} (${user.email || 'No email'})\n`;
        } catch (e) {
          debugText += `- Failed to parse user data: ${e.message}\n`;
        }
      } else {
        debugText += `- User object: ${JSON.stringify(data.clerkUser)}\n`;
      }
    } else {
      debugText += '- No user data found\n';
    }

    debugText += `- Auth complete: ${data.authComplete ? 'Yes' : 'No'}\n`;

    // Add section visibility info
    debugText += '\nSECTION VISIBILITY:\n';
    debugText += `- Not logged in: ${document.getElementById('not-logged-in').style.display}\n`;
    debugText += `- Free user: ${document.getElementById('free-user').style.display}\n`;
    debugText += `- Pro user: ${document.getElementById('pro-user').style.display}\n`;

    // Display debug info
    debugStatus.textContent = debugText;
  });
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
    const debugStatus = document.getElementById('debug-status');

    const userAvatarElement = document.getElementById('user-avatar');
    const userNameElement = document.getElementById('user-name');

    // Update debug information
    let debugText = '';
    if (data.clerkToken) {
      debugText += `Token found (${data.clerkToken.substring(0, 10)}...)\n`;
    } else {
      debugText += 'No token found\n';
    }

    // 隐藏所有部分
    notLoggedInSection.style.display = 'none';
    freeUserSection.style.display = 'none';
    proUserSection.style.display = 'none';

    // 检查用户是否已登录
    const isSignedIn = !!(data.clerkToken && data.clerkUser);
    console.log('用户登录状态:', isSignedIn);
    debugText += `Login state: ${isSignedIn ? 'Signed in' : 'Not signed in'}\n`;

    if (isSignedIn) {
      console.log('用户已登录，准备显示用户信息');
      debugText += 'User is logged in, preparing to show user info\n';

      let user;

      // 检查clerkUser是字符串还是对象
      if (typeof data.clerkUser === 'string') {
        try {
          user = JSON.parse(data.clerkUser);
          debugText += `Successfully parsed user data\n`;
        } catch (e) {
          console.error('解析用户数据失败:', e);
          debugText += `Failed to parse user data: ${e.message}\n`;
          user = { id: 'error', firstName: 'Error', lastName: '', email: '' };
        }
      } else {
        user = data.clerkUser;
        debugText += `Using user data as object\n`;
      }

      console.log('已登录的用户:', user);

      // 获取用户订阅数据
      const subscription = await getSubscriptionData();
      console.log('订阅数据:', subscription);
      debugText += `Subscription status: ${subscription.status}\n`;

      // 设置用户头像和名称
      if (userAvatarElement) {
        const firstLetter = (user.firstName || (user.email ? user.email.charAt(0) : 'U')).toUpperCase();
        userAvatarElement.textContent = firstLetter;
        console.log('设置用户头像:', firstLetter);
        debugText += `Avatar set to: ${firstLetter}\n`;
      }

      if (userNameElement) {
        const displayName = user.firstName || (user.email ? user.email.split('@')[0] : 'User');
        userNameElement.textContent = displayName;
        console.log('设置用户名称:', displayName);
        debugText += `Username set to: ${displayName}\n`;
      }

      // 根据订阅状态显示不同UI
      if (subscription.status === 'active' || subscription.status === 'pro') {
        // Pro用户
        console.log('显示Pro用户界面');
        debugText += `Displaying PRO user interface\n`;
        proUserSection.style.display = 'block';
      } else {
        // 免费用户
        console.log('显示免费用户界面');
        debugText += `Displaying FREE user interface\n`;
        freeUserSection.style.display = 'block';
      }
    } else {
      // 未登录状态
      console.log('用户未登录，显示登录界面');
      debugText += `Displaying login interface\n`;
      notLoggedInSection.style.display = 'block';
    }

    // Update debug display
    if (debugStatus) {
      debugStatus.textContent = debugText;
    }
  });
}