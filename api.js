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

// Supabase配置
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

// 加载Supabase URL和匿名密钥
try {
  chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], function(result) {
    SUPABASE_URL = result.supabaseUrl || '';
    SUPABASE_ANON_KEY = result.supabaseAnonKey || '';
    console.log('Supabase配置已加载', { SUPABASE_URL: SUPABASE_URL ? '已配置' : '未配置' });
  });
} catch (e) {
  console.error('无法加载Supabase配置:', e);
}

// Supabase客户端对象
let supabaseClient = null;

/**
 * 初始化Supabase客户端
 * @param {string} url - Supabase项目URL
 * @param {string} anonKey - Supabase匿名公共密钥
 * @returns {Object} - Supabase客户端实例
 */
function initSupabase(url = null, anonKey = null) {
  // 如果没有提供参数，使用已存储的值
  const supabaseUrl = url || SUPABASE_URL;
  const supabaseAnonKey = anonKey || SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL或匿名密钥未设置');
    return null;
  }

  try {
    // 检查是否已加载Supabase
    if (typeof supabase === 'undefined') {
      console.error('Supabase客户端库未加载。请确保在HTML中包含了supabase-js脚本');
      return null;
    }

    // 创建客户端
    supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase客户端初始化成功');

    // 存储配置到chrome.storage.local
    chrome.storage.local.set({ supabaseUrl: supabaseUrl, supabaseAnonKey: supabaseAnonKey });

    return supabaseClient;
  } catch (error) {
    console.error('初始化Supabase客户端失败:', error);
    return null;
  }
}

/**
 * 设置Supabase配置
 * @param {string} url - Supabase项目URL
 * @param {string} anonKey - Supabase匿名公共密钥
 */
function setSupabaseConfig(url, anonKey) {
  SUPABASE_URL = url;
  SUPABASE_ANON_KEY = anonKey;
  return initSupabase(url, anonKey);
}

/**
 * 使用Supabase获取用户信息
 * @param {string} clerkId - Clerk用户ID
 * @returns {Promise<Object>} - 用户数据
 */
