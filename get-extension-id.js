/**
 * This script helps you get your extension ID for Clerk configuration
 * Just open your popup and open the developer console to see your extension ID
 */

document.addEventListener('DOMContentLoaded', function() {
  const extensionId = chrome.runtime.id;
  console.log('-------------------------------------------------------');
  console.log('YOUR EXTENSION ID: ' + extensionId);
  console.log('-------------------------------------------------------');
  console.log('FOR CLERK CONFIGURATION, ADD THESE URLS:');
  console.log('Authorized URL: chrome-extension://' + extensionId + '/*');
  console.log('Redirect URL: chrome-extension://' + extensionId + '/auth-callback.html');
  console.log('-------------------------------------------------------');

  // Also create a helper div in the popup if it exists
  const container = document.querySelector('.container') || document.body;
  if (container) {
    const helperDiv = document.createElement('div');
    helperDiv.style.marginTop = '15px';
    helperDiv.style.padding = '10px';
    helperDiv.style.backgroundColor = '#e8f0fe';
    helperDiv.style.borderRadius = '4px';
    helperDiv.style.fontSize = '12px';
    helperDiv.style.color = '#1a73e8';

    helperDiv.innerHTML = `
      <strong>Extension ID:</strong> ${extensionId}<br>
      <strong>For Clerk Setup:</strong><br>
      • Go to your <a href="https://dashboard.clerk.dev" target="_blank">Clerk Dashboard</a><br>
      • Add these URLs to your application settings:<br>
      <code style="display:block; margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 4px;">
      Authorized URL: chrome-extension://${extensionId}/*<br>
      Redirect URL: chrome-extension://${extensionId}/auth-callback.html
      </code>
    `;

    container.appendChild(helperDiv);
  }
});