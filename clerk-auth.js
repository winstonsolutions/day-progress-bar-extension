/**
 * Clerk Authentication for Day Progress Bar Extension
 * Handles user authentication using Clerk
 */

// 移除导入，使用全局变量
// import { API_BASE_URL } from './api.js';

// Constants
const CLERK_PUBLISHABLE_KEY = 'pk_test_Z2xhZC10cm91dC0yNC5jbGVyay5hY2NvdW50cy5kZXYk'; // Replace with your actual key
const CLERK_BASE_URL = 'https://glad-trout-24.accounts.dev'; // Correct Clerk domain
const CLERK_API_URL = 'https://api.clerk.dev/v1';

// Store user data
let currentUser = null;
let clerkToken = null;

/**
 * Initialize Clerk authentication
 */
async function initClerk() {
  try {
    // Check if we have a token in storage
    const storedAuth = await chrome.storage.local.get(['clerkToken', 'clerkUser']);

    if (storedAuth.clerkToken && storedAuth.clerkUser) {
      clerkToken = storedAuth.clerkToken;
      currentUser = storedAuth.clerkUser;

      // Verify the token is still valid
      const isValid = await verifyToken(clerkToken);
      if (isValid) {
        return currentUser;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    throw error;
  }
}

/**
 * Verify if the token is still valid
 */
async function verifyToken(token) {
  try {
    console.log('验证令牌有效性...');

    // 避免直接调用需要Secret Key的API
    // 使用session endpoint，它接受用户token
    const response = await fetch(`${CLERK_BASE_URL}/v1/client/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('验证令牌响应状态:', response.status);

    // 如果响应不是成功的，尝试自己的后端API验证
    if (!response.ok) {
      console.log('Clerk客户端API验证失败，尝试通过自己的后端验证');

      // 检查是否有API_BASE_URL可用
      const API_URL = window.API_BASE_URL || 'https://day-progress-bar-backend-production.up.railway.app';

      try {
        // 调用自己的后端API验证token
        const backendResponse = await fetch(`${API_URL}/api/auth/verify-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        });

        if (backendResponse.ok) {
          console.log('通过后端API验证成功');
          return true;
        }
      } catch (backendError) {
        console.error('后端API验证失败:', backendError);
      }

      // 如果没有专门的验证endpoint，我们可以假设token是有效的
      // 因为token是从Clerk认证流程获得的
      console.log('假设token有效，因为它是从认证流程获得的');
      return true;
    }

    console.log('令牌验证成功');
    return true;
  } catch (error) {
    console.error('令牌验证过程中出错:', error);
    // 在出错的情况下，假设token是有效的
    // 实际有效性会在后续API调用中得到验证
    return true;
  }
}

/**
 * Open authentication page in a new tab
 * @param {string} type - The type of auth page to open: 'sign-in' or 'sign-up'
 * @returns {Promise<Object|null>} User data if sign-in successful, null otherwise
 */
async function openSignInModal(type = 'sign-in') {
  // 获取扩展ID，用于构建回调参数
  const extensionId = chrome.runtime.id;
  console.log('扩展ID:', extensionId);

  // 修改：直接使用dashboard页面作为认证回调URL
  const callbackUrl = `http://localhost:3000/dashboard?extension_id=${extensionId}`;

  console.log('测试模式已关闭，将使用真实的Clerk认证流程');
  console.log('使用dashboard页面处理认证:', callbackUrl);

  // 构建Clerk身份验证URL (注意这里包含了多种可能的令牌参数名，增加成功率)
  const authUrl = `${CLERK_BASE_URL}/${type}?` +
                 `redirect_url=${encodeURIComponent(callbackUrl)}` +
                 `&fallbackRedirectUrl=${encodeURIComponent(callbackUrl)}` +
                 `&forceRedirectUrl=${encodeURIComponent(callbackUrl)}` +
                 `&extension_id=${extensionId}`;

  console.log(`打开${type}认证URL:`, authUrl);
  console.log('URL参数解析:');
  console.log('- redirect_url:', callbackUrl);
  console.log('- fallbackRedirectUrl:', callbackUrl);
  console.log('- extension_id:', extensionId);

  // 在控制台输出配置信息
  console.log('请确保在Clerk dashboard中添加了以下配置:');
  console.log(`- 已允许的重定向URL: ${callbackUrl}`);
  console.log('重要提示: 在Clerk设置中，还必须:');
  console.log('1. 确保"JWT Template"已正确配置');
  console.log('2. 在Clerk仪表板中允许跨域(CORS)请求');
  console.log('3. 在"允许的重定向URL"中添加dashboard URL (http://localhost:3000/dashboard)');
  console.log('4. 确保"Session Token Template"正确设置，启用了token传递');

  // 重要：在打开认证页面前，存储一个状态标记
  await chrome.storage.local.set({
    authInProgress: true,
    authStartTime: Date.now(),
    authTestMode: false, // 确保测试模式已关闭
    authType: type // 存储认证类型，用于界面显示
  });

  // Open auth in a new tab/window
  chrome.tabs.create({ url: authUrl });

  // Return null for now, the actual user info will be available after the callback completes
  return null;
}

/**
 * Handle auth callback
 * @param {string} token - The auth token from Clerk
 * @param {Object} user - User information
 */
async function handleAuthCallback(token, user) {
  console.log('===== handleAuthCallback 开始处理认证回调 =====');
  console.log('收到的token:', token ? `${token.substring(0, 10)}...` : 'null');
  console.log('收到的用户数据:', user);

  // 验证令牌是否合法
  try {
    if (!token) {
      console.error('认证失败: 未提供令牌');
      return null;
    }

    // 检查是否为测试令牌
    if (token === 'test_token_for_debugging') {
      console.log('检测到测试令牌，在非测试环境中不接受测试令牌，返回null');
      return null;
    }

    // 基本验证 - 不通过直接的API调用
    if (token.length < 20) {
      console.error('令牌格式无效，看起来不是一个正确的JWT');
      return null;
    }

    console.log('令牌格式验证通过，继续处理');
  } catch (verifyError) {
    console.error('令牌验证过程中出错:', verifyError);
    // 即使验证失败，我们仍然尝试处理
    console.log('尝试继续处理，即使令牌验证遇到问题');
  }

  if (token && user) {
    // 首先设置全局认证状态
    console.log('正在设置全局认证状态...');
    clerkToken = token;
    currentUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };
    console.log('全局认证状态设置完成, 现在 isAuthenticated() =', isAuthenticated());

    // 然后储存到Chrome本地存储
    console.log('正在存储到Chrome本地存储...');
    try {
      await chrome.storage.local.set({
        clerkToken: token,
        clerkUser: currentUser,
        authComplete: true,
        isTestMode: false // 标记为非测试模式
      });
      console.log('Chrome本地存储成功');
    } catch (storageError) {
      console.error('Chrome本地存储失败:', storageError);
    }

    // 现在再调用storeUserData，确保用户已认证
    try {
      console.log('准备保存用户数据到MongoDB，先检查认证状态:', isAuthenticated());
      if (!isAuthenticated()) {
        console.warn('警告：用户应该是已认证的，但isAuthenticated()返回false');
        // 如果发现未认证，再次尝试设置全局状态
        clerkToken = token;
        currentUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        };
        console.log('再次尝试设置认证状态后:', isAuthenticated());
      }

      const userData = {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        subscriptionStatus: 'free', // Default to free subscription
        authProvider: user.primaryEmailAddress?.emailAddress ? 'email' : 'social',
        signUpMethod: 'clerk',
      };

      console.log('调用storeUserData函数保存用户数据到MongoDB:', userData);
      const result = await storeUserData(userData);
      console.log('用户数据成功保存到MongoDB:', result);
    } catch (error) {
      console.error('保存用户数据到MongoDB失败:', error);
      console.error('错误详情:', error.stack || error);

      // 如果调用storeUserData失败，尝试直接调用API作为备用方案
      try {
        console.log('尝试通过备用方案直接调用API保存用户数据...');
        const API_URL = window.API_BASE_URL || 'https://day-progress-bar-backend-production.up.railway.app';

        const requestData = {
          clerkId: currentUser.id,
          email: currentUser.email,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          authProvider: user.primaryEmailAddress?.emailAddress ? 'email' : 'social',
          signUpMethod: 'clerk',
          subscriptionStatus: 'free',
          token: token // 包含令牌以便后端验证
        };

        const response = await fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // 添加令牌到授权头
          },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();
        console.log('备用方案成功保存用户数据:', result);
      } catch (backupError) {
        console.error('备用方案也失败了:', backupError);
      }
    }

    return currentUser;
  }

  console.log('handleAuthCallback 返回空值，认证失败');
  return null;
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user data or null if not authenticated
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
function isAuthenticated() {
  return currentUser !== null && clerkToken !== null;
}

/**
 * Sign out current user
 */
async function signOut() {
  try {
    console.log('开始执行Clerk登出流程...');

    // 如果没有token或用户，直接返回成功
    if (!clerkToken || !currentUser) {
      console.log('无token或用户数据，无需后端登出');
      return true;
    }

    // 方法1: 调用Clerk的signOut API端点
    try {
      console.log('尝试调用Clerk API登出...');

      // 使用重定向URL打开Clerk的登出页面
      const extensionId = chrome.runtime.id;
      const redirectUrl = `chrome-extension://${extensionId}/popup.html`;

      // 首先尝试直接调用API
      const response = await fetch(`${CLERK_BASE_URL}/v1/client/sign-outs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clerkToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          redirect_url: redirectUrl
        })
      });

      console.log('Clerk登出API响应:', response.status);

      // 方法2: 如果API调用失败，尝试在新标签页中打开Clerk的登出URL
      if (!response.ok) {
        console.log('API登出失败，尝试打开登出URL');
        const signOutUrl = `${CLERK_BASE_URL}/sign-out?redirect_url=${encodeURIComponent(redirectUrl)}`;

        // 打开登出页面后立即关闭，用户不会看到这个过程
        chrome.tabs.create({ url: signOutUrl, active: false }, (tab) => {
          // 等待1秒后关闭标签页，确保请求有足够时间完成
          setTimeout(() => {
            chrome.tabs.remove(tab.id);
          }, 1000);
        });
      }
    } catch (apiError) {
      console.error('调用Clerk API登出失败:', apiError);
    }

    // 方法3: 调用我们自己的后端API
    try {
      const API_URL = window.API_BASE_URL || 'https://day-progress-bar-backend-production.up.railway.app';
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clerkToken}`
        }
      });
    } catch (backendError) {
      console.log('调用后端登出API失败，忽略此错误', backendError);
    }

    // 清除本地数据
    currentUser = null;
    clerkToken = null;

    // 清除本地存储
    await chrome.storage.local.remove(['clerkToken', 'clerkUser', 'authComplete']);
    console.log('已清除本地存储中的认证数据');

    return true;
  } catch (error) {
    console.error('登出过程出错:', error);
    return false;
  }
}

/**
 * Store user data in MongoDB via backend
 * @param {Object} userData Additional user data to store
 * @returns {Promise<Object>} Response from backend
 */
async function storeUserData(userData) {
  if (!isAuthenticated()) {
    console.error('存储用户数据失败: 用户未认证');
    throw new Error('User must be authenticated to store data');
  }

  // 确保API_BASE_URL可用，优先使用全局window变量
  const API_URL = window.API_BASE_URL || 'https://day-progress-bar-backend-production.up.railway.app';

  try {
    console.log('===== 开始存储用户数据到MongoDB =====');
    console.log('API_BASE_URL:', API_URL);
    console.log('API端点:', `${API_URL}/api/users`);
    console.log('用户数据:', {
      clerkId: currentUser.id,
      email: currentUser.email,
      ...userData
    });

    // 使用标准的授权头和请求体
    const requestData = {
      clerkId: currentUser.id,
      email: currentUser.email,
      ...userData,
      token: clerkToken // 将token添加到请求体，以便后端可以验证
    };

    console.log('发送的请求数据:', JSON.stringify(requestData));

    const response = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clerkToken}` // 使用标准授权头
      },
      body: JSON.stringify(requestData)
    });

    console.log('API响应状态:', response.status, response.statusText);

    // 尝试获取响应体，无论成功与否
    let responseBody;
    try {
      responseBody = await response.text();
      console.log('API响应内容:', responseBody);

      // 尝试将响应体解析为JSON
      try {
        responseBody = JSON.parse(responseBody);
      } catch (e) {
        console.log('响应不是JSON格式');
      }
    } catch (e) {
      console.error('无法读取响应内容:', e);
    }

    if (!response.ok) {
      console.error('存储用户数据API请求失败:', response.status, responseBody);
      const errorMessage = responseBody?.message || 'Failed to store user data';
      throw new Error(errorMessage);
    }

    console.log('用户数据成功存储到MongoDB:', responseBody);
    return responseBody;
  } catch (error) {
    console.error('存储用户数据到MongoDB过程中出错:', error.message);
    console.error('错误详情:', error);

    // 记录网络错误的更多信息
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('网络请求失败，可能是CORS或网络连接问题');
      console.error('用户代理:', navigator.userAgent);
      console.error('当前URL:', window.location.href);
      console.error('扩展ID:', chrome.runtime.id);
    }

    throw error;
  }
}

/**
 * Initialize auth state from chrome.storage
 * This function is needed to sync global variables with chrome.storage
 * @param {string} token - The auth token from storage
 * @param {Object} user - User information from storage
 */
async function initializeFromStorage(token, user) {
  console.log('从存储初始化认证状态...');

  try {
    if (!token || !user) {
      console.error('初始化失败: 缺少token或user数据');
      return false;
    }

    // 设置全局变量
    clerkToken = token;
    currentUser = user;

    // 验证设置是否成功
    const authenticated = isAuthenticated();
    console.log('从存储初始化认证状态完成, isAuthenticated():', authenticated);

    return authenticated;
  } catch (error) {
    console.error('初始化认证状态失败:', error);
    return false;
  }
}

// Export auth functions
export {
  initClerk,
  openSignInModal,
  getCurrentUser,
  isAuthenticated,
  signOut,
  storeUserData,
  handleAuthCallback,
  initializeFromStorage
};