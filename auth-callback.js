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
    // 从URL获取token和用户信息
    const urlParams = new URLSearchParams(window.location.search);

    // 尝试多种可能的令牌参数名称
    const token = urlParams.get('__clerk_token') ||
               urlParams.get('token') ||
               urlParams.get('__clerk_db_jwt') ||
               urlParams.get('clerk_token') ||
               urlParams.get('access_token');

    // 尝试获取用户信息
    const userId = urlParams.get('user_id');
    const email = urlParams.get('email');
    const firstName = urlParams.get('first_name') || '';
    const lastName = urlParams.get('last_name') || '';

    addDebugStep('解析URL参数', {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null,
      userId,
      email,
      firstName,
      lastName
    });

    if (!token) {
      updateStatus('token', 'error', 15);
      throw new Error('无法找到认证令牌。认证流程可能未完成。');
    }

    updateStatus('token', 'success', 30);

    // 构建用户对象
    const userObj = {
      id: userId || 'unknown_id',
      email: email || 'unknown@email.com',
      firstName: firstName || '',
      lastName: lastName || ''
    };

    addDebugStep('准备用户对象', userObj);
    updateStatus('api', 'success', 50);

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
    }

    // 尝试使用API保存用户数据
    try {
      addDebugStep('通过API保存用户');

      const createResult = await createOrUpdateUser({
        clerkId: userObj.id,
        email: userObj.email,
        firstName: userObj.firstName,
        lastName: userObj.lastName,
        token: token
      });

      addDebugStep('createOrUpdateUser结果', createResult);
      updateStatus('complete', 'success', 100);
    } catch (createError) {
      addDebugStep('createOrUpdateUser错误', {
        error: createError.message,
        stack: createError.stack
      });
      // 即使API调用失败，也认为认证成功
      updateStatus('complete', 'success', 100);
    }

    // 显示成功信息
    messageEl.textContent = '认证成功！您可以关闭此标签页。';
    messageEl.className = 'message success';

    // 显示关闭按钮
    closeTabBtn.style.display = 'inline-block';

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