/**
 * 内容脚本：充当页面与扩展之间的消息桥接
 * 监听页面的window.postMessage事件，并转发到扩展的background.js
 */

console.log('[内容脚本] 已加载消息桥接脚本，可以接收来自页面的消息');

// 允许的来源列表
const ALLOWED_ORIGINS = [
  'http://localhost:3000',  // 本地开发环境
  'https://day-progress-bar-backend-production.up.railway.app',  // Railway上的部署环境
  'http://localhost',       // 本地部署环境 (默认80端口)
  'http://127.0.0.1',       // 本地部署环境 - 另一种表示方式
  'http://localhost:5000',  // 另一个常用的Node服务器端口
  'http://localhost:8080',  // 另一个常用的开发端口
  'http://localhost:8000'   // 另一个常用的开发端口
];

// 监听页面发出的消息
window.addEventListener('message', function(event) {
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
        type: 'clerk-auth-response',
        success: !!response?.success,
        message: response?.success ? '认证成功' : '认证失败'
      }, event.origin);
    })
    .catch(error => {
      console.error('[内容脚本] 发送消息到background失败:', error);
    });
  }
});

// 告诉页面内容脚本已准备好
window.postMessage({
  type: 'clerk-bridge-ready',
  extensionId: chrome.runtime.id
}, '*');

console.log('[内容脚本] 桥接已初始化，扩展ID:', chrome.runtime.id);