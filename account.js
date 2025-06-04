/**
 * Account management page for Day Progress Bar extension
 */

import { initClerk, openSignInModal, getCurrentUser, isAuthenticated, signOut } from './clerk-auth.js';
import { verifyLicense } from './api.js';

// Constants
const STATUS = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  EXPIRED: 'expired',
  FREE: 'free'
};

// DOM Elements
let loadingEl;
let notLoggedInEl;
let loggedInEl;
let userAvatarEl;
let userNameEl;
let userEmailEl;
let subscriptionStatusEl;
let statusBadgeEl;
let trialExpiresEl;
let freeUserViewEl;
let premiumUserViewEl;
let loginButtonEl;
let logoutButtonEl;
let startTrialButtonEl;
let activateLicenseButtonEl;
let licenseKeyInputEl;
let licenseKeyStatusEl;
let manageSubscriptionButtonEl;
let cancelSubscriptionButtonEl;
let subscriptionDetailsEl;

// Initialize the account page
document.addEventListener('DOMContentLoaded', async function() {
  // Get DOM elements
  loadingEl = document.getElementById('loading');
  notLoggedInEl = document.getElementById('not-logged-in');
  loggedInEl = document.getElementById('logged-in');
  userAvatarEl = document.getElementById('user-avatar');
  userNameEl = document.getElementById('user-name');
  userEmailEl = document.getElementById('user-email');
  subscriptionStatusEl = document.getElementById('subscription-status');
  statusBadgeEl = document.getElementById('status-badge');
  trialExpiresEl = document.getElementById('trial-expires');
  freeUserViewEl = document.getElementById('free-user-view');
  premiumUserViewEl = document.getElementById('premium-user-view');
  loginButtonEl = document.getElementById('login-button');
  logoutButtonEl = document.getElementById('logout-button');
  startTrialButtonEl = document.getElementById('start-trial-button');
  activateLicenseButtonEl = document.getElementById('activate-license-button');
  licenseKeyInputEl = document.getElementById('license-key-input');
  licenseKeyStatusEl = document.getElementById('license-key-status');
  manageSubscriptionButtonEl = document.getElementById('manage-subscription-button');
  cancelSubscriptionButtonEl = document.getElementById('cancel-subscription-button');
  subscriptionDetailsEl = document.getElementById('subscription-details');

  // Initialize Clerk authentication
  try {
    await initClerk();
    setupEventListeners();
    updateUI();
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    showError('Failed to initialize authentication. Please try again later.');
  }
});

// Set up event listeners
function setupEventListeners() {
  // Login button
  if (loginButtonEl) {
    loginButtonEl.addEventListener('click', async () => {
      try {
        const user = await openSignInModal();
        if (user) {
          updateUI();
        }
      } catch (error) {
        console.error('Login failed:', error);
        showError('Login failed. Please try again.');
      }
    });
  }

  // Logout button
  if (logoutButtonEl) {
    logoutButtonEl.addEventListener('click', async () => {
      try {
        await signOut();
        updateUI();
      } catch (error) {
        console.error('Logout failed:', error);
        showError('Logout failed. Please try again.');
      }
    });
  }

  // Start trial button
  if (startTrialButtonEl) {
    startTrialButtonEl.addEventListener('click', async () => {
      try {
        await startTrial();
      } catch (error) {
        console.error('Failed to start trial:', error);
        showError('Failed to start trial. Please try again later.');
      }
    });
  }

  // Activate license button
  if (activateLicenseButtonEl) {
    activateLicenseButtonEl.addEventListener('click', async () => {
      try {
        await activateLicense();
      } catch (error) {
        console.error('Failed to activate license:', error);
        showError('Failed to activate license. Please try again later.');
      }
    });
  }

  // Manage subscription button
  if (manageSubscriptionButtonEl) {
    manageSubscriptionButtonEl.addEventListener('click', () => {
      // Redirect to payment management page
      window.location.href = chrome.runtime.getURL('subscription.html');
    });
  }

  // Cancel subscription button
  if (cancelSubscriptionButtonEl) {
    cancelSubscriptionButtonEl.addEventListener('click', async () => {
      if (confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
        try {
          await cancelSubscription();
          updateUI();
        } catch (error) {
          console.error('Failed to cancel subscription:', error);
          showError('Failed to cancel subscription. Please try again later.');
        }
      }
    });
  }
}

// Update the UI based on authentication and subscription status
async function updateUI() {
  // Show loading state
  showLoading(true);

  if (isAuthenticated()) {
    // User is authenticated
    const user = getCurrentUser();
    const subscriptionData = await getSubscriptionData();

    // Update user info
    if (userNameEl && user) {
      userNameEl.textContent = user.firstName || user.email.split('@')[0];
    }

    if (userEmailEl && user) {
      userEmailEl.textContent = user.email;
    }

    if (userAvatarEl && user) {
      const initial = (user.firstName || user.email).charAt(0).toUpperCase();
      userAvatarEl.textContent = initial;
    }

    // Update subscription status
    updateSubscriptionUI(subscriptionData);

    // Show logged in view
    showLoggedInView();
  } else {
    // User is not authenticated
    showNotLoggedInView();
  }

  // Hide loading state
  showLoading(false);
}

