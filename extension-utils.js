/**
 * Chrome扩展工具库
 * 提供错误处理、安全API调用和开发模式辅助功能
 */

// 检查是否已经定义，避免重复声明
if (typeof window.ExtensionUtils === 'undefined') {
  // 将变量挂载到 window 对象上
  window.ExtensionUtils = (() => {
    // 开发模式标志 - 生产环境发布前修改为false
    const DEVELOPMENT_MODE = true;

    // 详细日志输出控制
    const VERBOSE_LOGGING = DEVELOPMENT_MODE;

    /**
     * 检查扩展上下文是否有效
     */
    function isContextValid() {
      try {
        return !!chrome.runtime.id;
      } catch (e) {
        return false;
      }
    }

    /**
     * 调试日志函数，仅在开发模式启用
     */
    function debugLog(...args) {
      if (VERBOSE_LOGGING) {
        console.log('[DEV]', ...args);
      }
    }

    /**
     * 安全的API调用包装器
     * @param {Function} apiFunction 要执行的API函数
     * @param {*} fallbackValue 失败时的返回值
     */
    function safeApiCall(apiFunction, fallbackValue) {
      try {
        return apiFunction();
      } catch (e) {
        if (e.message.includes('Extension context invalidated') ||
            e.message.includes('Extension context was invalidated')) {
          console.warn('扩展上下文已失效:', e.message);
          return fallbackValue;
        }
        throw e; // 重新抛出其他类型的错误
      }
    }

    /**
     * 安全的Promise风格API调用包装器（推荐用于Manifest V3）
     * @param {Function} promiseFunction 返回Promise的函数
     * @param {*} fallbackValue 失败时的返回值
     * @returns {Promise} 包装后的Promise
     */
    async function safePromiseApiCall(promiseFunction, fallbackValue) {
      if (!isContextValid()) {
        debugLog('扩展上下文无效，返回默认值');
        return fallbackValue;
      }

      try {
        return await promiseFunction();
      } catch (e) {
        if (e.message.includes('Extension context invalidated') ||
            e.message.includes('Extension context was invalidated')) {
          console.warn('Promise API 调用时扩展上下文已失效:', e.message);
          return fallbackValue;
        }
        throw e; // 重新抛出其他类型的错误
      }
    }

    /**
     * 安全地发送消息 (Promise风格，适用于Manifest V3)
     * @param {Object} message 消息对象
     * @param {*} defaultResponse 默认响应
     * @returns {Promise<*>} 响应Promise
     */
    async function asyncSafeSendMessage(message, defaultResponse = null) {
      if (!isContextValid()) {
        debugLog('扩展上下文无效，跳过消息发送:', message);
        return defaultResponse;
      }

      try {
        return await chrome.runtime.sendMessage(message);
      } catch (e) {
        debugLog('发送消息异常:', e);
        return defaultResponse;
      }
    }

    /**
     * 高级Chrome API调用包装器，支持重试和错误处理选项
     */
    function chromeApiWrapper(apiCall, options = {}) {
      const {
        fallbackValue = null,
        retryCount = DEVELOPMENT_MODE ? 0 : 2,  // 开发中不重试，生产环境重试2次
        retryDelay = 500,
        silentFail = DEVELOPMENT_MODE ? false : true, // 开发中显示错误，生产环境静默失败
        forceContinue = DEVELOPMENT_MODE // 开发中即使错误也继续执行
      } = options;

      let attempts = 0;

      function attemptApiCall() {
        attempts++;

        try {
          return apiCall();
        } catch (e) {
          const isContextError = e.message.includes('Extension context invalidated');

          debugLog(`API调用错误 (尝试 ${attempts}/${retryCount + 1}):`, e.message);

          if (isContextError && attempts <= retryCount) {
            debugLog(`将在${retryDelay}ms后重试...`);
            setTimeout(attemptApiCall, retryDelay);
            return;
          }

          if (!silentFail || DEVELOPMENT_MODE) {
            console.error('Chrome API调用失败:', e);

            if (DEVELOPMENT_MODE) {
              showDevNotification(`Extension API error: ${e.message}`);

              // 在开发模式下可以提示用户刷新页面
              if (isContextError && confirm('Extension context invalidated. Reload page?')) {
                window.location.reload();
              }
            }
          }

          if (forceContinue || isContextError) {
            return fallbackValue;
          }

          throw e; // 在非开发环境，如果不是上下文错误，继续抛出
        }
      }

      return attemptApiCall();
    }

    /**
     * 设置全局错误处理器
     */
    function setupErrorHandlers() {
      // 为未捕获的异常设置处理器
      window.addEventListener('error', function(event) {
        // 检查是否是扩展上下文错误
        if (event.error && event.error.message &&
            event.error.message.includes('Extension context invalidated')) {

          console.warn('捕获到扩展上下文失效错误:', event.error);

          // 阻止错误继续传播（可选）
          event.preventDefault();

          // 在开发模式下，可以显示通知
          if (DEVELOPMENT_MODE) {
            showDevNotification('Extension context invalidated. You may need to refresh the page.');
          }

          return false;
        }
      });

      // 为未处理的Promise rejection设置处理器
      window.addEventListener('unhandledrejection', function(event) {
        if (event.reason && event.reason.message &&
            event.reason.message.includes('Extension context invalidated')) {

          console.warn('捕获到Promise中的扩展上下文失效错误:', event.reason);
          event.preventDefault();
          return false;
        }
      });
    }

    /**
     * 显示开发模式通知
     */
    function showDevNotification(message) {
      if (!DEVELOPMENT_MODE) return;

      const notificationId = 'dev-notification';
      let notificationElement = document.getElementById(notificationId);

      if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = notificationId;
        notificationElement.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background-color: #ff7043;
          color: white;
          padding: 10px;
          border-radius: 5px;
          z-index: 10000000;
          font-family: sans-serif;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          max-width: 300px;
        `;
        document.body.appendChild(notificationElement);
      }

      notificationElement.textContent = message;

      // 5秒后自动移除
      setTimeout(() => {
        if (notificationElement.parentNode) {
          notificationElement.parentNode.removeChild(notificationElement);
        }
      }, 5000);
    }

    /**
     * 安全地发送消息
     * @param {Object} message 消息对象
     * @param {Function} callback 回调函数
     * @param {*} defaultResponse 默认响应
     */
    function safeSendMessage(message, callback, defaultResponse = null) {
      if (!isContextValid()) {
        console.warn('扩展上下文无效，跳过消息发送:', message);
        if (typeof callback === 'function') {
          callback(defaultResponse);
        }
        return;
      }

      try {
        chrome.runtime.sendMessage(message, function(response) {
          if (chrome.runtime.lastError) {
            console.warn('发送消息错误:', chrome.runtime.lastError.message);
            if (typeof callback === 'function') {
              callback(defaultResponse);
            }
            return;
          }

          if (typeof callback === 'function') {
            callback(response);
          }
        });
      } catch (e) {
        console.error('发送消息异常:', e);
        if (typeof callback === 'function') {
          callback(defaultResponse);
        }
      }
    }

    // 返回公共API
    return {
      DEVELOPMENT_MODE,
      VERBOSE_LOGGING,
      isContextValid,
      debugLog,
      safeApiCall,
      safePromiseApiCall,     // 新增：Promise风格安全API调用
      asyncSafeSendMessage,   // 新增：Promise风格安全消息发送
      chromeApiWrapper,
      setupErrorHandlers,
      showDevNotification,
      safeSendMessage
    };
  })();

  // 记录已初始化的信息
  console.log('ExtensionUtils 已全局初始化');

  // 如果在content script环境中，自动设置错误处理器
  if (typeof window !== 'undefined') {
    window.ExtensionUtils.setupErrorHandlers();
  }
}