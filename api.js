/**
 * API Utilities for Day Progress Bar Extension
 * 管理与后端API的所有通信
 */

// API基础URL - 已更新为实际部署的后端API
const API_BASE_URL = 'https://day-progress-bar-backend-production.up.railway.app'; // Railway部署URL

/**
 * 创建Stripe结账会话
 * @param {number} priceInUSD - 订阅的价格（USD）
 * @param {string} [email] - 用户邮箱，用于发送license key
 * @param {string} [paymentMethod] - 支付方式（card/alipay/wechat）
 * @returns {Promise<{sessionUrl: string}>} - Stripe结账会话URL
 */
async function createCheckoutSession(priceInUSD, email = null, paymentMethod = 'card') {
  const successUrl = chrome.runtime.getURL('subscription.html?payment_success=true');
  const cancelUrl = chrome.runtime.getURL('subscription.html?payment_cancelled=true');

  try {
    // 在沙盒模式下使用测试API
    const isTestMode = true; // 暂时设置为测试模式

    // 调试信息
    console.log('发送请求到:', `${API_BASE_URL}/api/create-checkout-session`);
    console.log('请求参数:', {
      priceInUSD,
      email,
      paymentMethod,
      successUrl,
      cancelUrl,
      testmode: isTestMode
    });

    const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceInUSD,
        email,
        paymentMethod,
        successUrl,
        cancelUrl,
        testmode: isTestMode // 添加测试模式标志
      })
    });

    // 检查响应状态
    if (!response.ok) {
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
  const response = await fetch(`${API_BASE_URL}/api/verify-license`, {
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
  const response = await fetch(`${API_BASE_URL}/api/request-license`, {
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

// 导出所有API函数
export {
  API_BASE_URL,
  createCheckoutSession,
  verifyLicense,
  requestLicenseKey,
  verifyPaymentStatus
};