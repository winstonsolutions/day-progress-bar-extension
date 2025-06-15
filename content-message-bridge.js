/**
 * 内容脚本：充当页面与扩展之间的消息桥接
 * 监听页面的window.postMessage事件，并转发到扩展的background.js
 */

// Self-executing function to isolate variables from global scope
(function() {
  // Check if script is already initialized
  if (window.__DPB_MESSAGE_BRIDGE_INITIALIZED__) {
    console.log('[内容脚本] 消息桥接已经初始化，跳过重复执行');
    return;  // Early exit
  }

  // Mark as initialized
  window.__DPB_MESSAGE_BRIDGE_INITIALIZED__ = true;

  console.log('[内容脚本] 已加载消息桥接脚本，可以接收来自页面的消息');

  // 允许的来源列表
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',  // 本地开发环境
    'http://localhost',       // 本地部署环境 (默认80端口)
    'http://127.0.0.1',       // 本地部署环境 - 另一种表示方式
    'http://localhost:5000',  // 另一个常用的Node服务器端口
    'http://localhost:8080',  // 另一个常用的开发端口
    'http://localhost:8000'   // 另一个常用的开发端口
  ];

  // 定期检查localStorage中是否有认证数据
  function checkLocalStorageForAuthData() {
    try {
      const authData = localStorage.getItem('auth_data_for_extension');
      const authToken = localStorage.getItem('auth_token_for_extension');

      if (authData && authToken) {
        console.log('[内容脚本] 从localStorage中发现认证数据');

        // 解析存储的数据
        const parsedData = JSON.parse(authData);

        // 检查时间戳，只处理最近10分钟的数据
        const now = Date.now();
        const timestamp = parsedData.timestamp || 0;
        const isRecent = (now - timestamp) < 10 * 60 * 1000; // 10分钟

        if (isRecent) {
          console.log('[内容脚本] 认证数据是最近的，发送到background');

          // 添加token并发送到background
          const completeAuthData = {
            action: 'clerk-auth-success',
            token: authToken,
            user: parsedData.user,
            source: 'content-script-localStorage'
          };

          chrome.runtime.sendMessage(completeAuthData)
            .then(response => {
              console.log('[内容脚本] background响应localStorage认证:', response);

              // 如果成功，清除localStorage中的数据
              if (response && response.success) {
                console.log('[内容脚本] 认证成功，清除localStorage数据');
                localStorage.removeItem('auth_data_for_extension');
                localStorage.removeItem('auth_token_for_extension');

                // 通知页面认证成功
                window.postMessage({
                  type: 'auth_received',
                  source: 'day-progress-bar-extension',
                  success: true
                }, '*');
              }
            })
            .catch(error => {
              console.error('[内容脚本] 发送localStorage认证数据失败:', error);
            });
        } else {
          console.log('[内容脚本] 认证数据太旧，忽略');
          // 清除旧数据
          localStorage.removeItem('auth_data_for_extension');
          localStorage.removeItem('auth_token_for_extension');
        }
      }
    } catch (error) {
      console.error('[内容脚本] 检查localStorage时出错:', error);
    }
  }

  // 每5秒检查一次localStorage
  const checkIntervalId = setInterval(checkLocalStorageForAuthData, 5000);
  // 页面加载后立即检查
  const initialCheckTimeoutId = setTimeout(checkLocalStorageForAuthData, 1000);

  // 监听页面发出的消息
  function messageListener(event) {
    // 确保消息来自我们期望的源
    if (!ALLOWED_ORIGINS.includes(event.origin)) {
      console.log('[内容脚本] 忽略来自未授权源的消息:', event.origin);
      return;
    }

    console.log('[内容脚本] 收到页面消息:', event.data, '来源:', event.origin);

    // 检查消息类型
    const message = event.data;
    if (message && (message.type === 'clerk-auth-success' || message.action === 'clerk-auth-success')) {
      console.log('[内容脚本] 收到clerk认证成功消息，转发到background');

      // 转发消息到扩展的background脚本
      chrome.runtime.sendMessage({
        action: 'clerk-auth-success',
        token: message.token,
        user: message.user, // 确保转发用户数据
        source: 'content-script',
        origin: event.origin,
        originalMessage: message
      })
      .then(response => {
        console.log('[内容脚本] background响应:', response);

        // 回复页面
        window.postMessage({
          type: 'auth_received',
          source: 'day-progress-bar-extension',
          success: !!response?.success,
          message: response?.success ? '认证成功' : '认证失败'
        }, event.origin || '*');
      })
      .catch(error => {
        console.error('[内容脚本] 发送消息到background失败:', error);
      });
    }
  }

  window.addEventListener('message', messageListener);

  // 清理函数 - 用于在页面卸载或导航时清理资源
  function cleanup() {
    clearInterval(checkIntervalId);
    clearTimeout(initialCheckTimeoutId);
    window.removeEventListener('message', messageListener);
  }

  // 在页面卸载时清理资源
  window.addEventListener('unload', cleanup);

  // 告诉页面内容脚本已准备好
  window.postMessage({
    type: 'clerk-bridge-ready',
    source: 'day-progress-bar-extension',
    extensionId: chrome.runtime.id
  }, '*');

  console.log('[内容脚本] 桥接已初始化，扩展ID:', chrome.runtime.id);
})(); // End of self-executing function