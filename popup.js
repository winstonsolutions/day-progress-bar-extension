/**
 * Day Progress Bar Extension Popup UI Controller
 */
// 移除Supabase配置导入
// import SUPABASE_CONFIG from './supabase-config.js';

// 当弹出界面加载时，初始化按钮状态
document.addEventListener('DOMContentLoaded', async function() {
  // 加载clerk-auth.js脚本
  const clerkAuthScript = document.createElement('script');
  clerkAuthScript.src = './clerk-auth.js';
  document.head.appendChild(clerkAuthScript);

  // 等待脚本加载完成
  await new Promise(resolve => {
    clerkAuthScript.onload = resolve;
  });

  // Debug状态显示区域
  const debugStatus = document.getElementById("debug-status");
  if (debugStatus) {
    // 显示扩展版本信息
    const manifest = chrome.runtime.getManifest();
    debugStatus.textContent = `版本: ${manifest.version}`;
  }

  // 检查登录状态并相应更新UI
  checkUserLoginStatus();

  // 初始化工作时间设置
  loadSettings();

  // 添加事件监听器
  attachEventListeners();

  // 监听来自background.js的消息
  chrome.runtime.onMessage.addListener(handleRuntimeMessages);

  // 检查并显示订阅状态
  checkSubscriptionStatus();

  // 设置开关按钮状态
  loadToggleButtonState();

  const toggleBtn = document.getElementById('toggle-btn');
  const signupBtn = document.getElementById('signup-btn');
  const signinBtn = document.getElementById('signin-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const debugSection = document.getElementById('debug-section');

  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');

  // 启用调试模式（开发时使用，生产环境可删除）
  const debug = true;

  if (debug) {
    debugSection.style.display = 'block';
    if (debugStatus) debugStatus.textContent = 'Initializing...';

    // 添加双击标题以显示调试信息
    document.querySelector('h1').addEventListener('dblclick', function() {
      showDebugInfo();
    });
  }

  // 获取页面上的元素
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const saveSettingsBtn = document.getElementById('save-settings');
  const countdownInput = document.getElementById('countdown-minutes');
  const startCountdownBtn = document.getElementById('start-countdown');
  const hideProgressBarBtn = document.getElementById('hide-progress-bar');

  // 登录按钮事件
  const signInBtn = document.getElementById('sign-in-btn');
  if (signInBtn) {
    signInBtn.addEventListener('click', function() {
      showClerkSignIn();
    });
  }

  // 退出登录按钮事件
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', function() {
      signOut();
    });
  }

  // 调试按钮
  const debugBtn = document.getElementById('debug-btn');
  if (debugBtn) {
    debugBtn.addEventListener('click', function() {
      const debugContainer = document.getElementById('debug-container');
      if (debugContainer) {
        debugContainer.classList.toggle('hidden');
      }
    });
  }

  // 检查认证状态 - 修复为正确的函数名
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
      signOut();
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

  // 监听来自background.js的认证状态变化消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'auth-state-changed') {
      console.log('收到认证状态变化消息:', message);

      // 收到消息后立即更新UI
      setTimeout(() => {
        checkAuthAndUpdateUI();

        // 显示调试信息
        if (debug) {
          showDebugInfo();
        }
      }, 500);
    }
    return true;
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
 * 显示Clerk登录界面
 */
function showClerkSignIn() {
  try {
    console.log('打开Clerk登录界面...');

    // 检查是否已经加载了ClerkAuth
    if (typeof ClerkAuth !== 'undefined' && ClerkAuth.openSignInModal) {
      ClerkAuth.openSignInModal('sign-in')
        .then(user => {
          if (user) {
            console.log('用户登录成功:', user);
            checkAuthAndUpdateUI();
          } else {
            console.log('用户取消登录或登录失败');
          }
        })
        .catch(error => {
          console.error('登录过程中出错:', error);
        });
    } else {
      // 如果ClerkAuth未加载，使用openAuthPage
      openAuthPage('sign-in');
    }
  } catch (error) {
    console.error('显示登录界面时出错:', error);

    // 失败时回退到openAuthPage
    openAuthPage('sign-in');
  }
}

