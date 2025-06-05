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

  // 更新UI状态函数
  function updateStatus(stage, status, progress) {
    if (window.updateAuthStatus) {
      window.updateAuthStatus(stage, status, progress);
    }
  }

  // 默认显示调试信息区域
  if (document.querySelector('details')) {
    document.querySelector('details').open = false;
  }

  // Toggle debug info visibility
  showDebugBtn.addEventListener('click', () => {
    if (document.querySelector('details')) {
      document.querySelector('details').open = !document.querySelector('details').open;
    }
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

  addDebugStep('Callback页面已加载');
  updateStatus('token', 'pending', 10);

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

    // 尝试多种可能的令牌参数名称，按优先顺序
    let token = urlParams.get('__clerk_token') ||
               urlParams.get('token') ||
               urlParams.get('__clerk_db_jwt') ||
               urlParams.get('clerk_token') ||
               urlParams.get('access_token');

    // 尝试从URL哈希中获取token（有时Clerk会将token放在URL哈希而不是查询参数中）
    if (!token && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get('token') ||
              hashParams.get('__clerk_token') ||
              hashParams.get('__clerk_db_jwt') ||
              hashParams.get('access_token');
    }

    addDebugStep('查找并解析令牌', {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
      tokenLength: token ? token.length : 0,
      fullUrl: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
      allParams: Object.fromEntries([...urlParams.entries()])
    });

    if (token) {
      updateStatus('token', 'success', 25);
    } else {
      updateStatus('token', 'pending', 15);
      addDebugStep('URL中未找到令牌，尝试其他来源');

      // 尝试从localStorage/sessionStorage获取token
      // Clerk有时会将token存储在这里
      const storageLocations = [
        { name: '__clerk_client_jwt', storage: localStorage },
        { name: '__clerk_client_jwt', storage: sessionStorage },
        { name: 'clerk_jwt', storage: localStorage },
        { name: 'clerk_jwt', storage: sessionStorage }
      ];

      for (const loc of storageLocations) {
        const storageItem = loc.storage.getItem(loc.name);
        if (storageItem) {
          try {
            const sessionData = JSON.parse(storageItem);
            if (sessionData && sessionData.token) {
              token = sessionData.token;
              addDebugStep('在浏览器存储中找到令牌', { source: `${loc.storage === localStorage ? 'localStorage' : 'sessionStorage'}.${loc.name}` });
              updateStatus('token', 'success', 25);
              break;
            }
          } catch (e) {
            addDebugStep(`解析存储令牌失败: ${loc.name}`, { error: e.message });
          }
        }
      }

      // 如果仍然没有token，查看chrome.storage
      if (!token) {
        try {
          const chromeStorageData = await chrome.storage.local.get(['clerkToken']);
          if (chromeStorageData && chromeStorageData.clerkToken) {
            token = chromeStorageData.clerkToken;
            addDebugStep('在chrome.storage中找到令牌', { source: 'chrome.storage.local.clerkToken' });
            updateStatus('token', 'success', 25);
          }
        } catch (e) {
          addDebugStep('访问chrome.storage失败', { error: e.message });
        }
      }

      // 如果仍然没有token，显示错误
      if (!token) {
        updateStatus('token', 'error', 15);
        throw new Error('无法找到认证令牌。请确保Clerk域名配置正确，并且您已完成登录过程。');
      }
    }

    addDebugStep('从Clerk API获取用户信息');
    updateStatus('api', 'pending', 35);

    // 添加网络请求监听，以便更好地调试
    addDebugStep('设置网络请求监控');
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
      const startTime = new Date();
      let requestBody = "无请求体";

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

      addDebugStep('发起Fetch请求', {
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
          responseBody = '无法读取响应体';
        }

        addDebugStep('收到Fetch响应', {
          url: url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          duration: `${duration}ms`,
          body: responseBody
        });

        return response;
      } catch (error) {
        addDebugStep('Fetch错误', {
          url: url,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    };

    // 使用真实token调用Clerk API
    addDebugStep('使用真实令牌调用Clerk API');
    const userResponse = await fetch('https://api.clerk.dev/v1/me', {
      method: 'GET',  // 明确指定方法
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    addDebugStep('收到Clerk API响应', {
      status: userResponse.status,
      ok: userResponse.ok
    });

    if (!userResponse.ok) {
      updateStatus('api', 'error', 35);
      const errorText = await userResponse.text();
      addDebugStep('API响应错误', {
        status: userResponse.status,
        error: errorText
      });
      throw new Error(`获取用户信息失败 (状态码: ${userResponse.status}). ${errorText}`);
    }

    updateStatus('api', 'success', 50);
    const userData = await userResponse.json();
    addDebugStep('收到用户数据', {
      userId: userData.id,
      email: userData.email_addresses?.[0]?.email_address,
      firstName: userData.first_name,
      lastName: userData.last_name,
      userDataKeys: Object.keys(userData)
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
    document.querySelector('.button-container').appendChild(downloadBtn);

    // 将认证信息发送到扩展的background脚本
    updateStatus('storage', 'pending', 60);
    try {
      addDebugStep('将认证信息发送到background脚本');

      chrome.runtime.sendMessage({
        action: 'clerk-auth-success',
        token: token,
        user: userObj
      }, (response) => {
        if (response && response.success) {
          addDebugStep('background脚本已接收认证信息', response);
          updateStatus('storage', 'success', 75);
        } else {
          addDebugStep('background脚本未能成功处理认证信息', response);
          updateStatus('storage', 'error', 60);
        }
      });
    } catch (msgError) {
      addDebugStep('向background脚本发送消息失败', {
        error: msgError.message,
        stack: msgError.stack
      });
      updateStatus('storage', 'error', 60);
      // 继续执行，不因这一步失败而中断
    }

    // 【先尝试方法1】直接调用API保存用户到MongoDB
    try {
      addDebugStep('【方法1】尝试直接调用API保存用户');

      const apiUrl = `${window.API_BASE_URL}/api/users`;
      addDebugStep('API endpoint', apiUrl);

      const directApiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 在header中也包含令牌
        },
        body: JSON.stringify({
          clerkId: userObj.id,
          email: userObj.email,
          firstName: userObj.firstName,
          lastName: userObj.lastName,
          token: token, // 附上令牌以便后端验证
          authProvider: userData.primary_email_address_id ? 'email' : 'oauth',
          signUpMethod: userData.verification_strategy || 'unknown'
        })
      });

      const directApiResult = await directApiResponse.json();
      addDebugStep('【方法1】直接API调用结果', directApiResult);

      if (directApiResponse.ok) {
        addDebugStep('【方法1】成功 - 用户数据已保存到MongoDB');
        updateStatus('complete', 'success', 90);
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
        updateStatus('complete', 'success', 95);
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
        signUpMethod: userData.verification_strategy || 'unknown',
        token: token  // 添加token到用户数据
      };

      const createResult = await createOrUpdateUser(apiUserData);
      addDebugStep('【方法3】createOrUpdateUser结果', createResult);
      updateStatus('complete', 'success', 100);
    } catch (createError) {
      addDebugStep('【方法3】createOrUpdateUser错误', {
        error: createError.message,
        stack: createError.stack
      });
      // 如果所有方法失败，但我们有用户信息和token，仍认为是基本成功
      if (userObj && token) {
        updateStatus('complete', 'success', 100);
      } else {
        updateStatus('complete', 'error', 85);
      }
    }

    // 显示成功信息
    messageEl.textContent = '认证成功！您可以关闭此标签页。';
    messageEl.className = 'message success';

    // 显示关闭按钮
    closeTabBtn.style.display = 'inline-block';

  } catch (error) {
    console.error('认证错误:', error);
    addDebugStep('认证错误', {
      message: error.message,
      stack: error.stack
    });

    messageEl.textContent = `认证失败: ${error.message}`;
    messageEl.className = 'message error';

    // 自动显示调试信息
    if (document.querySelector('details')) {
      document.querySelector('details').open = true;
    }

    // 标记所有未完成的步骤为错误
    updateStatus('complete', 'error', 100);
  }
});