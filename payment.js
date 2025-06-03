/**
 * Payment Page JavaScript
 * 处理自定义支付页面的逻辑
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
const paymentMethodInputs = document.querySelectorAll('input[name="payment-method"]');
const payButton = document.getElementById('btn-pay');

// 初始化页面
function initPaymentPage() {
  // 检查URL参数中是否有email
  const emailParam = urlParams.get('email');
  if (emailParam) {
    emailInput.value = emailParam;
  }

  // 绑定支付按钮点击事件
  payButton.addEventListener('click', handlePayment);

  // 修改页面内容，根据是否是试用来源
  updatePageContent();

  console.log('支付页面初始化完成');
}

// 根据来源更新页面内容
function updatePageContent() {
  const title = document.querySelector('.product-title');

  if (isTrial) {
    title.textContent = 'Day Progress Bar - 免费试用';
    payButton.textContent = '开始免费试用';
    document.querySelector('.payment-info p').textContent =
      '开始免费试用后30天，您将自动订阅高级版，费用为$1.99/月。您可以随时取消订阅。';
  } else {
    title.textContent = 'Day Progress Bar - Premium';
    payButton.textContent = '立即支付';
  }
}

// 验证邮箱格式
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 处理支付请求
async function handlePayment() {
  // 禁用按钮，防止重复点击
  payButton.disabled = true;
  payButton.textContent = '处理中...';

  // 获取表单数据
  const email = emailInput.value.trim();
  let selectedPaymentMethod = null;

  for (const input of paymentMethodInputs) {
    if (input.checked) {
      selectedPaymentMethod = input.value;
      break;
    }
  }

  // 验证邮箱
  if (!email || !validateEmail(email)) {
    alert('请输入有效的电子邮件地址');
    payButton.disabled = false;
    payButton.textContent = isTrial ? '开始免费试用' : '立即支付';
    return;
  }

  try {
    // 创建检查会话，并传递邮箱和支付方式
    const { sessionUrl } = await createCheckoutSession(
      MONTHLY_PRICE,
      email,
      selectedPaymentMethod
    );

    // 重定向到Stripe付款页面
    window.location.href = sessionUrl;
  } catch (error) {
    console.error('支付初始化失败:', error);
    alert('支付初始化失败: ' + error.message);

    // 恢复按钮状态
    payButton.disabled = false;
    payButton.textContent = isTrial ? '开始免费试用' : '立即支付';
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPaymentPage);