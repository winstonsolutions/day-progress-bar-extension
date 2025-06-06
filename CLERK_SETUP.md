# Clerk Setup Guide for Chrome Extension

This guide will help you set up Clerk authentication for your Chrome extension with direct redirect to the extension page.

## 1. Get Your Extension ID

Your Chrome extension ID is crucial for Clerk configuration:

1. 在Chrome中加载扩展（使用"加载已解压的扩展程序"）
2. 查看扩展页面获取ID（或在扩展弹出窗口中查看）
3. 也可以通过点击"登录"按钮，在控制台日志中找到扩展ID

## 2. Configure Clerk Dashboard Settings

在Clerk Dashboard中：

1. 进入**应用程序 > [你的应用]**
2. 转到**JWT Templates**部分：
   - 确保包含必要的用户字段：id, email, firstName, lastName
   - 调整过期时间如果需要（推荐30天或更长）

3. 转到**User & Authentication > URL Settings**：

   **重要！添加以下URLs：**

   **允许的Origins（Allowed Origins）：**
   ```
   chrome-extension://YOUR_EXTENSION_ID
   ```

   **重定向URLs（Redirect URLs）：**
   ```
   chrome-extension://YOUR_EXTENSION_ID/auth-callback.html
   ```

   **登录后URLs（After Sign In URLs）：**
   ```
   chrome-extension://YOUR_EXTENSION_ID/auth-callback.html
   ```

   **注册后URLs（After Sign Up URLs）：**
   ```
   chrome-extension://YOUR_EXTENSION_ID/auth-callback.html
   ```

   请将`YOUR_EXTENSION_ID`替换为您的实际扩展ID。

4. 转到**CORS & Origins**部分：
   - 确保允许跨域请求
   - 添加扩展的origin到允许列表

## 3. 确保manifest.json配置正确

确认manifest.json有以下配置：

```json
"permissions": ["storage", "identity", "tabs"],
"host_permissions": [
  "https://*.accounts.dev/",
  "https://api.clerk.dev/"
],
"web_accessible_resources": [{
  "resources": [
    "auth-callback.html"
  ],
  "matches": ["<all_urls>"]
}],
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://*.accounts.dev https://api.clerk.dev"
}
```

## 4. 测试认证流程

1. 重新加载扩展以应用所有更改
2. 打开扩展弹出窗口并点击"登录"按钮
3. 应该会重定向到Clerk认证页面
4. 登录后，应该直接重定向回扩展的auth-callback.html页面
5. 检查控制台日志，查找潜在错误

## 5. 故障排除

如果登录后没有重定向到扩展页面：

1. **检查Clerk设置**
   - 确认所有重定向URL格式正确
   - 确保使用了正确的扩展ID
   - 在Clerk Dashboard中查看登录请求日志

2. **检查控制台错误**
   - 在打开auth-callback.html页面的标签中检查控制台错误
   - 注意任何与CORS或CSP相关的错误

3. **验证扩展设置**
   - 确保auth-callback.html在web_accessible_resources中列出
   - 检查权限设置是否正确

4. **手动测试重定向**
   - 尝试直接访问`chrome-extension://YOUR_EXTENSION_ID/auth-callback.html`
   - 确认页面可以正常加载

5. **清除缓存和Cookie**
   - 清除浏览器缓存和与Clerk相关的Cookie
   - 重新测试登录流程

## 6. 高级配置

对于更高级的Clerk设置和功能，请参考[Clerk Documentation](https://clerk.com/docs)。

## 调试工具

在auth-callback.html页面加载后，您可以：
1. 点击"显示/隐藏详情"查看详细的调试信息
2. 检查URL参数以确保token正确传递
3. 使用"下载日志"按钮保存调试信息供进一步分析