// Update subscription UI elements
function updateSubscriptionUI(subscriptionData) {
  const status = subscriptionData.status || STATUS.FREE;

  // Update status text and badge
  if (subscriptionStatusEl) {
    if (status === STATUS.ACTIVE) {
      subscriptionStatusEl.textContent = 'Premium';
      statusBadgeEl.textContent = 'PRO';
      statusBadgeEl.className = 'status-badge premium-badge';
    } else if (status === STATUS.TRIAL) {
      subscriptionStatusEl.textContent = 'Trial';
      statusBadgeEl.textContent = 'TRIAL';
      statusBadgeEl.className = 'status-badge trial-badge';

      // Show trial expiration if available
      if (subscriptionData.trialEnds && trialExpiresEl) {
        const daysLeft = getDaysLeft(subscriptionData.trialEnds);
        trialExpiresEl.textContent = `Your trial expires in ${daysLeft} days`;
        trialExpiresEl.style.display = 'block';
      }
    } else {
      subscriptionStatusEl.textContent = 'Free';
      statusBadgeEl.textContent = 'FREE';
      statusBadgeEl.className = 'status-badge free-badge';
    }
  }

  // Show the appropriate view based on subscription status
  if (status === STATUS.ACTIVE || status === STATUS.TRIAL) {
    if (freeUserViewEl) freeUserViewEl.style.display = 'none';
    if (premiumUserViewEl) premiumUserViewEl.style.display = 'block';

    // Update subscription details if available
    if (subscriptionDetailsEl && subscriptionData.renewDate) {
      subscriptionDetailsEl.textContent = `Your subscription renews on ${formatDate(subscriptionData.renewDate)}`;
    }
  } else {
    if (freeUserViewEl) freeUserViewEl.style.display = 'block';
    if (premiumUserViewEl) premiumUserViewEl.style.display = 'none';
  }
}

// Start a free trial
async function startTrial() {
  try {
    // Update local storage
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial

    const subscriptionData = {
      status: STATUS.TRIAL,
      trialEnds: trialEndDate.toISOString(),
      features: {
        countdown: true
      }
    };

    await saveSubscriptionData(subscriptionData);

    // Open payment page to complete trial signup
    window.location.href = chrome.runtime.getURL('payment.html?trial=true');
  } catch (error) {
    console.error('Failed to start trial:', error);
    throw error;
  }
}

// Activate a license key
async function activateLicense() {
  try {
    const licenseKey = licenseKeyInputEl.value.trim();

    if (!licenseKey) {
      showLicenseError('Please enter a license key');
      return;
    }

    // Show loading state
    licenseKeyStatusEl.textContent = 'Verifying license...';
    licenseKeyStatusEl.className = 'license-key-status';
    licenseKeyStatusEl.style.display = 'block';

    // Verify license with backend
    const result = await verifyLicense(licenseKey);

    if (result.valid) {
      // Update subscription data
      const subscriptionData = {
        status: STATUS.ACTIVE,
        licenseKey: licenseKey,
        activatedDate: new Date().toISOString(),
        expiresDate: result.expiresAt,
        features: {
          countdown: true
        }
      };

      await saveSubscriptionData(subscriptionData);

      // Show success message
      licenseKeyStatusEl.textContent = 'License activated successfully!';
      licenseKeyStatusEl.className = 'license-key-status status-success';

      // Update UI
      setTimeout(() => {
        updateUI();
      }, 1500);
    } else {
      showLicenseError(result.message || 'Invalid license key');
    }
  } catch (error) {
    console.error('Failed to activate license:', error);
    showLicenseError(error.message || 'Failed to verify license');
  }
}

// Cancel subscription
async function cancelSubscription() {
  try {
    // Get current subscription data
    const subscriptionData = await getSubscriptionData();

    // Update status to FREE
    subscriptionData.status = STATUS.FREE;
    subscriptionData.canceledDate = new Date().toISOString();

    // Save updated subscription data
    await saveSubscriptionData(subscriptionData);

    return true;
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }
}

// Show license error
function showLicenseError(message) {
  if (licenseKeyStatusEl) {
    licenseKeyStatusEl.textContent = message;
    licenseKeyStatusEl.className = 'license-key-status status-error';
    licenseKeyStatusEl.style.display = 'block';
  }
}

// Show general error
function showError(message) {
  alert(message);
}

// Show loading state
function showLoading(isLoading) {
  if (loadingEl) {
    loadingEl.style.display = isLoading ? 'flex' : 'none';
  }
}

// Show logged in view
function showLoggedInView() {
  if (notLoggedInEl) notLoggedInEl.style.display = 'none';
  if (loggedInEl) loggedInEl.style.display = 'block';
}

// Show not logged in view
function showNotLoggedInView() {
  if (notLoggedInEl) notLoggedInEl.style.display = 'block';
  if (loggedInEl) loggedInEl.style.display = 'none';
}

// Get subscription data from storage
async function getSubscriptionData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['subscription'], function(result) {
      resolve(result.subscription || { status: STATUS.FREE });
    });
  });
}

// Save subscription data to storage
async function saveSubscriptionData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ subscription: data }, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Format date string
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateString;
  }
}

// Calculate days left until a date
function getDaysLeft(dateString) {
  try {
    const endDate = new Date(dateString);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  } catch (error) {
    console.error('Error calculating days left:', error);
    return 0;
  }
}