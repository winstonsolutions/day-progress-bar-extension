// Import the API module
import { testBackendConnection } from './api.js';

// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', async function() {
  const toggleBtn = document.getElementById('toggle-btn');
  const loginBtn = document.getElementById('login-btn');
  const accountBtn = document.getElementById('account-btn');
  const notLoggedInSection = document.getElementById('not-logged-in');
  const loggedInSection = document.getElementById('logged-in');
  const useLocalBackendCheckbox = document.getElementById('use-local-backend');

  // 检查localStorage中的后端设置
  try {
    const useLocalBackend = localStorage.getItem('useLocalBackend') === 'true';
    useLocalBackendCheckbox.checked = useLocalBackend;
    console.log('使用本地后端设置:', useLocalBackend);
  } catch (e) {
    console.error('无法访问localStorage:', e);
  }

  // 添加本地后端切换功能
  useLocalBackendCheckbox.addEventListener('change', function(e) {
    const useLocal = e.target.checked;
    localStorage.setItem('useLocalBackend', useLocal);
    console.log('已更新后端设置，使用本地后端:', useLocal);

    // 显示重新加载提示
    const debugInfoElement = document.getElementById('debug-info');
    debugInfoElement.style.display = 'block';
    debugInfoElement.textContent = `已${useLocal ? '启用' : '禁用'}本地后端。请刷新扩展以应用更改。API地址现在是: ${useLocal ? 'http://localhost' : 'https://day-progress-bar-backend-production.up.railway.app'}`;
  });

  // 检查认证状态
  checkAuthAndUpdateUI();

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
        console.log('登录按钮点击，打开登录页面...');

        // 显示加载状态
        loginBtn.textContent = '加载中...';
        loginBtn.disabled = true;

        // 获取扩展ID
        const extensionId = chrome.runtime.id;

        // 始终使用localhost:3000作为登录URL
        const loginUrl = `http://localhost:3000/?extension_id=${extensionId}`;

        console.log('打开登录页面:', loginUrl);

        // 在新标签页中打开登录页面
        chrome.tabs.create({ url: loginUrl });

        // 重置按钮状态
        loginBtn.textContent = '登录 / 创建账号';
        loginBtn.disabled = false;
      } catch (error) {
        console.error('打开登录页面失败:', error);
        alert('打开登录页面失败，请稍后再试。');

        // 重置按钮
        loginBtn.textContent = '登录 / 创建账号';
        loginBtn.disabled = false;
      }
    });

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
    } catch (error) {
      console.error('测试后端连接失败:', error);
      debugInfoElement.textContent = `测试失败: ${error.message}\n${error.stack || ''}`;
    } finally {
      testBackendButton.disabled = false;
      testBackendButton.textContent = 'Test Backend Connection';
    }
  });
});

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
      } else {
        console.log('当前标签页不是HTTP/HTTPS页面，跳过更新');
      }
    } else {
      console.log('没有活动标签页');
    }
  });
}

/**
 * 更新按钮状态
 */
function updateButtonState(button, isHidden) {
  if (isHidden) {
    button.textContent = '显示进度条';
    button.classList.remove('active');
    button.classList.add('inactive');
  } else {
    button.textContent = '隐藏进度条';
    button.classList.remove('inactive');
    button.classList.add('active');
  }
}

/**
 * 检查认证状态并更新UI
 */
function checkAuthAndUpdateUI() {
  // 从本地存储中获取认证状态
  chrome.storage.local.get(['clerkToken', 'clerkUser'], function(result) {
    const notLoggedInSection = document.getElementById('not-logged-in');
    const loggedInSection = document.getElementById('logged-in');
    const userNameElement = document.getElementById('user-name');

    if (result.clerkToken && result.clerkUser) {
      console.log('用户已登录:', result.clerkUser);

      // 更新UI显示已登录状态
      if (notLoggedInSection) notLoggedInSection.style.display = 'none';
      if (loggedInSection) loggedInSection.style.display = 'block';

      // 显示用户名
      if (userNameElement && result.clerkUser) {
        userNameElement.textContent = result.clerkUser.firstName ||
                                     result.clerkUser.email.split('@')[0];
      }

      // 获取并显示订阅状态
      getSubscriptionData().then(subscription => {
        const subscriptionStatusElement = document.getElementById('subscription-status');
        const proBadgeElement = document.getElementById('pro-badge');
        const freeBadgeElement = document.getElementById('free-badge');

        if (subscriptionStatusElement) {
          subscriptionStatusElement.textContent = subscription.status === 'active' ?
                                               'Pro 订阅' : '免费版';
        }

        if (proBadgeElement && freeBadgeElement) {
          if (subscription.status === 'active') {
            proBadgeElement.style.display = 'inline-block';
            freeBadgeElement.style.display = 'none';
          } else {
            proBadgeElement.style.display = 'none';
            freeBadgeElement.style.display = 'inline-block';
          }
        }
      });
    } else {
      console.log('用户未登录');

      // 更新UI显示未登录状态
      if (notLoggedInSection) notLoggedInSection.style.display = 'block';
      if (loggedInSection) loggedInSection.style.display = 'none';
    }
  });
}