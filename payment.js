/**
 * Payment Page JavaScript
 * 使用Stripe Checkout进行支付
 */

import { createCheckoutSession } from './api.js';

// 常量定义
const MONTHLY_PRICE = 1.99;

// 获取DOM元素
const emailInput = document.getElementById('email');
const checkoutButton = document.getElementById('checkout-button');

/**
 * 初始化支付页面
 */
function initPaymentPage() {
  // 获取URL参数
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');

  // 如果URL中包含email参数，则填充表单
  if (emailParam) {
    emailInput.value = emailParam;
  }

  // 绑定结账按钮点击事件
  checkoutButton.addEventListener('click', handleCheckout);
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
 * 处理结账流程
 */
async function handleCheckout(event) {
  event.preventDefault();

  // 获取并验证邮箱
  const email = emailInput.value.trim();

  if (!email || !validateEmail(email)) {
    emailInput.classList.add('error');
    alert('请输入有效的邮箱地址');
    return;
  }

  // 禁用结账按钮，防止重复点击
  checkoutButton.disabled = true;
  const originalText = checkoutButton.textContent;
  checkoutButton.textContent = 'Processing...';

  try {
    // 创建Stripe结账会话
    const { sessionUrl } = await createCheckoutSession(
      MONTHLY_PRICE,
      email
    );

    // 重定向到Stripe结账页面
    window.location.href = sessionUrl;
  } catch (error) {
    console.error('结账会话创建失败:', error);

    // 显示错误消息给用户
    alert('支付服务连接失败，请稍后再试。\n\n错误信息: ' + error.message);

    // 恢复按钮状态
    checkoutButton.disabled = false;
    checkoutButton.textContent = originalText;
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPaymentPage);