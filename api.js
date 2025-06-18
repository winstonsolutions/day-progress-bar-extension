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

// 尝试从全局配置获取Supabase配置
try {
  if (self.SUPABASE_CONFIG) {
    console.log('从全局SUPABASE_CONFIG获取配置');
    SUPABASE_URL = self.SUPABASE_CONFIG.SUPABASE_URL || '';
    SUPABASE_ANON_KEY = self.SUPABASE_CONFIG.SUPABASE_ANON_KEY || '';
    console.log('Supabase配置已加载', { SUPABASE_URL: SUPABASE_URL ? '已配置' : '未配置' });
  } else {
    console.log('全局SUPABASE_CONFIG不存在，尝试从storage获取');
  }
} catch (e) {
  console.error('访问全局SUPABASE_CONFIG失败:', e);
}

// 加载Supabase URL和匿名密钥（如果全局配置不可用）
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  try {
    chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], function(result) {
      SUPABASE_URL = result.supabaseUrl || '';
      SUPABASE_ANON_KEY = result.supabaseAnonKey || '';
      console.log('从chrome.storage加载的Supabase配置:', { SUPABASE_URL: SUPABASE_URL ? '已配置' : '未配置' });
    });
  } catch (e) {
    console.error('无法加载Supabase配置:', e);
  }
}

// Supabase客户端对象
let supabaseClient = null;

/**
 * 初始化Supabase客户端
 * @param {string} url - Supabase项目URL
 * @param {string} anonKey - Supabase匿名公共密钥
 * @returns {Object|Promise} - Supabase客户端实例或Promise
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
      console.log('等待Supabase客户端库加载...');
      // 可能需要延迟初始化，返回一个延迟初始化的Promise
      return new Promise((resolve) => {
        // 尝试每100ms检查一次，最多尝试10次
        let attempts = 0;
        const checkInterval = setInterval(() => {
          if (typeof supabase !== 'undefined' || attempts >= 10) {
            clearInterval(checkInterval);
            if (typeof supabase !== 'undefined') {
              console.log('Supabase客户端库已加载，继续初始化...');
              const client = supabase.createClient(supabaseUrl, supabaseAnonKey);
              console.log('Supabase客户端初始化成功');

              // 存储配置到chrome.storage.local
              chrome.storage.local.set({ supabaseUrl: supabaseUrl, supabaseAnonKey: supabaseAnonKey });

              supabaseClient = client;
              resolve(client);
            } else {
              console.error('Supabase客户端库加载超时');
              resolve(null);
            }
          }
          attempts++;
        }, 100);
      });
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
      console.log('Supabase客户端未初始化，尝试初始化...');
      const client = await initSupabase();
      if (!client) {
        throw new Error('无法初始化Supabase客户端');
      }
      supabaseClient = client;
      console.log('Supabase客户端初始化成功');
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return null;
    }
  }

  try {
    console.log('开始查询Supabase用户，clerk_id:', clerkId);
    console.log('使用的Supabase URL:', SUPABASE_URL);

    // 检查参数有效性
    if (!clerkId || typeof clerkId !== 'string') {
      console.error('无效的clerk_id参数:', clerkId);
      return null;
    }

    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('clerk_id', clerkId)
      .maybeSingle();

    if (error) {
      console.error('从Supabase获取用户数据失败:', error);
      return null;
    }

    // 如果找到了用户，直接返回
    if (data) {
      console.log('成功找到Supabase用户:', data.id);
      return data;
    } else {
      console.log('在Supabase中未找到用户，clerk_id:', clerkId);
    }

    return null;
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
      const client = await initSupabase();
      if (!client) {
        throw new Error('无法初始化Supabase客户端');
      }
      supabaseClient = client;
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
      const client = await initSupabase();
      if (!client) {
        throw new Error('无法初始化Supabase客户端');
      }
      supabaseClient = client;
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

/**
 * 检查用户是否有有效的许可证
 * @param {string} userId - Supabase用户ID
 * @returns {Promise<Object>} - 许可证信息，如果没有则返回null
 */
async function checkUserLicense(userId) {
  if (!supabaseClient) {
    try {
      console.log('Supabase客户端未初始化，尝试初始化...');
      const client = await initSupabase();
      if (!client) {
        throw new Error('无法初始化Supabase客户端');
      }
      supabaseClient = client;
      console.log('Supabase客户端初始化成功');
    } catch (e) {
      console.error('无法初始化Supabase客户端:', e);
      return null;
    }
  }

  try {
    console.log('开始查询用户许可证，user_id:', userId);

    // 检查参数有效性
    if (!userId || typeof userId !== 'string') {
      console.error('无效的user_id参数:', userId);
      return null;
    }

    const { data, error } = await supabaseClient
      .from('licenses')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('从Supabase获取许可证数据失败:', error);
      return null;
    }

    // 如果找到了许可证
    if (data) {
      console.log('成功找到有效许可证:', data.id);
      return {
        licenseKey: data.license_key,
        isActive: data.active,
        expiresAt: data.expires_at
      };
    } else {
      console.log('未找到有效许可证，user_id:', userId);
      return null;
    }
  } catch (error) {
    console.error('Supabase许可证查询失败:', error);
    return null;
  }
}

// 导出所有API函数
const DayProgressBarAPI = {
  initSupabase,
  setSupabaseConfig,
  getUserFromSupabase,
  createOrUpdateUserInSupabase,
  updateUserTrialStatus,
  testBackendConnection,
  createOrUpdateUser,
  checkUserLicense
};

// 确保在全局对象中可用
self.DayProgressBarAPI = DayProgressBarAPI;

// 支持CommonJS模块导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DayProgressBarAPI;
}