import { handleAuthCallback } from './clerk-auth.js';
import { createOrUpdateUser } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const messageEl = document.getElementById('message');
  const debugInfoEl = document.getElementById('debug-info');
  const showDebugBtn = document.getElementById('show-debug');
  const closeTabBtn = document.getElementById('close-tab');

  // 确认API_BASE_URL设置
  console.log('确认global API_BASE_URL:', window.API_BASE_URL);
  if (!window.API_BASE_URL) {
    window.API_BASE_URL = 'https://day-progress-bar-backend-production.up.railway.app';
    console.log('在DOMContentLoaded中重设API_BASE_URL:', window.API_BASE_URL);
  }

  // Debug info container
  let debugInfo = {
    url: window.location.href,
    search: window.location.search,
    timestamp: new Date().toISOString(),
    extensionId: chrome.runtime.id,
    apiBaseUrl: window.API_BASE_URL,
    steps: []
  };

  // 默认显示调试信息
  debugInfoEl.style.display = 'block';

  // Toggle debug info visibility
  showDebugBtn.addEventListener('click', () => {
    debugInfoEl.style.display = debugInfoEl.style.display === 'block' ? 'none' : 'block';
  });

  // Close tab button
  closeTabBtn.addEventListener('click', () => {
    window.close();
  });

  function addDebugStep(step, data = null) {
    const stepInfo = {
      step,
      time: new Date().toISOString(),
      ...(data && { data })
    };
    debugInfo.steps.push(stepInfo);

    // 添加到控制台便于调试
    console.log(`[DEBUG] ${step}`, data || '');

    debugInfoEl.textContent = JSON.stringify(debugInfo, null, 2);
  }

  addDebugStep('Callback page loaded');

  // 添加重要的信息日志
  addDebugStep('环境信息', {
    extensionId: chrome.runtime.id,
    userAgent: navigator.userAgent,
    url: window.location.href,
    referrer: document.referrer || '无引荐来源'
  });

  try {
    // 如果是从中间重定向页面来的，记录下来
    if (document.referrer && document.referrer.includes('day-progress-bar-backend-production.up.railway.app')) {
      addDebugStep('来自中间重定向页面', { referrer: document.referrer });
    }

    // Get token and user info from URL params
    const urlParams = new URLSearchParams(window.location.search);

    // 尝试多种可能的令牌参数名称
    let token = urlParams.get('__clerk_token');

    // 如果没有找到标准token参数，尝试其他可能的参数名
    if (!token) {
      token = urlParams.get('token') ||
              urlParams.get('clerk_token') ||
              urlParams.get('access_token');
    }

    // 尝试从URL哈希中获取token（有时Clerk会将token放在URL哈希而不是查询参数中）
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get('token') ||
              hashParams.get('__clerk_token') ||
              hashParams.get('access_token');
    }

    addDebugStep('Parsed URL parameters', {
      hasToken: !!token,
      token: token ? `${token.substring(0, 10)}...` : null,
      fullUrl: window.location.href,
      search: window.location.search,
      hash: window.location.hash
    });

    if (!token) {
      addDebugStep('Token not found in URL');

      // 尝试从localStorage/sessionStorage获取token
      // Clerk有时会将token存储在这里
      const clerkSession = localStorage.getItem('__clerk_client_jwt') ||
                          sessionStorage.getItem('__clerk_client_jwt');

      if (clerkSession) {
        try {
          const sessionData = JSON.parse(clerkSession);
          if (sessionData && sessionData.token) {
            token = sessionData.token;
            addDebugStep('Found token in browser storage', { source: 'localStorage/sessionStorage' });
          }
        } catch (e) {
          addDebugStep('Error parsing storage token', { error: e.message });
        }
      }

      // 如果仍然没有token，查看chrome.storage
      if (!token) {
        try {
          const chromeStorageData = await chrome.storage.local.get(['clerkToken']);
          if (chromeStorageData && chromeStorageData.clerkToken) {
            token = chromeStorageData.clerkToken;
            addDebugStep('Found token in chrome.storage', { source: 'chrome.storage.local' });
          }
        } catch (e) {
          addDebugStep('Error accessing chrome.storage', { error: e.message });
        }
      }

      // 如果仍然没有token，显示错误
      if (!token) {
        throw new Error('No authentication token found. Make sure your Clerk domain is correctly configured.');
      }
    }

    addDebugStep('Fetching user information from Clerk API');

    // 添加网络请求监听，以便更好地调试
    addDebugStep('Setting up network request monitoring');
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const startTime = new Date();
      let requestBody = "No request body";

      if (options?.body) {
        try {
          if (typeof options.body === 'string') {
            requestBody = JSON.parse(options.body);
          } else {
            requestBody = options.body;
          }
        } catch(e) {
          requestBody = String(options.body).substring(0, 200);
        }
      }

      addDebugStep('Fetch request starting', {
        url: url,
        method: options?.method || 'GET',
        headers: options?.headers,
        body: requestBody
      });

      try {
        const response = await originalFetch(url, options);

        const endTime = new Date();
        const duration = endTime - startTime;

        // 克隆响应以便读取内容
        const clonedResponse = response.clone();
        let responseBody;
        try {
          responseBody = await clonedResponse.text();
          try {
            responseBody = JSON.parse(responseBody);
          } catch (e) {
            // 如果不是JSON，保留文本形式
          }
        } catch (e) {
          responseBody = 'Could not read response body';
        }

        addDebugStep('Fetch response received', {
          url: url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          duration: `${duration}ms`,
          body: responseBody
        });

        return response;
      } catch (error) {
        addDebugStep('Fetch error', {
          url: url,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    };

    const userResponse = await fetch('https://api.clerk.dev/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    addDebugStep('Clerk API response received', {
      status: userResponse.status,
      ok: userResponse.ok
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      addDebugStep('API response error', {
        status: userResponse.status,
        error: errorText
      });
      throw new Error(`Failed to get user information (Status: ${userResponse.status})`);
    }

    const userData = await userResponse.json();
    addDebugStep('User data received', {
      userId: userData.id,
      email: userData.email_addresses?.[0]?.email_address,
      firstName: userData.first_name,
      lastName: userData.last_name
    });

    // 构建所需的用户对象
    const userObj = {
      id: userData.id,
      email: userData.email_addresses?.[0]?.email_address || '',
      firstName: userData.first_name || '',
      lastName: userData.last_name || ''
    };

    // 添加下载日志按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '下载日志';
    downloadBtn.className = 'close-button';
    downloadBtn.style.marginLeft = '10px';
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(debugInfo, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'auth-debug-log.json';
      a.click();
    });
    document.querySelector('.container').appendChild(downloadBtn);

    // 【先尝试方法1】直接调用API保存用户到MongoDB
    try {
      addDebugStep('【方法1】尝试直接调用API保存用户');

      const apiUrl = `${window.API_BASE_URL}/api/users`;
      addDebugStep('API endpoint', apiUrl);

      const directApiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkId: userObj.id,
          email: userObj.email,
          firstName: userObj.firstName,
          lastName: userObj.lastName,
          token: token, // 附上令牌以便后端验证
          authProvider: userData.primary_email_address_id ? 'email' : 'oauth',
          signUpMethod: 'google'
        })
      });

      const directApiResult = await directApiResponse.json();
      addDebugStep('【方法1】直接API调用结果', directApiResult);

      if (directApiResponse.ok) {
        addDebugStep('【方法1】成功 - 用户数据已保存到MongoDB');
      } else {
        addDebugStep('【方法1】失败 - 服务器返回错误');
      }
    } catch (directApiError) {
      addDebugStep('【方法1】错误 - 直接API调用失败', {
        error: directApiError.message,
        stack: directApiError.stack
      });
      // 继续进行方法2，不要因为方法1失败而中断
    }

    // 【再尝试方法2】通过clerk-auth的handleAuthCallback处理认证并保存用户
    try {
      addDebugStep('【方法2】准备调用handleAuthCallback');
      console.log('准备调用handleAuthCallback，token=', token ? token.substring(0, 10) + '...' : 'null', '用户=', userObj);

      const user = await handleAuthCallback(token, userObj);

      if (user) {
        addDebugStep('【方法2】handleAuthCallback成功', {
          userId: user.id,
          email: user.email
        });
      } else {
        addDebugStep('【方法2】handleAuthCallback返回null');
        console.error('handleAuthCallback调用失败，返回null');
      }
    } catch (authError) {
      addDebugStep('【方法2】handleAuthCallback错误', {
        error: authError.message,
        stack: authError.stack
      });
      console.error('handleAuthCallback调用失败:', authError);
    }

    // 【最后尝试方法3】通过api.js的createOrUpdateUser函数
    try {
      addDebugStep('【方法3】通过createOrUpdateUser函数保存用户');

      const apiUserData = {
        clerkId: userObj.id,
        email: userObj.email,
        firstName: userObj.firstName,
        lastName: userObj.lastName,
        authProvider: userData.primary_email_address_id ? 'email' : 'oauth',
        signUpMethod: 'google'
      };

      const createResult = await createOrUpdateUser(apiUserData);
      addDebugStep('【方法3】createOrUpdateUser结果', createResult);
    } catch (createError) {
      addDebugStep('【方法3】createOrUpdateUser错误', {
        error: createError.message,
        stack: createError.stack
      });
    }

    // 显示成功信息
    messageEl.textContent = 'Authentication successful! Please review the debug information below and close this tab.';
    messageEl.className = 'message success';

    // 显示关闭按钮
    closeTabBtn.style.display = 'inline-block';

  } catch (error) {
    console.error('Authentication error:', error);
    addDebugStep('Authentication error', {
      message: error.message,
      stack: error.stack
    });

    messageEl.textContent = `Authentication failed: ${error.message}`;
    messageEl.className = 'message error';

    // Show debug info automatically on error
    debugInfoEl.style.display = 'block';
  }
});