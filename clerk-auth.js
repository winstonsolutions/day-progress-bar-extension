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
    const response = await fetch(`${CLERK_API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Open authentication page in a new tab
 * @returns {Promise<Object|null>} User data if sign-in successful, null otherwise
 */
async function openSignInModal() {
  // Create a sign-in URL with your Frontend API
  const authUrl = `${CLERK_BASE_URL}/sign-in?redirect_url=${encodeURIComponent(chrome.runtime.getURL('auth-callback.html'))}`;

  console.log('Opening auth URL:', authUrl);

  // Open auth in a new tab/window
  chrome.tabs.create({ url: authUrl });

  // The actual authentication will be handled by the auth-callback.html page
  // which will receive the token and store it

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

  if (token && user) {
    clerkToken = token;
    currentUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    console.log('设置当前用户数据:', currentUser);

    // Store in Chrome storage
    console.log('正在存储到Chrome本地存储...');
    try {
      await chrome.storage.local.set({
        clerkToken: token,
        clerkUser: currentUser
      });
      console.log('Chrome本地存储成功');
    } catch (storageError) {
      console.error('Chrome本地存储失败:', storageError);
    }

    // Store user data in MongoDB
    try {
      console.log('开始调用storeUserData函数...');
      const userData = {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        subscriptionStatus: 'free' // Default to free subscription
      };
      console.log('准备存储的用户数据:', userData);

      const result = await storeUserData(userData);
      console.log('MongoDB存储结果:', result);
    } catch (error) {
      console.error('存储用户数据到MongoDB失败 (handleAuthCallback):', error);
      console.error('错误详情:', error.stack || error);
      // Continue with authentication even if MongoDB storage fails
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

    // 避免使用Authorization头，直接在请求体中包含所有数据
    const requestData = {
      clerkId: currentUser.id,
      email: currentUser.email,
      token: clerkToken, // 将token作为请求体的一部分而不是header
      ...userData
    };

    console.log('发送的请求数据:', JSON.stringify(requestData));

    const response = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

// Export auth functions
export {
  initClerk,
  openSignInModal,
  getCurrentUser,
  isAuthenticated,
  signOut,
  storeUserData,
  handleAuthCallback
};