/**
 * 退出登录
 */
function signOut() {
  try {
    console.log('执行登出流程...');

    // 检查是否已经加载了ClerkAuth
    if (typeof ClerkAuth !== 'undefined' && ClerkAuth.signOut) {
      ClerkAuth.signOut()
        .then(success => {
          if (success) {
            console.log('登出成功');
            // 清除本地存储中的认证数据和订阅数据
            chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete'], function() {
              console.log('已清除本地认证数据');

              // 同时清除订阅数据
              chrome.storage.sync.remove(['subscription', 'subscriptionSource'], function() {
                console.log('已清除订阅数据');
                // 刷新UI显示未登录状态
                checkAuthAndUpdateUI();
              });
            });
          } else {
            console.log('登出失败');
          }
        })
        .catch(error => {
          console.error('登出过程中出错:', error);
        });
    } else {
      // 如果ClerkAuth未加载，直接清除本地存储
      chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete'], function() {
        console.log('已清除本地认证数据');

        // 同时清除订阅数据
        chrome.storage.sync.remove(['subscription', 'subscriptionSource'], function() {
          console.log('已清除订阅数据');
          // 刷新UI显示未登录状态
          checkAuthAndUpdateUI();
        });
      });
    }
  } catch (error) {
    console.error('登出过程中出错:', error);

    // 出错时尝试直接清除本地存储
    chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete'], function() {
      console.log('已清除本地认证数据（错误处理）');

      // 同时清除订阅数据
      chrome.storage.sync.remove(['subscription', 'subscriptionSource'], function() {
        console.log('已清除订阅数据（错误处理）');
        checkAuthAndUpdateUI();
      });
    });
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
 * 获取订阅数据的来源
 */
