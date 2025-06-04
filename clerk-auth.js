/**
 * Clerk Authentication for Day Progress Bar Extension
 * Handles user authentication using Clerk
 */

import { API_BASE_URL } from './api.js';

// Constants
const CLERK_PUBLISHABLE_KEY = 'pk_test_Z2xhZC10cm91dC0yNC5jbGVyay5hY2NvdW50cy5kZXYk'; // Replace with your actual key
const CLERK_BASE_URL = 'https://glad-trout-24.clerk.accounts.dev'; // Correct Clerk domain
const CLERK_API_URL = 'https://api.clerk.dev/v1';

// Store user data
let currentUser = null;
let clerkToken = null;

/**
 * Initialize Clerk authentication
 */
async function initClerk() {
  try {
    // Check if we have a token in storage
    const storedAuth = await chrome.storage.local.get(['clerkToken', 'clerkUser']);

    if (storedAuth.clerkToken && storedAuth.clerkUser) {
      clerkToken = storedAuth.clerkToken;
      currentUser = storedAuth.clerkUser;

      // Verify the token is still valid
      const isValid = await verifyToken(clerkToken);
      if (isValid) {
        return currentUser;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    throw error;
  }
}

/**
 * Verify if the token is still valid
 */
async function verifyToken(token) {
  try {
    const response = await fetch(`${CLERK_API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Open authentication page in a new tab
 * @returns {Promise<Object|null>} User data if sign-in successful, null otherwise
 */
async function openSignInModal() {
  // Create a sign-in URL with your Frontend API
  const authUrl = `${CLERK_BASE_URL}/sign-in?redirect_url=${encodeURIComponent(chrome.runtime.getURL('auth-callback.html'))}`;

  console.log('Opening auth URL:', authUrl);

  // Open auth in a new tab/window
  chrome.tabs.create({ url: authUrl });

  // The actual authentication will be handled by the auth-callback.html page
  // which will receive the token and store it

  // Return null for now, the actual user info will be available after the callback completes
  return null;
}

/**
 * Handle auth callback
 * @param {string} token - The auth token from Clerk
 * @param {Object} user - User information
 */
async function handleAuthCallback(token, user) {
  if (token && user) {
    clerkToken = token;
    currentUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    // Store in Chrome storage
    await chrome.storage.local.set({
      clerkToken: token,
      clerkUser: currentUser
    });

    return currentUser;
  }
  return null;
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
  return currentUser !== null && clerkToken !== null;
}

/**
 * Sign out current user
 */
async function signOut() {
  try {
    // Clear local data
    currentUser = null;
    clerkToken = null;

    // Clear from storage
    await chrome.storage.local.remove(['clerkToken', 'clerkUser']);

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
        'Authorization': `Bearer ${clerkToken}`
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
  storeUserData,
  handleAuthCallback
};