/**
 * API Utilities for Day Progress Bar Extension
 * 管理与后端API的所有通信
 */

console.log('Loading api.js module...');

// API基础URL - 检查是否应该使用本地部署
let API_BASE_URL = 'http://localhost'; // 本地部署URL（默认）

// 检查是否应该使用本地部署
try {
  // 使用chrome.storage.local替代localStorage
  chrome.storage.local.get(['useLocalBackend'], function(result) {
    if(result.useLocalBackend === true) {
      API_BASE_URL = 'http://localhost'; // 本地部署URL
      console.log('使用本地部署的后端 API:', API_BASE_URL);
    } else {
      console.log('使用本地部署的后端 API:', API_BASE_URL);
    }
  });
} catch (e) {
  console.error('无法访问存储:', e);
}

// 确保在全局可以访问API_BASE_URL
self.API_BASE_URL = API_BASE_URL;

console.log('API_BASE_URL set to global:', API_BASE_URL);

/**
 * 测试与后端的连接
 * @returns {Promise<boolean>} 连接是否成功
 */
async function testBackendConnection() {
  try {
    console.log('测试后端连接...');

    // 发送测试请求到后端
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`后端响应异常: ${response.status}`);
    }

    const data = await response.json();
    console.log('后端连接测试成功:', data);
    return true;
  } catch (error) {
    console.error('后端连接测试失败:', error);
    return false;
  }
}

/**
 * 创建或更新用户
 * 先尝试本地后端，如果失败则返回模拟数据
 * @param {Object} userData - 用户数据
 * @returns {Promise<Object>} - 用户数据
 */
async function createOrUpdateUser(userData) {
  try {
    // 尝试与本地后端通信
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`后端响应异常: ${response.status}`);
    }

    const data = await response.json();
    console.log('用户数据同步成功:', data);
    return { data, source: 'local_backend' };
  } catch (error) {
    console.error('无法与本地后端通信，使用模拟数据:', error);

    // 返回模拟数据
    return {
      data: {
        id: 'local_' + Math.random().toString(36).substr(2, 9),
        clerk_id: userData.clerkId,
        email: userData.email,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        trial_started_at: userData.trial_started_at || null
      },
      source: 'mock'
    };
  }
}

/**
 * 更新用户试用状态
 * @param {string} userId - 用户ID
 * @param {string} trialStartedAt - 试用开始时间
 * @returns {Promise<Object>} - 更新结果
 */
async function updateUserTrialStatus(userId, trialStartedAt) {
  try {
    // 尝试与本地后端通信
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trial_started_at: trialStartedAt })
    });

    if (!response.ok) {
      throw new Error(`后端响应异常: ${response.status}`);
    }

    const data = await response.json();
    console.log('用户试用状态更新成功:', data);
    return { data, source: 'local_backend' };
  } catch (error) {
    console.error('无法更新用户试用状态，使用模拟数据:', error);

    // 返回模拟数据
    return {
      data: {
        id: userId,
        trial_started_at: trialStartedAt,
        updated_at: new Date().toISOString()
      },
      source: 'mock'
    };
  }
}

/**
 * 检查用户许可状态
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} - 许可状态
 */
async function checkUserLicense(userId) {
  try {
    // 尝试与本地后端通信
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/license`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`后端响应异常: ${response.status}`);
    }

    const data = await response.json();
    console.log('用户许可状态检查成功:', data);
    return { data, source: 'local_backend' };
  } catch (error) {
    console.error('无法检查用户许可状态，使用模拟数据:', error);

    // 返回模拟数据 - 假设所有用户都有有效的许可
    return {
      data: {
        id: userId,
        license_valid: true,
        license_type: 'pro', // 或者 'trial'
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天后
      },
      source: 'mock'
    };
  }
}

// 导出API函数
self.DayProgressBarAPI = {
  testBackendConnection,
  createOrUpdateUser,
  updateUserTrialStatus,
  checkUserLicense
};

// 确保在全局对象中可用
self.DayProgressBarAPI = self.DayProgressBarAPI;

// 支持CommonJS模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = self.DayProgressBarAPI;
}