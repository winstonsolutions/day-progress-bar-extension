/**
 * API Utilities for Day Progress Bar Extension
 * 管理与后端API的所有通信
 */

console.log('Loading api.js module...');

// API基础URL - 检查是否应该使用本地部署
let API_BASE_URL = 'http://localhost'; // 本地部署URL（默认）

// 检查是否应该使用本地部署
try {
  // 可以通过localStorage中的标志来控制是否使用本地部署
  if(localStorage.getItem('useLocalBackend') === 'true') {
    API_BASE_URL = 'http://localhost'; // 本地部署URL
    console.log('使用本地部署的后端 API:', API_BASE_URL);
  } else {
    console.log('使用本地部署的后端 API:', API_BASE_URL);
  }
} catch (e) {
  console.error('无法访问localStorage:', e);
}

// 确保在clerk-auth.js等其他文件中可以访问API_BASE_URL
window.API_BASE_URL = API_BASE_URL;

console.log('API_BASE_URL set to global window:', API_BASE_URL);

// Supabase配置
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

// 加载Supabase URL和匿名密钥
try {
  SUPABASE_URL = localStorage.getItem('supabaseUrl') || '';
  SUPABASE_ANON_KEY = localStorage.getItem('supabaseAnonKey') || '';
  console.log('Supabase配置已加载', { SUPABASE_URL: SUPABASE_URL ? '已配置' : '未配置' });
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

    // 存储配置到localStorage
    localStorage.setItem('supabaseUrl', supabaseUrl);
    localStorage.setItem('supabaseAnonKey', supabaseAnonKey);

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
      const { data, error } = await supabaseClient
        .from('users')
        .update({
          email: userData.email,
          first_name: userData.firstName || null,
          last_name: userData.lastName || null,
          updated_at: new Date().toISOString()
        })
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
      const { data, error } = await supabaseClient
        .from('users')
        .insert({
          clerk_id: userData.clerkId,
          email: userData.email,
          first_name: userData.firstName || null,
          last_name: userData.lastName || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('创建Supabase用户失败:', error);
        return { error: error.message };
      }

      return { data, created: true };
    }
  } catch (error) {
    console.error('Supabase用户操作失败:', error);
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
 * 创建Stripe结账会话
 * @param {number} priceInUSD - 订阅的价格（USD）
 * @param {string} [email] - 用户邮箱，用于发送license key
 * @returns {Promise<{sessionUrl: string}>} - Stripe结账会话URL
 */
async function createCheckoutSession(priceInUSD, email = null) {
  // 获取扩展ID，用于构建完整的回调URL
  const extensionId = chrome.runtime.id;

  // 使用重定向URL解决Stripe不接受chrome-extension://开头URL的问题
  const successUrl = `${API_BASE_URL}/api/stripe/redirect?destination=${encodeURIComponent(`chrome-extension://${extensionId}/subscription.html?payment_success=true`)}`;
  const cancelUrl = `${API_BASE_URL}/api/stripe/redirect?destination=${encodeURIComponent(`chrome-extension://${extensionId}/subscription.html?payment_cancelled=true`)}`;

  try {
    // 调试信息
    console.log('发送请求到:', `${API_BASE_URL}/api/stripe/create-checkout-session`);
    console.log('请求参数:', {
      priceInUSD,
      email,
      successUrl,
      cancelUrl
    });

    // 尝试发送请求前先检查网络连接
    try {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceInUSD,
          email,
          successUrl,
          cancelUrl
        })
      });

      // 检查响应状态
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`404: 支付服务端点不存在。请确认后端服务是否已部署并配置了正确的路由。`);
        }

        // 尝试获取响应内容
        let errorText = '';
        try {
          // 尝试读取响应文本
          errorText = await response.text();

          // 尝试解析为JSON
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || `API错误 (${response.status}): ${response.statusText}`);
          } catch (jsonError) {
            // 如果不是JSON，显示文本前100个字符
            console.error('API返回非JSON响应:', errorText.substring(0, 100) + '...');
            throw new Error(`API返回格式错误 (${response.status}): 不是有效的JSON响应`);
          }
        } catch (textError) {
          console.error('无法读取API响应内容:', textError);
          throw new Error(`API错误 (${response.status}): ${response.statusText}`);
        }
      }

      // 尝试解析JSON响应
      try {
        const data = await response.json();
        console.log('API响应成功:', data);
        return data;
      } catch (jsonError) {
        console.error('解析API响应JSON失败:', jsonError);
        throw new Error('无法解析API响应为JSON格式');
      }
    } catch (fetchError) {
      // 处理网络错误
      if (fetchError.message && fetchError.message.includes('Failed to fetch')) {
        throw new Error('网络连接失败：无法连接到支付服务器。请检查您的网络连接或服务器状态。');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('创建结账会话失败:', error);
    throw error;
  }
}

/**
 * 验证许可证密钥
 * @param {string} licenseKey - 需要验证的许可证密钥
 * @returns {Promise<{valid: boolean, expiresAt: string, email: string, message?: string}>}
 */
async function verifyLicense(licenseKey) {
  const response = await fetch(`${API_BASE_URL}/api/licenses/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ licenseKey })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Invalid license key');
  }

  return await response.json();
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

// 导出所有API函数
export {
  API_BASE_URL,
  createCheckoutSession,
  verifyLicense,
  requestLicenseKey,
  verifyPaymentStatus,
  testBackendConnection,
  createOrUpdateUser,
  // Supabase函数
  initSupabase,
  setSupabaseConfig,
  getUserFromSupabase,
  createOrUpdateUserInSupabase,
  verifyLicenseWithSupabase
};