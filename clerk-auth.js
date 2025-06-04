/**
 * Clerk Authentication for Day Progress Bar Extension
 * Handles user authentication using Clerk
 */

import { API_BASE_URL } from './api.js';

// Constants
const CLERK_PUBLISHABLE_KEY = 'pk_test_Z2xhZC10cm91dC0yNC5jbGVyay5hY2NvdW50cy5kZXYk'; // Replace with your actual key
const CLERK_BASE_URL = 'https://glad-trout-24.clerk.accounts.dev'; // Replace with your Clerk domain

// Store user data
let currentUser = null;

/**
 * Initialize Clerk
 */
async function initClerk() {
  try {
    // Dynamically load Clerk script
    await loadClerkScript();

    // Initialize Clerk with your publishable key
    window.Clerk.load({
      publishableKey: CLERK_PUBLISHABLE_KEY
    });

    // Wait for Clerk to be ready
    await new Promise(resolve => {
      if (window.Clerk.loaded) {
        resolve();
      } else {
        window.Clerk.addListener('load', () => resolve());
      }
    });

    // Check if user is already signed in
    if (window.Clerk.user) {
      currentUser = {
        id: window.Clerk.user.id,
        email: window.Clerk.user.primaryEmailAddress?.emailAddress,
        firstName: window.Clerk.user.firstName,
        lastName: window.Clerk.user.lastName
      };
      return currentUser;
    }

    return null;
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    throw error;
  }
}

/**
 * Load Clerk script dynamically
 */
function loadClerkScript() {
  return new Promise((resolve, reject) => {
    if (window.Clerk) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `${CLERK_BASE_URL}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Clerk script'));
    document.head.appendChild(script);
  });
}

/**
 * Open Clerk sign-in modal
 * @returns {Promise<Object|null>} User data if sign-in successful, null otherwise
 */
async function openSignInModal() {
  if (!window.Clerk) {
    await initClerk();
  }

  try {
    const result = await window.Clerk.openSignIn({
      redirectUrl: window.location.href,
    });

    if (result.createdSessionId) {
      // User successfully signed in
      currentUser = {
        id: window.Clerk.user.id,
        email: window.Clerk.user.primaryEmailAddress?.emailAddress,
        firstName: window.Clerk.user.firstName,
        lastName: window.Clerk.user.lastName
      };
      return currentUser;
    }

    return null;
  } catch (error) {
    console.error('Sign-in failed:', error);
    return null;
  }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user data or null if not authenticated
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Sign out current user
 */
async function signOut() {
  if (!window.Clerk) {
    await initClerk();
  }

  try {
    await window.Clerk.signOut();
    currentUser = null;
    return true;
  } catch (error) {
    console.error('Sign-out failed:', error);
    return false;
  }
}

/**
 * Store user data in MongoDB via backend
 * @param {Object} userData Additional user data to store
 * @returns {Promise<Object>} Response from backend
 */
async function storeUserData(userData) {
  if (!isAuthenticated()) {
    throw new Error('User must be authenticated to store data');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerkId: currentUser.id,
        email: currentUser.email,
        ...userData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to store user data');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to store user data:', error);
    throw error;
  }
}

// Export auth functions
export {
  initClerk,
  openSignInModal,
  getCurrentUser,
  isAuthenticated,
  signOut,
  storeUserData
};