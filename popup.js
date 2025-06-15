// Import the auth module
import { signOut } from './clerk-auth.js';
import SUPABASE_CONFIG from './supabase-config.js';

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

  // 初始化Supabase
  if (SUPABASE_CONFIG.SUPABASE_ENABLED) {
    try {
      // 在popup中，我们需要通过消息与background script通信
      chrome.runtime.sendMessage(
        { action: 'initSupabase', url: SUPABASE_CONFIG.SUPABASE_URL, anonKey: SUPABASE_CONFIG.SUPABASE_ANON_KEY },
        function(response) {
          if (response && response.success) {
            console.log('Supabase初始化成功');
            if (debug) {
              debugStatus.textContent += '\nSupabase: 已连接';
            }
          } else {
            console.error('Supabase初始化失败');
            if (debug) {
              debugStatus.textContent += '\nSupabase: 连接失败';
            }
          }
        }
      );
    } catch (error) {
      console.error('Supabase初始化错误:', error);
      if (debug) {
        debugStatus.textContent += '\nSupabase错误: ' + error.message;
      }
    }
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
async function logout() {
  try {
    console.log('执行登出流程...');

    // 调用Clerk的signOut方法确保后端也登出
    const signOutResult = await signOut();
    console.log('Clerk signOut 结果:', signOutResult);

    // 清除本地存储中的认证数据
    chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete'], function() {
      console.log('已清除本地认证数据');

      // 刷新UI显示未登录状态
      checkAuthAndUpdateUI();

      // 可选：向后端发送登出事件
      try {
        const API_URL = 'http://localhost'; // 直接使用默认值
        fetch(`${API_URL}/api/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(e => console.log('通知后端登出可选步骤失败，忽略此错误:', e));
      } catch (e) {
        console.log('通知后端登出失败，但这是可选步骤:', e);
      }
    });
  } catch (error) {
    console.error('登出过程中出错:', error);
    alert('登出失败，请重试');
  }
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
  // 1. 向所有标签页发送消息，而不仅仅是活动标签页
  chrome.tabs.query({}, function(tabs) {
    console.log(`向${tabs.length}个标签页发送消息，设置进度条隐藏状态为:`, hidden);

    // 跟踪成功更新的标签页数量
    let updatedTabs = 0;

    // 遍历所有标签页
    tabs.forEach(tab => {
      // 检查是否为允许的URL
      const url = tab.url || '';
      const isAllowedUrl = url.startsWith('http') || url.startsWith('https');

      if (isAllowedUrl) {
        try {
          console.log(`尝试向标签页发送消息:`, {tabId: tab.id, url: tab.url});
          chrome.tabs.sendMessage(
            tab.id,
            { action: 'toggleProgressBar', hidden: hidden },
            function(response) {
              // 检查消息是否成功传递
              if (chrome.runtime.lastError) {
                console.log(`标签页 ${tab.id} 无法接收消息:`, chrome.runtime.lastError.message);

                // 尝试注入内容脚本
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content.js']
                }, function() {
                  if (chrome.runtime.lastError) {
                    // 改进错误处理 - 检查是否为受限页面
                    const errorMsg = chrome.runtime.lastError.message || '';

                    // 判断是否为常见的受限页面错误
                    if (errorMsg.includes('cannot access') ||
                        errorMsg.includes('cannot be accessed') ||
                        errorMsg.includes('cannot run scripts') ||
                        errorMsg.includes('permission') ||
                        errorMsg.includes('extensions gallery') ||
                        errorMsg.includes('cannot be scripted')) {
                      console.log(`标签页 ${tab.id} 是受限页面，无法注入内容脚本:`, errorMsg);
                    } else {
                      console.log(`无法向标签页 ${tab.id} 注入内容脚本:`, errorMsg);
                    }
                  } else {
                    // 脚本注入成功后重试发送消息
                    setTimeout(() => {
                      chrome.tabs.sendMessage(
                        tab.id,
                        { action: 'toggleProgressBar', hidden: hidden },
                        function(innerResponse) {
                          if (chrome.runtime.lastError) {
                            console.log(`重试发送消息失败:`, chrome.runtime.lastError.message);
                          } else if (innerResponse && innerResponse.success) {
                            updatedTabs++;
                            console.log(`标签页 ${tab.id} 成功更新`);
                          }
                        }
                      );
                    }, 100);
                  }
                });
              } else if (response && response.success) {
                updatedTabs++;
                console.log(`标签页 ${tab.id} 成功更新`);
              }
            }
          );
        } catch (e) {
          console.log(`向标签页 ${tab.id} 发送消息时出错:`, e);
        }
      }
    });

    // 2. 更新背景页中的状态，确保新打开的标签页也会应用正确的状态
    chrome.runtime.sendMessage(
      { action: 'updateProgressBarState', hidden: hidden },
      function(response) {
        console.log('背景页响应:', response);
      }
    );
  });
}

/**
 * 更新按钮状态
 */
function updateButtonState(button, isHidden) {
  if (isHidden) {
    button.textContent = "SHOW";
    button.style.backgroundColor = "#4285F4"; // Google blue when showing SHOW button
    button.style.color = "white"; // Set text color to white for SHOW
  } else {
    button.textContent = "HIDE";
    button.style.backgroundColor = "#f1f3f4"; // Light gray when showing HIDE button
    button.style.color = "black"; // Set text color to black for HIDE
  }

  // 添加日志，便于调试
  console.log('更新按钮状态:', isHidden ? 'SHOW' : 'HIDE');
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
async function checkAuthAndUpdateUI() {
  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const debugStatus = document.getElementById('debug-status');

  console.log('检查认证状态...');

  try {
    // 从本地存储中获取认证数据
    const authData = await new Promise((resolve) => {
      chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], (result) => {
        resolve(result);
      });
    });

    console.log('获取到的认证数据:', authData);

    // 检查是否有有效的Clerk用户
    if (authData.clerkUser && authData.authComplete) {
      console.log('用户已登录:', authData.clerkUser);

      // 尝试从Supabase获取用户数据
      let supabaseUserData = null;
      if (SUPABASE_CONFIG.SUPABASE_ENABLED) {
        try {
          // 通过消息获取Supabase用户数据
          const supabaseUserResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { action: 'getUserFromSupabase', clerkId: authData.clerkUser.id },
              (response) => {
                resolve(response);
              }
            );
          });

          if (supabaseUserResponse && supabaseUserResponse.success) {
            supabaseUserData = supabaseUserResponse.data;
            console.log('从Supabase获取的用户数据:', supabaseUserData);
          }
        } catch (error) {
          console.error('从Supabase获取用户数据失败:', error);
        }
      }

      // 获取订阅状态
      const subscription = await getSubscriptionData();
      console.log('用户订阅状态:', subscription);

      // 更新UI - 隐藏未登录部分，显示登录后部分
      notLoggedInSection.style.display = 'none';

      // 根据订阅状态决定显示免费或Pro版UI
      if (subscription.status === 'pro') {
        freeUserSection.style.display = 'none';
        proUserSection.style.display = 'block';
      } else {
        // 默认为免费用户
        freeUserSection.style.display = 'block';
        proUserSection.style.display = 'none';

        // 更新用户头像和名称
        const firstName = authData.clerkUser.firstName || '';
        const lastName = authData.clerkUser.lastName || '';
        const fullName = firstName
          ? firstName + (lastName ? ' ' + lastName : '')
          : authData.clerkUser.emailAddresses?.[0]?.emailAddress || 'User';

        if (userAvatar) {
          userAvatar.textContent = firstName ? firstName.charAt(0).toUpperCase() : 'U';
        }
        if (userName) {
          userName.textContent = fullName;
        }
      }

      // 更新调试信息
      if (debugStatus) {
        debugStatus.textContent = `已登录: ${authData.clerkUser.emailAddresses?.[0]?.emailAddress || 'Unknown Email'}\n`;
        debugStatus.textContent += `订阅状态: ${subscription.status}\n`;
        if (supabaseUserData) {
          debugStatus.textContent += `Supabase用户ID: ${supabaseUserData.id}`;
        }
      }
    } else {
      console.log('用户未登录');

      // 更新UI - 显示未登录部分，隐藏登录后部分
      notLoggedInSection.style.display = 'block';
      freeUserSection.style.display = 'none';
      proUserSection.style.display = 'none';

      // 更新调试信息
      if (debugStatus) {
        debugStatus.textContent = '未登录状态';
      }
    }
  } catch (error) {
    console.error('检查认证状态出错:', error);

    // 发生错误时显示未登录状态
    notLoggedInSection.style.display = 'block';
    freeUserSection.style.display = 'none';
    proUserSection.style.display = 'none';

    // 更新调试信息
    if (debugStatus) {
      debugStatus.textContent = `认证检查错误: ${error.message}`;
    }
  }
}