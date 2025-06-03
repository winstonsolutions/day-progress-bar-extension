/**
 * Payment Page JavaScript
 * 处理Stripe风格支付页面的逻辑
 */

import { API_BASE_URL, createCheckoutSession } from './api.js';

// 常量定义
const MONTHLY_PRICE = 1.99;
const PAYMENT_METHODS = {
  CARD: 'card',
  ALIPAY: 'alipay',
  WECHAT: 'wechat'
};

// 获取URL参数
const urlParams = new URLSearchParams(window.location.search);
const source = urlParams.get('source') || 'default';
const isTrial = urlParams.get('trial') === 'true';

// DOM元素
const emailInput = document.getElementById('email');
const emailError = document.getElementById('email-error');
const paymentMethods = document.querySelectorAll('.sr-payment-method');
const payButton = document.getElementById('btn-pay');

/**
 * 初始化页面
 */
function initPaymentPage() {
  // 检查URL参数中是否有email
  const emailParam = urlParams.get('email');
  if (emailParam) {
    emailInput.value = emailParam;
  }

  // 绑定支付按钮点击事件
  payButton.addEventListener('click', handlePayment);

  // 绑定支付方式选择事件
  setupPaymentMethodSelection();

  // 绑定表单验证事件
  setupFormValidation();

  // 修改页面内容，根据是否是试用来源
  updatePageContent();

  console.log('Stripe风格支付页面初始化完成');
}

/**
 * 设置支付方式选择的交互
 */
function setupPaymentMethodSelection() {
  paymentMethods.forEach(method => {
    // 点击整个支付方式区域时选中对应的radio
    method.addEventListener('click', () => {
      const radio = method.querySelector('input[type="radio"]');
      radio.checked = true;

      // 更新选中状态样式
      updatePaymentMethodStyles();
    });

    // 监听radio的change事件
    const radio = method.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => {
      updatePaymentMethodStyles();
    });
  });
}

/**
 * 更新支付方式的选中样式
 */
function updatePaymentMethodStyles() {
  paymentMethods.forEach(method => {
    const radio = method.querySelector('input[type="radio"]');
    if (radio.checked) {
      method.classList.add('selected');
    } else {
      method.classList.remove('selected');
    }
  });
}

/**
 * 设置表单验证事件
 */
function setupFormValidation() {
  // 邮箱输入验证
  emailInput.addEventListener('blur', () => {
    validateEmailField();
  });

  emailInput.addEventListener('input', () => {
    // 输入时隐藏错误提示
    emailError.style.display = 'none';
  });
}

/**
 * 验证邮箱字段
 * @returns {boolean} 邮箱是否有效
 */
function validateEmailField() {
  const email = emailInput.value.trim();

  if (!email) {
    showEmailError('请输入邮箱地址');
    return false;
  }

  if (!validateEmail(email)) {
    showEmailError('请输入有效的邮箱地址');
    return false;
  }

  return true;
}

/**
 * 显示邮箱错误
 * @param {string} message - 错误消息
 */
function showEmailError(message) {
  emailError.textContent = message;
  emailError.style.display = 'block';
  emailInput.classList.add('error');
}

/**
 * 根据来源更新页面内容
 */
function updatePageContent() {
  const title = document.querySelector('.sr-header h1');
  const subtitle = document.querySelector('.sr-header p');
  const productTitle = document.querySelector('.sr-product-info h2');

  if (isTrial) {
    title.textContent = '开始免费试用';
    subtitle.textContent = '输入您的邮箱以开始30天免费试用';
    payButton.textContent = '开始免费试用';
    document.querySelector('.sr-legal-text').textContent =
      '点击"开始免费试用"，即表示您同意我们的服务条款和隐私政策。30天试用期结束后，您将自动订阅高级版，费用为$1.99/月，您可以随时取消订阅。';

    productTitle.innerHTML = 'Day Progress Bar <span class="sr-badge">免费试用</span>';
  } else if (source === 'license') {
    title.textContent = '获取许可证密钥';
    subtitle.textContent = '完成付款后，我们将向您发送许可证密钥';
    payButton.textContent = '立即购买';
  } else {
    title.textContent = '完成您的订阅';
    subtitle.textContent = '输入您的详细信息以完成订阅';
    payButton.textContent = '立即支付';
  }
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否是有效的邮箱
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 处理支付请求
 */
async function handlePayment(event) {
  event.preventDefault();

  // 表单验证
  if (!validateEmailField()) {
    return;
  }

  // 禁用按钮，防止重复点击
  payButton.disabled = true;
  const originalText = payButton.textContent;
  payButton.textContent = '处理中...';

  // 获取表单数据
  const email = emailInput.value.trim();
  let selectedPaymentMethod = getSelectedPaymentMethod();

  // 开发测试模式 - 设置为true使用模拟的Stripe页面
  const useMockStripe = true;

  if (useMockStripe) {
    // 使用模拟的Stripe页面（无需后端API）
    const successUrl = chrome.runtime.getURL('subscription.html?payment_success=true');
    const mockStripeUrl = chrome.runtime.getURL(`mock-stripe.html?email=${encodeURIComponent(email)}&success_url=${encodeURIComponent(successUrl)}`);
    window.location.href = mockStripeUrl;
    return;
  }

  try {
    // 创建Stripe结账会话，并传递邮箱和支付方式
    const { sessionUrl } = await createCheckoutSession(
      MONTHLY_PRICE,
      email,
      selectedPaymentMethod
    );

    // 重定向到Stripe付款页面
    window.location.href = sessionUrl;
  } catch (error) {
    console.error('支付初始化失败:', error);

    // API调用失败时回退到模拟Stripe页面
    const fallbackToMock = confirm(
      '连接到支付服务器失败。是否要使用测试模式继续？\n\n' +
      '错误信息: ' + error.message
    );

    if (fallbackToMock) {
      const successUrl = chrome.runtime.getURL('subscription.html?payment_success=true');
      const mockStripeUrl = chrome.runtime.getURL(`mock-stripe.html?email=${encodeURIComponent(email)}&success_url=${encodeURIComponent(successUrl)}`);
      window.location.href = mockStripeUrl;
    } else {
      // 显示错误信息
      alert('支付流程已取消');

      // 恢复按钮状态
      payButton.disabled = false;
      payButton.textContent = originalText;
    }
  }
}

/**
 * 获取选中的支付方式
 * @returns {string} 支付方式
 */
function getSelectedPaymentMethod() {
  const selectedInput = document.querySelector('input[name="payment-method"]:checked');
  return selectedInput ? selectedInput.value : 'card';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPaymentPage);