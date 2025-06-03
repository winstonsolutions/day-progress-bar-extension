// Subscription management for Work Hours Progress Bar extension
import { API_BASE_URL, createCheckoutSession, verifyLicense, requestLicenseKey, verifyPaymentStatus } from './api.js';
import { initClerk, openSignInModal, getCurrentUser, isAuthenticated } from './clerk-auth.js';

// Constants
const MONTHLY_PRICE = 1.99;
const TRIAL_PERIOD_DAYS = 30;

// Subscription status types
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
};

// 实际的支付API实现，与Stripe集成
const PaymentAPI = {
  initiatePayment: async function(priceInUSD, email = null) {
    try {
      // First check if user is authenticated with Clerk
      if (!isAuthenticated()) {
        // Open Clerk sign-in modal and wait for authentication
        const user = await openSignInModal();

        // If user canceled authentication, abort payment process
        if (!user) {
          throw new Error('Authentication required to continue with payment');
        }

        // Use authenticated user's email
        email = user.email;
      } else if (!email) {
        // If not provided, use the authenticated user's email
        const user = getCurrentUser();
        email = user.email;
      }

      // 使用API模块创建Stripe结账会话，传递邮箱参数
      const { sessionUrl } = await createCheckoutSession(priceInUSD, email);

      // 打开Stripe结账页面
      window.open(sessionUrl, '_blank');

      return {
        success: true,
        transactionId: 'pending_stripe_confirmation',
        timestamp: new Date().toISOString(),
        email: email
      };
    } catch (error) {
      console.error('Payment initiation failed:', error);
      throw new Error('Payment initiation failed: ' + error.message);
    }
  },

  // 验证支付状态
  verifyPaymentStatus: async function(transactionId) {
    try {
      return await verifyPaymentStatus(transactionId);
    } catch (error) {
      console.error('Payment verification failed:', error);
      throw error;
    }
  },

  // 邮箱验证函数
  isValidEmail: function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// Store subscription data
class SubscriptionManager {
  constructor() {
    console.log('初始化订阅管理器...');
    // 初始化默认订阅数据，防止undefined错误
    this.subscriptionData = {
      status: STATUS.FREE,
      features: {
        countdown: false
      }
    };

    // 异步加载数据，但确保有默认值
    this.loadSubscriptionData().then(() => {
      // Initialize Clerk first
      return initClerk();
    }).then(() => {
      this.updateUI();
      this.setupEventListeners();

      // 检查URL参数，处理支付成功返回
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment_success') === 'true') {
        this.handlePaymentSuccess();
      } else if (urlParams.get('payment_cancelled') === 'true') {
        this.handlePaymentCancelled();
      }

      console.log('订阅管理器初始化完成');
    }).catch(error => {
      console.error('加载订阅数据或初始化Clerk时出错:', error);
    });
  }

  // 处理支付成功的回调
  async handlePaymentSuccess() {
    // 显示支付处理中的消息
    const statusContainer = document.getElementById('status-container');
    statusContainer.innerHTML = `<div class="status-message status-active">
      Payment received! Processing your subscription...
    </div>`;

    // 等待几秒以确保后端处理了webhook
    setTimeout(() => {
      // 刷新订阅状态
      this.loadSubscriptionData().then(() => {
        this.updateUI();
      });
    }, 3000);
  }

  // 处理支付取消的回调
  handlePaymentCancelled() {
    const statusContainer = document.getElementById('status-container');
    statusContainer.innerHTML = `<div class="status-message status-expired">
      Payment was cancelled. You can try again when ready.
    </div>`;
  }

  async loadSubscriptionData() {
    // Load subscription data from storage
    console.log('正在从存储加载订阅数据...');
    try {
      const data = await new Promise(resolve => {
        chrome.storage.sync.get(['subscription'], function(result) {
          resolve(result.subscription || {});
        });
      });

      console.log('从存储加载的订阅数据:', data);

      // 如果数据不为空，更新subscriptionData
      if (data && Object.keys(data).length > 0) {
        this.subscriptionData = data;
      }

      // 如果没有状态或其他必要字段，初始化为FREE状态
      if (!this.subscriptionData.status) {
        console.log('未找到有效的订阅状态，设置为FREE');
        this.subscriptionData = {
          status: STATUS.FREE,
          features: {
            countdown: false
          }
        };
        await this.saveSubscriptionData();
      }

      console.log('订阅数据加载完成:', this.subscriptionData);
      return this.subscriptionData;
    } catch (error) {
      console.error('加载订阅数据时发生异常:', error);
      // 确保即使出错，也有默认值
      this.subscriptionData = {
        status: STATUS.FREE,
        features: {
          countdown: false
        }
      };
      return this.subscriptionData;
    }
  }

  saveSubscriptionData() {
    console.log('正在保存订阅数据:', this.subscriptionData);
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.set({
          subscription: this.subscriptionData
        }, () => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.error('保存数据时出错:', error);
            reject(error);
          } else {
            console.log('订阅数据保存成功');
            resolve();
          }
        });
      } catch (error) {
        console.error('保存订阅数据时发生异常:', error);
        reject(error);
      }
    });
  }

  async startTrial() {
    console.log('开始设置试用状态...');

    // First ensure user is authenticated with Clerk
    if (!isAuthenticated()) {
      const user = await openSignInModal();
      if (!user) {
        throw new Error('Authentication required to start trial');
      }
    }

    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(now.getDate() + TRIAL_PERIOD_DAYS);

    this.subscriptionData = {
      status: STATUS.TRIAL,
      features: {
        countdown: true
      },
      trialStarted: now.toISOString(),
      trialEnds: trialEndDate.toISOString(),
      clerkUserId: getCurrentUser().id,
      email: getCurrentUser().email
    };

    console.log('试用数据准备完毕:', this.subscriptionData);

    try {
      await this.saveSubscriptionData();
      console.log('试用数据已保存到存储');
      this.updateUI();
      return true;
    } catch (error) {
      console.error('保存试用数据失败:', error);
      throw error;
    }
  }

  async subscribe() {
    try {
      // Ensure user is authenticated with Clerk
      if (!isAuthenticated()) {
        const user = await openSignInModal();
        if (!user) {
          throw new Error('Authentication required to subscribe');
        }
      }

      const user = getCurrentUser();
      const paymentResult = await PaymentAPI.initiatePayment(MONTHLY_PRICE, user.email);

      const now = new Date();
      const nextBillingDate = new Date(now);
      nextBillingDate.setMonth(now.getMonth() + 1);

      this.subscriptionData = {
        status: STATUS.ACTIVE,
        features: {
          countdown: true
        },
        subscriptionStarted: now.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        latestTransaction: paymentResult,
        clerkUserId: user.id,
        email: user.email
      };

      await this.saveSubscriptionData();
      this.updateUI();
      return true;
    } catch (error) {
      console.error('Subscription failed:', error);
      return false;
    }
  }

  async cancelSubscription() {
    const confirmed = confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.');

    if (confirmed) {
      this.subscriptionData.cancelledOn = new Date().toISOString();
      this.subscriptionData.status = STATUS.FREE; // Will immediately downgrade for simplicity
      this.subscriptionData.features.countdown = false;

      await this.saveSubscriptionData();
      this.updateUI();
      return true;
    }

    return false;
  }

  checkSubscriptionStatus() {
    console.log('检查订阅状态...');

    // 确保subscriptionData已初始化
    if (!this.subscriptionData) {
      console.log('subscriptionData未初始化，使用默认FREE状态');
      return STATUS.FREE;
    }

    // 确保status已设置
    if (!this.subscriptionData.status) {
      console.log('status未设置，使用默认FREE状态');
      return STATUS.FREE;
    }

    const now = new Date();

    if (this.subscriptionData.status === STATUS.TRIAL) {
      // 确保trialEnds已设置
      if (!this.subscriptionData.trialEnds) {
        console.log('trialEnds未设置，但状态为TRIAL，修正为FREE状态');
        this.subscriptionData.status = STATUS.FREE;
        this.subscriptionData.features = { countdown: false };
        this.saveSubscriptionData();
        return STATUS.FREE;
      }

      const trialEnds = new Date(this.subscriptionData.trialEnds);

      if (now > trialEnds) {
        console.log('试用期已过期，更新状态为EXPIRED');
        this.subscriptionData.status = STATUS.EXPIRED;
        this.subscriptionData.features.countdown = false;
        this.saveSubscriptionData();
      }
    }

    console.log('当前订阅状态:', this.subscriptionData.status);
    return this.subscriptionData.status;
  }

  isFeatureEnabled(featureName) {
    return this.subscriptionData.features && this.subscriptionData.features[featureName] === true;
  }

  updateUI() {
    console.log('更新UI...');
    const statusContainer = document.getElementById('status-container');
    const subscribeButton = document.getElementById('subscribe-button');
    const licenseKeyInput = document.getElementById('license-key-input');
    const licenseStatus = document.getElementById('license-status');

    // 检查DOM元素是否存在
    if (!statusContainer || !subscribeButton) {
      console.error('找不到必要的DOM元素，无法更新UI');
      return;
    }

    // 清空状态容器
    statusContainer.innerHTML = '';

    // 获取当前订阅状态
    const status = this.checkSubscriptionStatus();
    console.log('UI更新 - 当前状态:', status);

    // 创建状态消息元素
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message';

    switch (status) {
      case STATUS.ACTIVE:
        statusMessage.classList.add('status-active');
        statusMessage.innerHTML = `
          <strong>Active Subscription</strong>
          <p style="margin: 5px 0 0;">Your premium features are active.</p>
        `;

        // 如果有许可证密钥，显示它
        if (this.subscriptionData.licenseKey) {
          const expirationDate = new Date(this.subscriptionData.expirationDate);
          const now = new Date();
          const daysLeft = this.getDaysLeft(this.subscriptionData.expirationDate);

          statusMessage.innerHTML += `
            <p style="margin: 5px 0 0;">
              License: ${this.subscriptionData.licenseKey.substr(0, 8)}...${this.subscriptionData.licenseKey.substr(-8)}
            </p>
            <p style="margin: 5px 0 0;">
              Valid until: ${this.formatDate(this.subscriptionData.expirationDate)} (${daysLeft} days left)
            </p>
          `;

          // 如果有许可证输入框，则预填充并禁用
          if (licenseKeyInput) {
            licenseKeyInput.value = this.subscriptionData.licenseKey;
            licenseKeyInput.disabled = true;
            licenseStatus.textContent = 'License active';
            licenseStatus.style.color = '#188038';
            licenseStatus.style.display = 'block';
          }
        }

        subscribeButton.textContent = 'Cancel Subscription';
        break;

      case STATUS.TRIAL:
        // 计算试用期剩余天数
        const daysLeft = this.getDaysLeft(this.subscriptionData.trialEnds);

        statusMessage.classList.add('status-trial');
        statusMessage.innerHTML = `
          <strong>Trial Active</strong>
          <p style="margin: 5px 0 0;">
            You have ${daysLeft} days left in your trial.
            Subscribe now to keep access to premium features.
          </p>
        `;
        subscribeButton.textContent = 'Subscribe Now';
        break;

      case STATUS.EXPIRED:
        statusMessage.classList.add('status-expired');
        statusMessage.innerHTML = `
          <strong>Trial Expired</strong>
          <p style="margin: 5px 0 0;">
            Your trial period has ended.
            Subscribe now to regain access to premium features.
          </p>
        `;
        subscribeButton.textContent = 'Subscribe Now';
        break;

      default: // FREE
        subscribeButton.textContent = 'Start Free Trial';
        break;
    }

    // 只有当有状态消息时才添加到容器
    if (status !== STATUS.FREE) {
      statusContainer.appendChild(statusMessage);
    }

    console.log('UI更新完成');
  }

  formatDate(dateString) {
    try {
      if (!dateString) {
        console.warn('formatDate接收到空日期字符串');
        return 'Unknown date';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('formatDate接收到无效日期字符串:', dateString);
        return 'Invalid date';
      }
      return date.toLocaleDateString();
    } catch (error) {
      console.error('格式化日期时出错:', error);
      return 'Error formatting date';
    }
  }

  getDaysLeft(endDateString) {
    try {
      if (!endDateString) {
        console.warn('getDaysLeft接收到空日期字符串');
        return 0;
      }
      const now = new Date();
      const endDate = new Date(endDateString);

      if (isNaN(endDate.getTime())) {
        console.warn('getDaysLeft接收到无效日期字符串:', endDateString);
        return 0;
      }

      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('计算剩余天数时出错:', error);
      return 0;
    }
  }

  setupEventListeners() {
    console.log('设置事件监听器...');

    const subscribeButton = document.getElementById('subscribe-button');
    if (subscribeButton) {
      console.log('找到订阅按钮，添加点击事件监听器');

      // 移除任何现有的事件监听器
      subscribeButton.removeEventListener('click', this.handleSubscribeClick);

      // 使用箭头函数确保this指向正确
      this.handleSubscribeClick = async () => {
        console.log('订阅按钮被点击');
        const status = this.checkSubscriptionStatus();
        console.log('当前订阅状态:', status);

        try {
          switch (status) {
            case STATUS.ACTIVE:
              await this.cancelSubscription();
              break;
            case STATUS.FREE:
              console.log('开始免费试用');
              // 先进行Clerk身份验证
              if (!isAuthenticated()) {
                const user = await openSignInModal();
                if (!user) {
                  console.log('用户取消了身份验证');
                  return;
                }
              }
              // 跳转到自定义支付页面，并标记为试用模式
              window.location.href = chrome.runtime.getURL('payment.html?trial=true');
              break;
            default:
              // 先进行Clerk身份验证
              if (!isAuthenticated()) {
                const user = await openSignInModal();
                if (!user) {
                  console.log('用户取消了身份验证');
                  return;
                }
              }
              // 跳转到自定义支付页面
              window.location.href = chrome.runtime.getURL('payment.html');
              break;
          }
        } catch (error) {
          console.error('订阅操作失败:', error);
          alert('操作失败，请重试: ' + error.message);
        }
      };

      // 添加点击事件监听器
      subscribeButton.addEventListener('click', this.handleSubscribeClick);
    } else {
      console.error('找不到订阅按钮元素！');
    }

    // License key functionality
    const saveLicenseButton = document.getElementById('save-license-button');
    const licenseKeyInput = document.getElementById('license-key-input');
    const licenseStatus = document.getElementById('license-status');
    const showRequestFormButton = document.getElementById('show-request-form-button');
    const requestLicenseForm = document.getElementById('request-license-form');
    const licenseEmailInput = document.getElementById('license-email-input');
    const requestLicenseButton = document.getElementById('request-license-button');
    const requestLicenseStatus = document.getElementById('request-license-status');

    if (saveLicenseButton && licenseKeyInput && licenseStatus) {
      saveLicenseButton.addEventListener('click', async () => {
        // Ensure user is authenticated with Clerk
        if (!isAuthenticated()) {
          const user = await openSignInModal();
          if (!user) {
            this.showLicenseError('Authentication required to activate license');
            return;
          }
        }

        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey) {
          this.showLicenseError('Please enter a license key');
          return;
        }

        licenseStatus.style.display = 'block';
        licenseStatus.textContent = 'Verifying license...';
        licenseStatus.style.color = '#1a73e8'; // Info blue color

        try {
          // 调用后端验证许可证
          const result = await this.activateLicense(licenseKey);

          if (result.success) {
            licenseStatus.style.color = '#188038'; // Success green color
            licenseStatus.textContent = result.message || 'License activated successfully!';
          } else {
            this.showLicenseError(result.message || 'Invalid license key!');
          }
        } catch (error) {
          this.showLicenseError(error.message || 'Failed to verify license');
        }
      });
    }

    // 显示/隐藏许可证请求表单
    if (showRequestFormButton) {
      showRequestFormButton.addEventListener('click', async () => {
        // Ensure user is authenticated with Clerk
        if (!isAuthenticated()) {
          const user = await openSignInModal();
          if (!user) {
            console.log('用户取消了身份验证');
            return;
          }
        }

        // 跳转到自定义支付页面
        window.location.href = chrome.runtime.getURL('payment.html?source=license');
      });
    }

    // 请求许可证按钮逻辑
    if (requestLicenseButton && licenseEmailInput && requestLicenseStatus) {
      requestLicenseButton.addEventListener('click', async () => {
        const email = licenseEmailInput.value.trim();

        if (!email || !this.isValidEmail(email)) {
          requestLicenseStatus.textContent = 'Please enter a valid email address';
          requestLicenseStatus.style.color = '#d93025'; // Error red color
          requestLicenseStatus.style.display = 'block';
          return;
        }

        requestLicenseStatus.textContent = 'Requesting license...';
        requestLicenseStatus.style.color = '#1a73e8'; // Info blue color
        requestLicenseStatus.style.display = 'block';

        try {
          const result = await this.requestLicenseKey(email);

          if (result.success) {
            requestLicenseStatus.textContent = result.message || 'License key request sent! Check your email.';
            requestLicenseStatus.style.color = '#188038'; // Success green color
          } else {
            requestLicenseStatus.textContent = result.message || 'Failed to request license key';
            requestLicenseStatus.style.color = '#d93025'; // Error red color
          }
        } catch (error) {
          requestLicenseStatus.textContent = error.message || 'An error occurred';
          requestLicenseStatus.style.color = '#d93025'; // Error red color
        }
      });
    }
  }

  showLicenseError(message) {
    const licenseStatus = document.getElementById('license-status');
    if (licenseStatus) {
      licenseStatus.style.color = '#d93025'; // Error red color
      licenseStatus.textContent = message;
      licenseStatus.style.display = 'block';
    }
  }

  validateLicenseKey(licenseKey) {
    // In a real app, this would verify the license with a server
    // For demo purposes, we'll use a simple format check
    // A real implementation would include cryptographic verification

    // Simple check: must be at least 20 characters and contain letters and numbers
    const isValidFormat = licenseKey.length >= 20 &&
                          /[A-Z]/.test(licenseKey) &&
                          /[0-9]/.test(licenseKey) &&
                          /[-]/.test(licenseKey);

    return isValidFormat;
  }

  async activateLicense(licenseKey) {
    try {
      // Ensure user is authenticated with Clerk
      if (!isAuthenticated()) {
        const user = await openSignInModal();
        if (!user) {
          return { success: false, message: 'Authentication required to activate license' };
        }
      }

      const user = getCurrentUser();

      // 调用API模块验证许可证密钥
      const licenseData = await verifyLicense(licenseKey);

      if (licenseData.valid) {
        // 更新订阅状态
        this.subscriptionData = {
          status: STATUS.ACTIVE,
          features: {
            countdown: true
          },
          licenseKey: licenseKey,
          licenseActivatedOn: new Date().toISOString(),
          licenseExpiresOn: licenseData.expiresAt,
          clerkUserId: user.id,
          email: user.email
        };

        await this.saveSubscriptionData();
        this.updateUI();
        return { success: true, message: 'License activated successfully!' };
      } else {
        throw new Error(licenseData.message || 'Invalid license key');
      }
    } catch (error) {
      console.error('License activation failed:', error);
      return { success: false, message: error.message };
    }
  }

  // 请求获取许可证密钥的函数
  async requestLicenseKey(email) {
    try {
      // 使用API模块请求许可证密钥
      const data = await requestLicenseKey(email);
      return { success: true, message: data.message || 'License key request submitted successfully!' };
    } catch (error) {
      console.error('License key request failed:', error);
      return { success: false, message: error.message };
    }
  }

  // 邮箱格式验证函数
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Initialize subscription manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('订阅页面已加载，初始化订阅管理器...');
  try {
    window.subscriptionManager = new SubscriptionManager();
    console.log('订阅管理器初始化完成');
  } catch (error) {
    console.error('初始化订阅管理器时发生错误:', error);
    alert('初始化订阅管理器时发生错误: ' + error.message);
  }
});