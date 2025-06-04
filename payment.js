/**
 * Payment Page JavaScript
 * 使用Stripe Checkout进行支付
 */

import { createCheckoutSession } from './api.js';
import { initClerk, openSignInModal, getCurrentUser, isAuthenticated } from './clerk-auth.js';

// 常量定义
const MONTHLY_PRICE = 1.99;

// 获取DOM元素
const emailInput = document.getElementById('email');
const checkoutButton = document.getElementById('checkout-button');

/**
 * 初始化支付页面
 */
async function initPaymentPage() {
  // 初始化Clerk
  try {
    await initClerk();
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
  }

  // 确保用户已经登录
  if (!isAuthenticated()) {
    try {
      const user = await openSignInModal();
      if (!user) {
        // 如果用户取消登录，返回到上一页
        window.history.back();
        return;
      }
      // 如果登录成功，用用户的邮箱填充表单
      if (emailInput) {
        emailInput.value = user.email;
        emailInput.disabled = true; // 禁用输入框，防止修改
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      window.history.back(); // 返回上一页
      return;
    }
  } else {
    // 用户已登录，直接填充邮箱
    const user = getCurrentUser();
    if (emailInput && user && user.email) {
      emailInput.value = user.email;
      emailInput.disabled = true; // 禁用输入框，防止修改
    }
  }

  // 获取URL参数
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email');

  // 如果URL中包含email参数且邮箱输入框未被填充，则填充表单
  if (emailParam && emailInput && !emailInput.value) {
    emailInput.value = emailParam;
  }

  // 绑定结账按钮点击事件
  if (checkoutButton) {
    checkoutButton.addEventListener('click', handleCheckout);
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
 * 处理结账流程
 */
async function handleCheckout(event) {
  event.preventDefault();

  // 确保用户已登录
  if (!isAuthenticated()) {
    try {
      const user = await openSignInModal();
      if (!user) {
        alert('请先登录以继续支付流程');
        return;
      }
      // 更新邮箱输入框
      if (emailInput) {
        emailInput.value = user.email;
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      alert('登录失败，请重试');
      return;
    }
  }

  // 获取当前登录用户的邮箱
  const user = getCurrentUser();
  let email = user ? user.email : null;

  // 如果邮箱输入框存在并且有值，使用输入框的值
  if (emailInput && emailInput.value.trim()) {
    email = emailInput.value.trim();
  }

  if (!email || !validateEmail(email)) {
    if (emailInput) {
      emailInput.classList.add('error');
    }
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