async function getSubscriptionSource() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['subscriptionSource'], (result) => {
      resolve(result.subscriptionSource || null);
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

  // 获取认证数据和订阅状态
  Promise.all([
    new Promise((resolve) => {
      chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], (data) => {
        resolve(data);
      });
    }),
    new Promise((resolve) => {
      chrome.storage.sync.get(['subscription', 'subscriptionSource'], (data) => {
        resolve(data);
      });
    })
  ]).then(([authData, subscriptionData]) => {
    let debugText = 'AUTH STATUS:\n';

    if (authData.clerkToken) {
      const tokenPreview = authData.clerkToken.substring(0, 10) + '...';
      debugText += `- Token: ${tokenPreview}\n`;
    } else {
      debugText += '- No token found\n';
    }

    if (authData.clerkUser) {
      debugText += `- User data found: ${typeof authData.clerkUser}\n`;
      if (typeof authData.clerkUser === 'string') {
        try {
          const user = JSON.parse(authData.clerkUser);
          debugText += `- User parsed: ${user.firstName || 'No name'} (${user.email || 'No email'})\n`;
          if (user.isPro !== undefined) {
            debugText += `- User isPro flag: ${user.isPro}\n`;
          }
        } catch (e) {
          debugText += `- Failed to parse user data: ${e.message}\n`;
        }
      } else {
        debugText += `- User object: ${JSON.stringify(authData.clerkUser)}\n`;
      }
    } else {
      debugText += '- No user data found\n';
    }

    debugText += `- Auth complete: ${authData.authComplete ? 'Yes' : 'No'}\n`;

    // 添加订阅状态信息
    debugText += '\nSUBSCRIPTION STATUS:\n';
    if (subscriptionData.subscription) {
      debugText += `- Status: ${subscriptionData.subscription.status}\n`;
      debugText += `- Source: ${subscriptionData.subscriptionSource || 'unknown'}\n`;
      if (subscriptionData.subscription.features) {
        debugText += `- Features: ${JSON.stringify(subscriptionData.subscription.features)}\n`;
      }
    } else {
      debugText += '- No subscription data found\n';
    }

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
  const logoutBtn = document.getElementById('logout-btn');

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
      // 确保clerkUser是对象
      let clerkUserObj = authData.clerkUser;
      if (typeof authData.clerkUser === 'string') {
        try {
          clerkUserObj = JSON.parse(authData.clerkUser);
          console.log('已解析clerkUser字符串为对象');
        } catch (e) {
          console.error('解析clerkUser字符串失败:', e);
          clerkUserObj = { id: 'unknown', email: 'unknown' };
        }
      }

      console.log('用户已登录:', clerkUserObj);

      // 获取订阅状态
      const subscription = await getSubscriptionData();
      console.log('用户订阅状态:', subscription);

      // 检查订阅来源和用户状态
      if (!subscription || subscription.status !== 'pro') {
        // 检查用户对象中是否包含isPro字段
        const userIsPro = clerkUserObj.isPro === true;
        if (userIsPro) {
          console.log('用户对象中包含isPro=true，直接更新为Pro状态');
          // 更新订阅状态
          chrome.storage.sync.set({
            subscription: {
              status: 'pro',
              features: { countdown: true }
            },
            subscriptionSource: 'user-object' // 添加来源标记，便于调试
          });
          // 更新本地变量以便后续使用
          subscription.status = 'pro';
        }
        // 只有在既不是Pro订阅，用户对象中也没有isPro标记时，才尝试从本地后端API获取
        else {
          // 尝试从本地API获取用户数据
          console.log('尝试从本地API获取用户许可状态');

          // 许可检查API调用
          chrome.runtime.sendMessage(
            { action: 'checkUserLicense', userId: clerkUserObj.id },
            function(response) {
              if (response && response.data && response.data.license_valid === true && response.data.license_type === 'pro') {
                console.log('API许可检查成功:', response.data);

                // 设置订阅状态
                const subscriptionInfo = {
                  status: response.data.license_type === 'pro' ? 'active' : 'free',
                  features: {
                    countdown: response.data.license_type === 'pro'
                  }
                };

                // 保存到存储
                chrome.storage.sync.set({
                  subscription: subscriptionInfo,
                  subscriptionSource: 'api'
                }, function() {
                  console.log('从API保存的订阅信息:', subscriptionInfo);
                  updateSubscriptionUI(subscriptionInfo);
                });
              } else {
                console.log('API许可无效或检查失败:', response);
                // 回退到试用检查
                checkTrialStatus();
              }
            }
          );
        }
      } else {
        console.log(`使用现有subscription状态: ${subscription.status}, 来源: ${await getSubscriptionSource() || 'unknown'}`);
      }

      // 更新UI - 隐藏未登录部分，显示登录后部分
      notLoggedInSection.style.display = 'none';

      // 显示登出按钮（无论是什么类型的用户）
      if (logoutBtn) {
        logoutBtn.style.display = 'block';
      }

      // 根据订阅状态决定显示免费或Pro版UI
      if (subscription.status === 'pro') {
        freeUserSection.style.display = 'none';
        proUserSection.style.display = 'block';
      } else {
        // 默认为免费用户
        freeUserSection.style.display = 'block';
        proUserSection.style.display = 'none';

        // 更新用户头像和名称
        const firstName = clerkUserObj.firstName || '';
        const lastName = clerkUserObj.lastName || '';
        const fullName = firstName
          ? firstName + (lastName ? ' ' + lastName : '')
          : clerkUserObj.emailAddresses?.[0]?.emailAddress || clerkUserObj.email || 'User';

        if (userAvatar) {
          userAvatar.textContent = firstName ? firstName.charAt(0).toUpperCase() : 'U';
        }
        if (userName) {
          userName.textContent = fullName;
        }
      }

      // 更新调试信息
      if (debugStatus) {
        debugStatus.textContent = `已登录: ${clerkUserObj.emailAddresses?.[0]?.emailAddress || clerkUserObj.email || 'Unknown Email'}\n`;
        debugStatus.textContent += `订阅状态: ${subscription.status}\n`;
      }
    } else {
      console.log('用户未登录');

      // 更新UI - 显示未登录部分，隐藏登录后部分
      notLoggedInSection.style.display = 'block';
      freeUserSection.style.display = 'none';
      proUserSection.style.display = 'none';

      // 隐藏登出按钮
      if (logoutBtn) {
        logoutBtn.style.display = 'none';
      }

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

    // 隐藏登出按钮
    if (logoutBtn) {
      logoutBtn.style.display = 'none';
    }

    // 更新调试信息
    if (debugStatus) {
      debugStatus.textContent = `认证检查错误: ${error.message}`;
    }
  }
}

// 检查并显示订阅状态
async function checkSubscriptionStatus() {
  try {
    // 获取订阅状态元素
    const subscriptionStatus = document.getElementById('subscription-status');
    if (!subscriptionStatus) return;

    // 从chrome.storage.local获取用户登录数据
    chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], async (data) => {
      // 如果用户未登录，显示登录提示
      if (!data.authComplete || !data.clerkUser) {
        console.log('用户未登录，显示登录提示');
        subscriptionStatus.textContent = '未登录';
        subscriptionStatus.style.color = '#888';

        // 显示登录提示区域
        const loginPrompt = document.getElementById('login-prompt');
        if (loginPrompt) {
          loginPrompt.classList.remove('hidden');
        }

        // 隐藏个人资料区域
        const userProfileContainer = document.getElementById('user-profile');
        if (userProfileContainer) {
          userProfileContainer.classList.add('hidden');
        }

        return;
      }

      // 检查订阅状态
      chrome.storage.sync.get(['subscription', 'subscriptionSource'], (data) => {
        // 根据订阅数据更新UI
        if (data.subscription) {
          updateSubscriptionUI(data.subscription);
        } else {
          // 如果没有订阅数据，尝试获取最新状态
          updateUserSubscription();
        }
      });
    });
  } catch (error) {
    console.error('检查订阅状态时出错:', error);
  }
}

