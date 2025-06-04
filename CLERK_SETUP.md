# Clerk Setup Guide for Chrome Extension

This guide will help you set up Clerk authentication for your Chrome extension.

## 1. Create a Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.dev/)
2. Create a new application or select an existing one
3. Note your Clerk Publishable Key and API Key

## 2. Get Your Extension ID

Your Chrome extension ID is crucial for Clerk configuration. There are two ways to get it:

### During Development:
1. Load your extension in Chrome using "Load unpacked"
2. The extension ID will be displayed in the extensions page
3. It's also available in your extension's popup when you click "Sign In"

### For Production:
1. Once published, your extension will have a permanent ID
2. Update your Clerk settings with this permanent ID

## 3. Configure Clerk Settings

In your Clerk Dashboard:

1. Go to **Authentication** → **URL Settings**

2. Add the following URLs:

   **Allowed Origins:**
   ```
   chrome-extension://{YOUR_EXTENSION_ID}
   ```

   **Redirect URLs:**
   ```
   chrome-extension://{YOUR_EXTENSION_ID}/auth-callback.html
   ```

   Replace `{YOUR_EXTENSION_ID}` with your actual extension ID.

3. Under **JWT Templates**, make sure the template includes the necessary user fields:
   - id
   - email
   - firstName
   - lastName

## 4. Update Your Extension Code

1. In `clerk-auth.js`, update the following constants:
   ```javascript
   const CLERK_PUBLISHABLE_KEY = 'your_publishable_key';
   const CLERK_BASE_URL = 'your_clerk_instance_url';
   ```

2. Ensure your manifest.json has the correct permissions:
   ```json
   "permissions": ["storage", "identity", "tabs"],
   "host_permissions": [
     "https://*.accounts.dev/",
     "https://api.clerk.dev/"
   ]
   ```

## 5. Testing Authentication

1. After setting up, click "Sign In" in your extension popup
2. You should be redirected to the Clerk authentication page
3. After successful authentication, you'll be redirected back to your extension
4. Check the debug output in auth-callback.html for any issues

## 6. Common Issues and Solutions

### Token Not Found Error

If you see "Token not found in URL" error:

1. Ensure your Clerk URL settings are correct
2. Check that your extension ID matches the one in your Clerk settings
3. Try clearing your browser cache and cookies

### CSP Issues

If you encounter Content Security Policy issues:

1. Make sure your manifest.json has the correct CSP settings
2. Avoid inline scripts in your extension pages
3. Use external script files instead

### Network Errors

If API calls to Clerk fail:

1. Check your internet connection
2. Verify that your Clerk instance is active
3. Ensure your Clerk keys are correct

## 7. Advanced Configuration

For more advanced Clerk settings and features, refer to the [Clerk Documentation](https://clerk.com/docs).