async function getUserFromSupabase(clerkId) {
  if (!supabaseClient) {
    try {
      supabaseClient = initSupabase();
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return null;
    }
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .single();

    if (error) {
      console.error('从Supabase获取用户数据失败:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Supabase查询失败:', error);
    return null;
  }
}

/**
 * 使用Supabase创建或更新用户
 * @param {Object} userData - 用户数据
 * @param {string} userData.clerkId - Clerk用户ID
 * @param {string} userData.email - 用户邮箱
 * @param {string} userData.firstName - 用户名
 * @param {string} userData.lastName - 用户姓
 * @returns {Promise<Object>} - 创建/更新的用户数据
 */
async function createOrUpdateUserInSupabase(userData) {
  if (!supabaseClient) {
    try {
      supabaseClient = initSupabase();
      if (!supabaseClient) {
        throw new Error('Supabase客户端未初始化');
      }
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return { error: e.message };
    }
  }

  try {
    // 先检查用户是否存在
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('clerk_id', userData.clerkId)
      .maybeSingle();

    if (existingUser) {
      // 更新用户
      const updateData = {
        email: userData.email,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        updated_at: new Date().toISOString()
      };

      // 如果提供了trial_started_at，也更新它
      if (userData.trial_started_at) {
        updateData.trial_started_at = userData.trial_started_at;
      }

      const { data, error } = await supabaseClient
        .from('users')
        .update(updateData)
        .eq('clerk_id', userData.clerkId)
        .select()
        .single();

      if (error) {
        console.error('更新Supabase用户失败:', error);
        return { error: error.message };
      }

      return { data, updated: true };
    } else {
      // 创建用户
      const insertData = {
        clerk_id: userData.clerkId,
        email: userData.email,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 如果提供了trial_started_at，也添加它
      if (userData.trial_started_at) {
        insertData.trial_started_at = userData.trial_started_at;
      }

      const { data, error } = await supabaseClient
        .from('users')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('创建Supabase用户失败:', error);
        return { error: error.message };
      }

      return { data, created: true };
    }
  } catch (error) {
    console.error('Supabase操作失败:', error);
    return { error: error.message };
  }
}

/**
 * 使用Supabase验证许可证
 * @param {string} licenseKey - 许可证密钥
 * @returns {Promise<Object>} - 许可证信息
 */
async function verifyLicenseWithSupabase(licenseKey) {
  if (!supabaseClient) {
    try {
      supabaseClient = initSupabase();
      if (!supabaseClient) {
        throw new Error('Supabase客户端未初始化');
      }
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return { valid: false, error: e.message };
    }
  }

  try {
    // 查询许可证数据
    const { data, error } = await supabaseClient
      .from('licenses')
      .select('*, users(email)')
      .eq('license_key', licenseKey)
      .single();

    if (error) {
      return { valid: false, message: '无效的许可证密钥' };
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    const isValid = expiresAt > now;

    return {
      valid: isValid,
      expiresAt: data.expires_at,
      email: data.users?.email,
      message: isValid ? '许可证有效' : '许可证已过期'
    };
  } catch (error) {
    console.error('Supabase许可证验证失败:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * 创建结账会话
 * @param {number} priceInUSD - 价格（美元）
 * @param {string} email - 用户邮箱
 * @param {boolean} isOneTime - 是否为一次性购买（而非订阅）
 * @returns {Promise<Object>} - 包含会话URL的对象
 */
async function createCheckoutSession(priceInUSD, email = null, isOneTime = false) {
  try {
    console.log(`创建${isOneTime ? '一次性购买' : '订阅'}结账会话, 价格: $${priceInUSD}`);

    // 检查是否使用模拟结账流程
    let useMockCheckout = false;

    // 在Service Worker中，我们无法访问window.location，所以使用配置或默认值
    chrome.storage.local.get(['useMockCheckout'], function(result) {
      useMockCheckout = result.useMockCheckout === true;
    });

    if (useMockCheckout) {
      console.log('使用模拟结账流程');
      await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟网络请求延迟

      // 生成模拟的许可证密钥
      if (isOneTime) {
        const mockLicenseKey = generateMockLicenseKey();
        storeLicenseKey(mockLicenseKey, email);
        // 在Service Worker中无法使用alert，记录到控制台
        console.log(`模拟购买成功！许可证密钥: ${mockLicenseKey}`);
        return {
          sessionUrl: 'http://localhost:3000/account',
          success: true
        };
      }

      return {
        sessionUrl: 'https://mock-checkout.example.com/session?success=true',
        success: true
      };
    }

    // 根据是否为一次性购买构建不同的API路径
    const apiPath = isOneTime ? '/create-one-time-checkout' : '/create-subscription-checkout';

    // 构建API请求URL
    const apiUrl = `${API_BASE_URL}${apiPath}`;

    // 准备请求数据
    const requestData = {
      priceInUSD,
      email,
      returnUrl: `http://localhost:3000/payment-success`,
      cancelUrl: `http://localhost:3000/payment-cancel`
    };

    // 发送API请求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`服务器返回错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error('服务器未返回有效的结账URL');
    }

    return {
      sessionUrl: data.url,
      success: true
    };
  } catch (error) {
    console.error('创建结账会话失败:', error);

    // 尝试使用本地模拟结账流程作为后备选项
    if (isOneTime) {
      console.log('使用后备模拟结账流程');
      const mockLicenseKey = generateMockLicenseKey();
      storeLicenseKey(mockLicenseKey, email);
      return {
        sessionUrl: `http://localhost:3000/payment-success?email=${encodeURIComponent(email)}&license=${encodeURIComponent(mockLicenseKey)}`,
        success: true,
        licenseKey: mockLicenseKey
      };
    }

    return { success: false, error: error.message };
  }
}

/**
 * 生成模拟的许可证密钥
 * @returns {string} - 生成的许可证密钥
 */
function generateMockLicenseKey() {
  const prefix = 'DPBAR';
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let key = prefix + '-';

  // 生成 4-4-4 格式的密钥
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      key += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    if (i < 2) key += '-';
  }

  return key;
}

/**
 * 在本地存储许可证密钥
 * @param {string} licenseKey - 许可证密钥
 * @param {string} email - 关联的邮箱
 */
function storeLicenseKey(licenseKey, email) {
  try {
    // 获取现有的许可证列表
    chrome.storage.local.get(['validLicenses'], (result) => {
      const licenses = result.validLicenses || [];

      // 添加新许可证
      licenses.push({
        key: licenseKey,
        email: email,
        createdAt: Date.now(),
        isActive: false
      });

      // 保存更新后的列表
      chrome.storage.local.set({ validLicenses: licenses }, () => {
        console.log('许可证密钥已保存:', licenseKey);
      });
    });
  } catch (error) {
    console.error('保存许可证密钥失败:', error);
  }
}

/**
 * 验证许可证
 * @param {string} licenseKey - 许可证密钥
 * @returns {Promise<Object>} - 验证结果
 */
async function verifyLicense(licenseKey) {
  try {
    console.log('验证许可证密钥:', licenseKey);

    // 首先检查本地存储的许可证
    const localResult = await verifyLocalLicense(licenseKey);
    if (localResult.valid) {
      return localResult;
    }

    // 如果本地验证失败，则使用Supabase验证
    if (supabaseClient) {
      return await verifyLicenseWithSupabase(licenseKey);
    }

    // 如果Supabase未配置，则使用模拟验证
    return mockVerifyLicense(licenseKey);
  } catch (error) {
    console.error('验证许可证时出错:', error);
    return { valid: false, message: error.message };
  }
}

/**
 * 在本地验证许可证
 * @param {string} licenseKey - 许可证密钥
 * @returns {Promise<Object>} - 验证结果
 */
async function verifyLocalLicense(licenseKey) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['validLicenses'], (result) => {
      const licenses = result.validLicenses || [];
      const matchedLicense = licenses.find(license => license.key === licenseKey);

      if (matchedLicense) {
        resolve({
          valid: true,
          email: matchedLicense.email,
          createdAt: matchedLicense.createdAt
        });
      } else {
        resolve({ valid: false, message: '在本地未找到此许可证' });
      }
    });
  });
}