// 更新用户订阅状态
async function updateUserSubscription() {
  try {
    // 获取当前订阅信息
    // 声明subscriptionInfo变量
    let subscriptionInfo = null;

    // 检查 Clerk 用户数据
    chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], async (result) => {
      // 如果没有登录，则无需更新
      if (!result.authComplete || !result.clerkUser) {
        console.log('用户未登录，无法更新订阅状态');
        return;
      }

      // 获取本地存储的数据
      const clerkUserObj = JSON.parse(result.clerkUser);
      console.log('检查用户订阅，用户ID:', clerkUserObj.id);

      // 检查 Clerk 用户是否有 isPro 标签
      const isPro = clerkUserObj.publicMetadata && clerkUserObj.publicMetadata.isPro === true;

      if (isPro) {
        // 用户是Pro用户 - 设置活跃订阅
        console.log('用户拥有Pro元数据标记，设置为Pro订阅');
        subscriptionInfo = {
          status: 'active',
          features: {
            countdown: true
          },
          source: 'clerk_metadata'
        };
      } else {
        // 尝试本地后端
        try {
          const checkResponse = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                action: 'checkUserLicense',
                userId: clerkUserObj.id
              },
              (response) => {
                resolve(response);
              }
            );
          });

          console.log('许可检查响应:', checkResponse);

          if (checkResponse && checkResponse.data && checkResponse.data.license_valid) {
            // 设置活跃订阅
            console.log('许可有效，设置为Pro订阅');
            subscriptionInfo = {
              status: 'active',
              features: {
                countdown: true
              },
              source: 'license_api'
            };
          }
        } catch (error) {
          console.error('检查许可时出错:', error);
        }
      }

      // 如果没有Pro订阅，检查试用状态
      if (!subscriptionInfo || subscriptionInfo.status !== 'active') {
        chrome.storage.sync.get(['trialData'], (result) => {
          if (result.trialData) {
            const { trialStartedAt } = result.trialData;

            if (trialStartedAt) {
              const now = new Date();
              const trialStart = new Date(trialStartedAt);
              const trialEnd = new Date(trialStart);
              trialEnd.setDate(trialStart.getDate() + 14); // 14天试用期

              if (now < trialEnd) {
                // 试用期内
                const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                console.log('用户在试用期内，剩余天数:', daysLeft);

                subscriptionInfo = {
                  status: 'trial',
                  features: {
                    countdown: true
                  },
                  trialEnds: trialEnd.toISOString(),
                  daysLeft: daysLeft,
                  source: 'trial_data'
                };
              } else {
                // 试用已过期
                console.log('用户试用已过期');
                subscriptionInfo = {
                  status: 'expired',
                  features: {
                    countdown: false
                  },
                  source: 'trial_expired'
                };
              }
            }
          }

          // 如果没有订阅和试用信息，设为免费用户
          if (!subscriptionInfo) {
            console.log('用户无订阅，设为免费用户');
            subscriptionInfo = {
              status: 'free',
              features: {
                countdown: false
              },
              source: 'default'
            };
          }

          // 保存订阅信息到存储
          chrome.storage.sync.set({
            subscription: subscriptionInfo,
            subscriptionSource: subscriptionInfo.source
          }, () => {
            console.log('订阅信息已保存:', subscriptionInfo);
            updateSubscriptionUI(subscriptionInfo);
          });
        });
      } else {
        // 如果有订阅信息，直接保存
        chrome.storage.sync.set({
          subscription: subscriptionInfo,
          subscriptionSource: subscriptionInfo.source
        }, () => {
          console.log('订阅信息已保存:', subscriptionInfo);
          updateSubscriptionUI(subscriptionInfo);
        });
      }
    });
  } catch (error) {
    console.error('更新用户订阅状态时出错:', error);
  }
}

// 试用状态检查函数
function checkTrialStatus() {
  chrome.storage.sync.get(['trialData'], (result) => {
    let subscriptionInfo = null;

    if (result.trialData) {
      const { trialStartedAt } = result.trialData;

      if (trialStartedAt) {
        const now = new Date();
        const trialStart = new Date(trialStartedAt);
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialStart.getDate() + 14); // 14天试用期

        if (now < trialEnd) {
          // 试用期内
          const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
          console.log('用户在试用期内，剩余天数:', daysLeft);

          subscriptionInfo = {
            status: 'trial',
            features: {
              countdown: true
            },
            trialEnds: trialEnd.toISOString(),
            daysLeft: daysLeft,
            source: 'trial_data'
          };
        } else {
          // 试用已过期
          console.log('用户试用已过期');
          subscriptionInfo = {
            status: 'expired',
            features: {
              countdown: false
            },
            source: 'trial_expired'
          };
        }
      }
    }

    // 如果没有试用信息，设为免费用户
    if (!subscriptionInfo) {
      console.log('用户无试用信息，设为免费用户');
      subscriptionInfo = {
        status: 'free',
        features: {
          countdown: false
        },
        source: 'default'
      };
    }

    // 保存订阅信息到存储
    chrome.storage.sync.set({
      subscription: subscriptionInfo,
      subscriptionSource: subscriptionInfo.source
    }, () => {
      console.log('试用状态信息已保存:', subscriptionInfo);
      updateSubscriptionUI(subscriptionInfo);
    });
  });
}

/**
 * 更新订阅状态UI
 * @param {Object} subscription 订阅信息
 */
