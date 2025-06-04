// Background script for handling subscription state

// Constants
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
};

// Check subscription status
function checkSubscriptionStatus() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['subscription'], (result) => {
      const subscription = result.subscription || {
        status: STATUS.FREE,
        features: {
          countdown: false
        }
      };

      // Check if trial has expired
      if (subscription.status === STATUS.TRIAL) {
        const now = new Date();
        const trialEnds = new Date(subscription.trialEnds);

        if (now > trialEnds) {
          subscription.status = STATUS.EXPIRED;
          subscription.features.countdown = false;

          // Save the updated status
          chrome.storage.sync.set({ subscription });
        }
      }

      resolve(subscription);
    });
  });
}

// Check if a specific feature is enabled
async function isFeatureEnabled(featureName) {
  const subscription = await checkSubscriptionStatus();
  return subscription.features && subscription.features[featureName] === true;
}

// Add context menu for subscription management
function setupContextMenu() {
  chrome.contextMenus.create({
    id: 'manage-subscription',
    title: 'Manage Subscription',
    contexts: ['action']
  });
}

// Open subscription page when menu item clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'manage-subscription') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('subscription.html')
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkFeature') {
    isFeatureEnabled(message.feature).then(enabled => {
      sendResponse({ enabled });
    });
    return true; // Required for async response
  }

  if (message.action === 'openSubscription') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('subscription.html')
    });
    sendResponse({ success: true });
    return true;
  }
});

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  // Check if permissions exist for context menus
  if (chrome.contextMenus) {
    setupContextMenu();
  }

  // Initialize subscription status if not set
  checkSubscriptionStatus();
});