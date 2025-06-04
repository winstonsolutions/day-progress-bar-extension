# Clerk Authentication Setup for Day Progress Bar Extension

This document provides instructions on how to set up Clerk authentication for the Day Progress Bar Chrome extension.

## 1. Create a Clerk Account

1. Go to [Clerk.com](https://clerk.com/) and sign up for an account
2. Create a new application in your Clerk dashboard
3. Choose "Single Page App" as your application type

## 2. Configure Your Clerk Application

1. In your Clerk dashboard, go to the application you created
2. Navigate to "API Keys" in the sidebar
3. Copy your "Publishable Key" (starts with `pk_live_` or `pk_test_`)

## 3. Update the Extension Code

1. Open the `clerk-auth.js` file in your extension code
2. Replace the placeholder Clerk keys with your actual keys:

```javascript
// Replace these values with your actual Clerk configuration
const CLERK_PUBLISHABLE_KEY = 'your_publishable_key_here'; // From Clerk dashboard
const CLERK_BASE_URL = 'https://your-app-name.clerk.accounts.dev'; // Your Clerk domain
```

## 4. Configure Allowed Origins

1. In your Clerk dashboard, go to "Security & Setup" > "CORS & URLs"
2. Add the Chrome extension URL to the allowed origins:
   - Format: `chrome-extension://<your-extension-id>`
   - You can find your extension ID in Chrome by going to `chrome://extensions/` and enabling developer mode
3. Add the redirect URL:
   - Format: `chrome-extension://<your-extension-id>/subscription.html`
   - Also add: `chrome-extension://<your-extension-id>/payment.html`

## 5. Test the Integration

1. Load the updated extension in Chrome
2. Click on "Start Free Trial" or "Get one now" button
3. The Clerk authentication dialog should appear
4. After successful authentication, the payment process should continue

## 6. Configure the Backend

1. In your Clerk dashboard, go to "API Keys"
2. Copy your "Secret Key" (starts with `sk_live_` or `sk_test_`)
3. Add this key to your backend .env file:

```
CLERK_SECRET_KEY=your_secret_key_here
```

4. Install the Clerk backend SDK in your project:

```bash
npm install @clerk/clerk-sdk-node
```

5. Update your backend code to verify Clerk sessions as needed

## Troubleshooting

If you encounter any issues:

1. Check browser console for errors
2. Verify that your Clerk keys are correctly set
3. Ensure your extension ID is added to allowed origins in Clerk dashboard
4. Confirm that the Clerk domain in your code matches the one in your dashboard

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk JavaScript Reference](https://clerk.com/docs/references/javascript/overview)
- [Clerk Authentication API](https://clerk.com/docs/reference/clerkjs)