function updateSubscriptionUI(subscription) {
  if (!subscription) return;

  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');
  const subscriptionStatus = document.getElementById('subscription-status');

  console.log('更新订阅UI，状态:', subscription.status);

  // 更新订阅状态文本
  if (subscriptionStatus) {
    switch(subscription.status) {
      case 'active':
      case 'pro':
        subscriptionStatus.textContent = 'PRO';
        subscriptionStatus.style.color = '#4CAF50'; // 绿色
        break;
      case 'trial':
        subscriptionStatus.textContent = '试用中';
        subscriptionStatus.style.color = '#2196F3'; // 蓝色
        break;
      case 'expired':
        subscriptionStatus.textContent = '已过期';
        subscriptionStatus.style.color = '#f44336'; // 红色
        break;
      case 'free':
        subscriptionStatus.textContent = '免费版';
        subscriptionStatus.style.color = '#757575'; // 灰色
        break;
      default:
        subscriptionStatus.textContent = '未知';
        subscriptionStatus.style.color = '#757575'; // 灰色
    }
  }

  // 更新UI部分的显示/隐藏
  if (subscription.status === 'active' || subscription.status === 'pro') {
    // Pro用户
    if (notLoggedInSection) notLoggedInSection.style.display = 'none';
    if (freeUserSection) freeUserSection.style.display = 'none';
    if (proUserSection) proUserSection.style.display = 'block';

    // 更新倒计时按钮状态
    updateCountdownButtonState(true);
  } else {
    // 免费用户或试用用户
    if (notLoggedInSection) notLoggedInSection.style.display = 'none';
    if (freeUserSection) freeUserSection.style.display = 'block';
    if (proUserSection) proUserSection.style.display = 'none';

    // 更新试用状态显示
    const trialStatusElem = document.getElementById('trial-status');
    if (trialStatusElem) {
      if (subscription.status === 'trial') {
        trialStatusElem.textContent = `试用中 (剩余${subscription.daysLeft || 0}天)`;
        trialStatusElem.style.color = '#2196F3'; // 蓝色

        // 更新倒计时按钮状态 - 试用期也可使用倒计时功能
        updateCountdownButtonState(true);
      } else if (subscription.status === 'expired') {
        trialStatusElem.textContent = '试用已过期';
        trialStatusElem.style.color = '#f44336'; // 红色

        // 更新倒计时按钮状态
        updateCountdownButtonState(false);
      } else {
        trialStatusElem.textContent = '未开始试用';
        trialStatusElem.style.color = '#757575'; // 灰色

        // 更新倒计时按钮状态
        updateCountdownButtonState(false);
      }
    }
  }

  // 更新调试信息
  const debugStatus = document.getElementById('debug-status');
  if (debugStatus) {
    debugStatus.textContent += `\n订阅状态: ${subscription.status}`;
    if (subscription.source) {
      debugStatus.textContent += `\n订阅来源: ${subscription.source}`;
    }
  }
}

/**
 * 更新倒计时按钮状态
 * @param {boolean} enabled 是否启用
 */
function updateCountdownButtonState(enabled) {
  const countdownSection = document.getElementById('countdown-section');
  if (countdownSection) {
    countdownSection.style.opacity = enabled ? '1' : '0.5';
    countdownSection.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}

/**
 * 检查用户登录状态
 * 这个函数用于检查用户是否已登录，并返回登录状态
 * @returns {Promise<boolean>} 是否已登录
 */
function checkUserLoginStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['clerkToken', 'clerkUser', 'authComplete'], (data) => {
      // 如果有token和用户数据，认为用户已登录
      const isLoggedIn = !!(data.clerkToken && data.clerkUser && data.authComplete);
      console.log('用户登录状态检查:', isLoggedIn ? '已登录' : '未登录');

      // 如果在popup环境，更新UI
      updateLoginUI(isLoggedIn, data.clerkUser);

      resolve(isLoggedIn);
    });
  });
}

/**
 * 更新登录状态UI
 * @param {boolean} isLoggedIn 是否登录
 * @param {string} userData 用户数据
 */
function updateLoginUI(isLoggedIn, userData) {
  const notLoggedInSection = document.getElementById('not-logged-in');
  const freeUserSection = document.getElementById('free-user');
  const proUserSection = document.getElementById('pro-user');

  if (!notLoggedInSection) return; // 如果UI元素不存在，直接返回

  if (isLoggedIn) {
    // 已登录 - 隐藏未登录区域
    notLoggedInSection.style.display = 'none';

    // 用户信息处理将由checkAuthAndUpdateUI函数处理
  } else {
    // 未登录 - 显示登录区域
    notLoggedInSection.style.display = 'block';
    if (freeUserSection) freeUserSection.style.display = 'none';
    if (proUserSection) proUserSection.style.display = 'none';
  }
}

/**
 * 加载工作时间设置
 */
function loadSettings() {
  try {
    console.log('加载工作时间设置...');

    // 从存储中获取设置
    chrome.storage.sync.get(['startTime', 'endTime', 'countdownDuration'], function(result) {
      // 获取开始时间和结束时间输入框
      const startTimeInput = document.getElementById('start-time');
      const endTimeInput = document.getElementById('end-time');

      // 如果输入框存在则设置值
      if (startTimeInput && result.startTime) {
        startTimeInput.value = result.startTime;
        console.log('已加载开始时间:', result.startTime);
      }
      if (endTimeInput && result.endTime) {
        endTimeInput.value = result.endTime;
        console.log('已加载结束时间:', result.endTime);
      }

      // 如果存在倒计时输入框，设置其值
      const countdownInput = document.getElementById('countdown-minutes');
      if (countdownInput && result.countdownDuration) {
        countdownInput.value = result.countdownDuration;
        console.log('已加载倒计时时长:', result.countdownDuration);
      }
    });
  } catch (error) {
    console.error('加载设置时出错:', error);
  }
}

/**
 * 添加事件监听器
 */
function attachEventListeners() {
  try {
    console.log('添加事件监听器...');

    // 保存设置按钮
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', function() {
        saveTimeSettings();
      });
    }

    // 开始倒计时按钮
    const startCountdownBtn = document.getElementById('start-countdown');
    if (startCountdownBtn) {
      startCountdownBtn.addEventListener('click', function() {
        startCountdown();
      });
    }

    // 隐藏进度条按钮
    const hideProgressBarBtn = document.getElementById('hide-progress-bar');
    if (hideProgressBarBtn) {
      hideProgressBarBtn.addEventListener('click', function() {
        toggleProgressBarVisibility();
      });
    }

    console.log('事件监听器添加完成');
  } catch (error) {
    console.error('添加事件监听器时出错:', error);
  }
}

/**
 * 处理来自background.js的消息
 */
function handleRuntimeMessages(message, sender, sendResponse) {
  console.log('收到来自background的消息:', message);

  // 处理认证状态变化
  if (message.action === 'auth-state-changed') {
    console.log('收到认证状态变化消息');
    checkAuthAndUpdateUI();
    sendResponse({ success: true });
    return true;
  }

  // 处理进度条状态变化
  if (message.action === 'progress-bar-state-changed') {
    console.log('收到进度条状态变化消息:', message.hidden);
    // 更新按钮状态
    const toggleBtn = document.getElementById('toggle-btn');
    if (toggleBtn) {
      updateButtonState(toggleBtn, message.hidden);
    }
    sendResponse({ success: true });
    return true;
  }

  // 处理订阅状态变化
  if (message.action === 'subscription-state-changed') {
    console.log('收到订阅状态变化消息');
    checkSubscriptionStatus();
    sendResponse({ success: true });
    return true;
  }

  return false; // 不处理的消息
}

/**
 * 保存时间设置
 */
function saveTimeSettings() {
  try {
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    if (!startTimeInput || !endTimeInput) {
      console.error('未找到时间设置输入框');
      return;
    }

    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    // 验证输入
    if (!startTime || !endTime) {
      alert('请输入有效的开始和结束时间');
      return;
    }

    // 保存到storage
    chrome.storage.sync.set({
      startTime: startTime,
      endTime: endTime
    }, function() {
      console.log('工作时间已保存:', startTime, '至', endTime);

      // 通知content脚本更新进度条
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateWorkHours',
            startTime: startTime,
            endTime: endTime
          });
        }
      });

      // 显示保存成功提示
      const saveMessage = document.getElementById('save-message');
      if (saveMessage) {
        saveMessage.textContent = '设置已保存!';
        saveMessage.style.display = 'block';

        // 3秒后隐藏提示
        setTimeout(function() {
          saveMessage.style.display = 'none';
        }, 3000);
      }
    });

    // 同时获取倒计时时长并保存（如果存在）
    const countdownInput = document.getElementById('countdown-minutes');
    if (countdownInput && countdownInput.value) {
      const countdownDuration = parseInt(countdownInput.value, 10);
      if (!isNaN(countdownDuration) && countdownDuration > 0) {
        chrome.storage.sync.set({
          countdownDuration: countdownDuration
        }, function() {
          console.log('倒计时时长已保存:', countdownDuration, '分钟');
        });
      }
    }
  } catch (error) {
    console.error('保存设置时出错:', error);
    alert('保存设置失败，请重试');
  }
}

/**
 * 开始倒计时
 */
function startCountdown() {
  try {
    const countdownInput = document.getElementById('countdown-minutes');
    if (!countdownInput) {
      console.error('未找到倒计时输入框');
      return;
    }

    const duration = parseInt(countdownInput.value, 10);
    if (isNaN(duration) || duration <= 0) {
      alert('请输入有效的倒计时时长（分钟）');
      return;
    }

    console.log('开始倒计时:', duration, '分钟');

    // 保存倒计时时长
    chrome.storage.sync.set({
      countdownDuration: duration
    });

    // 向所有标签页发送开始倒计时消息
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'startCountdown',
            duration: duration
          });
        }
      });
    });

    // 显示倒计时已开始提示
    const countdownMessage = document.getElementById('countdown-message');
    if (countdownMessage) {
      countdownMessage.textContent = `${duration}分钟倒计时已开始!`;
      countdownMessage.style.display = 'block';

      // 3秒后隐藏提示
      setTimeout(function() {
        countdownMessage.style.display = 'none';
      }, 3000);
    }
  } catch (error) {
    console.error('开始倒计时时出错:', error);
    alert('开始倒计时失败，请重试');
  }
}

/**
 * 切换进度条可见性
 */
function toggleProgressBarVisibility() {
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const currentlyHidden = result.dayProgressBarHidden || false;
    const newState = !currentlyHidden;

    // 保存新状态
    chrome.storage.sync.set({ 'dayProgressBarHidden': newState }, function() {
      console.log('进度条可见性已更改为:', newState ? '隐藏' : '显示');

      // 向所有标签页发送切换消息
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(function(tab) {
          if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'toggleProgressBar',
              hidden: newState
            });
          }
        });
      });

      // 更新按钮文本
      const hideBtn = document.getElementById('hide-progress-bar');
      if (hideBtn) {
        hideBtn.textContent = newState ? '显示进度条' : '隐藏进度条';
      }
    });
  });
}

/**
 * 设置开关按钮状态
 */
function loadToggleButtonState() {
  chrome.storage.sync.get(['dayProgressBarHidden'], function(result) {
    const isHidden = result.dayProgressBarHidden || false;

    // 更新隐藏/显示按钮状态
    const hideBtn = document.getElementById('hide-progress-bar');
    if (hideBtn) {
      hideBtn.textContent = isHidden ? '显示进度条' : '隐藏进度条';
    }

    console.log('加载进度条状态:', isHidden ? '隐藏' : '显示');
  });
}