/**
 * 模拟验证许可证
 * @param {string} licenseKey - 许可证密钥
 * @returns {Object} - 验证结果
 */
function mockVerifyLicense(licenseKey) {
  // 简单验证格式: DPBAR-XXXX-XXXX-XXXX
  const licensePattern = /^DPBAR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  if (licensePattern.test(licenseKey)) {
    return {
      valid: true,
      message: '许可证有效',
      expiresAt: null  // 永久许可证
    };
  }

  return {
    valid: false,
    message: '无效的许可证格式'
  };
}

/**
 * 请求许可证密钥（通过邮件发送）
 * @param {string} email - 用户邮箱
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function requestLicenseKey(email) {
  const response = await fetch(`${API_BASE_URL}/api/licenses/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to request license key');
  }

  return await response.json();
}

/**
 * 验证支付状态
 * @param {string} transactionId - 交易ID
 * @returns {Promise<{paid: boolean, subscription: object}>}
 */
async function verifyPaymentStatus(transactionId) {
  const response = await fetch(`${API_BASE_URL}/api/verify-payment-status/${transactionId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to verify payment status');
  }

  return await response.json();
}

/**
 * 测试后端API连接和MongoDB状态
 * @returns {Promise<Object>} 后端状态信息
 */
async function testBackendConnection() {
  try {
    console.log('正在测试后端连接...');
    // 先测试基础API
    const rootResponse = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!rootResponse.ok) {
      throw new Error(`API根路径请求失败: ${rootResponse.status} ${rootResponse.statusText}`);
    }

    const rootData = await rootResponse.json();
    console.log('API根路径响应:', rootData);

    // 测试用户创建API
    const testUserData = {
      clerkId: `test-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'User'
    };

    console.log('尝试创建测试用户:', testUserData);
    const userResponse = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUserData)
    });

    const userData = await userResponse.text();
    let parsedUserData;
    try {
      parsedUserData = JSON.parse(userData);
    } catch (e) {
      console.error('无法解析用户API响应为JSON');
    }

    return {
      apiStatus: rootData,
      userApiStatus: {
        statusCode: userResponse.status,
        statusText: userResponse.statusText,
        success: userResponse.ok,
        data: parsedUserData || userData
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('后端连接测试失败:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };
  }
}

/**
 * 直接创建或更新用户数据（用于OAuth登录）
 * @param {Object} userData 用户数据对象
 * @returns {Promise<Object>} API响应
 */
async function createOrUpdateUser(userData) {
  try {
    console.log('直接创建/更新用户:', userData);

    // 添加额外的用户代理等调试信息
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Info': navigator.userAgent,
        'X-Extension-ID': chrome.runtime.id || 'unknown'
      },
      body: JSON.stringify(userData)
    });

    // 详细记录响应
    console.log('API响应状态:', response.status, response.statusText);

    let responseData;
    try {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch (e) {
        responseData = text;
      }
    } catch (e) {
      responseData = { error: 'Could not read response' };
    }

    return {
      status: response.status,
      ok: response.ok,
      data: responseData
    };
  } catch (error) {
    console.error('创建/更新用户时出错:', error);
    return {
      status: 0,
      ok: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 更新用户试用状态
 * @param {string} clerkId - Clerk用户ID
 * @param {string} trialStartedAt - 试用开始时间（ISO格式）
 * @returns {Promise<Object>} - 更新结果
 */
async function updateUserTrialStatus(clerkId, trialStartedAt) {
  if (!supabaseClient) {
    try {
      supabaseClient = initSupabase();
      if (!supabaseClient) {
        throw new Error('Supabase客户端未初始化');
      }
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return { error: e.message };
    }
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .update({
        trial_started_at: trialStartedAt,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', clerkId)
      .select()
      .single();

    if (error) {
      console.error('更新用户试用状态失败:', error);
      return { error: error.message };
    }

    return { data, updated: true };
  } catch (error) {
    console.error('更新用户试用状态时出错:', error);
    return { error: error.message };
  }
}

// 导出所有API函数
const DayProgressBarAPI = {
  initSupabase,
  setSupabaseConfig,
  getUserFromSupabase,
  createOrUpdateUserInSupabase,
  verifyLicenseWithSupabase,
  updateUserTrialStatus
};

// 确保在全局对象中可用
self.DayProgressBarAPI = DayProgressBarAPI;

// 支持CommonJS模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DayProgressBarAPI;
}