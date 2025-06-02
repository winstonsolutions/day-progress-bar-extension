// Subscription management for Work Hours Progress Bar extension

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

// Mock Google payment API - In production, this would use actual Google payment APIs
const PaymentAPI = {
  initiatePayment: async function(priceInUSD) {
    // In a real implementation, this would open Google's payment dialog
    // For demo purposes, we'll use a simple confirm dialog
    const confirmed = confirm(`Confirm payment of $${priceInUSD}/month for Premium features?`);

    if (confirmed) {
      return {
        success: true,
        transactionId: 'tr_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString()
      };
    } else {
      throw new Error('Payment cancelled by user');
    }
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
      this.updateUI();
      this.setupEventListeners();
      console.log('订阅管理器初始化完成');
    }).catch(error => {
      console.error('加载订阅数据时出错:', error);
    });
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

    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(now.getDate() + TRIAL_PERIOD_DAYS);

    this.subscriptionData = {
      status: STATUS.TRIAL,
      features: {
        countdown: true
      },
      trialStarted: now.toISOString(),
      trialEnds: trialEndDate.toISOString()
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
      const paymentResult = await PaymentAPI.initiatePayment(MONTHLY_PRICE);

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
        latestTransaction: paymentResult
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
              await this.startTrial();
              alert('免费试用已激活！请刷新网页以使用倒计时功能。');
              break;
            default:
              await this.subscribe();
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
    const getLicenseButton = document.getElementById('get-license-button');

    if (saveLicenseButton && licenseKeyInput && licenseStatus) {
      saveLicenseButton.addEventListener('click', () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey) {
          this.showLicenseError('Please enter a license key');
          return;
        }

        // Validate license key (in a real app, this would verify with a server)
        if (this.validateLicenseKey(licenseKey)) {
          this.activateLicense(licenseKey);
          licenseStatus.style.color = '#188038'; // Success green color
          licenseStatus.textContent = 'License activated successfully!';
          licenseStatus.style.display = 'block';
        } else {
          this.showLicenseError('Invalid license key!');
        }
      });
    }

    if (getLicenseButton) {
      getLicenseButton.addEventListener('click', () => {
        // In a real app, this would redirect to a purchase page
        alert('In a production app, this would redirect to a purchase page where users can buy a license key.');
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
    // Set subscription to active with the license key
    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(now.getFullYear() + 1);

    this.subscriptionData = {
      status: STATUS.ACTIVE,
      features: {
        countdown: true
      },
      licenseKey: licenseKey,
      activationDate: now.toISOString(),
      expirationDate: nextYear.toISOString()
    };

    await this.saveSubscriptionData();
    this.updateUI();
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