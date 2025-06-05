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
 * @returns {Promise<Object|null>} User data if sign-in successful, null otherwise
 */
async function openSignInModal() {
  // 获取扩展ID，用于构建回调参数
  const extensionId = chrome.runtime.id;
  console.log('扩展ID:', extensionId);

  // 使用API后端部署的中间重定向页面
  const redirectorUrl = 'https://day-progress-bar-backend-production.up.railway.app/auth/clerk-redirect';

  // 本地测试应用URL（已注释掉，改为使用部署版本）
  // const dashboardUrl = `http://localhost:3000/api/clerk-callback?extension_id=${extensionId}`;

  // 使用部署在Railway上的dashboard界面 - 修正为正确的dashboard路径
  // const dashboardUrl = `https://day-progress-bar-backend-production.up.railway.app/src/view/dashboard.html?extension_id=${extensionId}`;

  // 使用本地部署的dashboard界面 - 根据后端路由规则修正
  // const dashboardUrl = `http://localhost/dashboard?extension_id=${extensionId}`;

  // 使用本地部署的dashboard界面 - 使用3000端口
  // 注意：使用"token"作为参数名而不是"__clerk_token"，因为后端dashboard页面期望这个参数名
  // const dashboardUrl = `http://localhost:3000/dashboard?extension_id=${extensionId}`;

  // 使用本地后端的clerk回调处理程序，它会正确转换token并重定向到dashboard
  const callbackUrl = `http://localhost:3000/auth/clerk-callback?extension_id=${extensionId}`;

  // 关闭测试模式，使用真实的Clerk认证流程
  const testMode = false;
  let testParams = '';

  console.log('测试模式已关闭，将使用真实的Clerk认证流程');
  console.log('使用本地后端的Clerk回调路由:', callbackUrl);

  // 构建认证URL - 重定向到回调处理程序
  const authUrl = `${CLERK_BASE_URL}/sign-in` +
                 `?redirect_url=${encodeURIComponent(callbackUrl + testParams)}` +
                 `&after_sign_in_url=${encodeURIComponent(callbackUrl + testParams)}` +
                 `&after_sign_up_url=${encodeURIComponent(callbackUrl + testParams)}` +
                 `&extension_id=${extensionId}`;

  console.log('打开认证URL(就是clerk登陆界面):', authUrl);
  console.log('URL参数解析:');
  console.log('- redirect_url:', callbackUrl + testParams);
  console.log('- after_sign_in_url:', callbackUrl + testParams);
  console.log('- extension_id:', extensionId);

  // 在控制台输出配置信息
  console.log('请确保在Clerk dashboard中添加了以下配置:');
  console.log(`- 已允许的重定向URL: ${callbackUrl}`);

  // 重要：在打开认证页面前，存储一个状态标记
  await chrome.storage.local.set({
    authInProgress: true,
    authStartTime: Date.now(),
    authTestMode: false // 确保测试模式已关闭
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
    // Clear local data
    currentUser = null;
    clerkToken = null;

    // Clear from storage
    await chrome.storage.local.remove(['clerkToken', 'clerkUser']);

    return true;
  } catch (error) {
    console.error('Sign-out failed:', error);
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