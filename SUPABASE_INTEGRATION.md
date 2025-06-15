# Day Progress Bar扩展 - Supabase集成指南

本文档详细介绍了如何在Chrome扩展中集成Supabase作为数据存储和API服务。

## 完成的集成工作

1. **添加Supabase API支持**:
   - 在`api.js`中添加了Supabase客户端初始化和操作函数
   - 创建了用于用户管理和许可证验证的Supabase函数

2. **添加Supabase客户端库**:
   - 在主要HTML文件中引入Supabase客户端库
   - 使用CDN方式引入最新版本的Supabase JS客户端

3. **创建配置系统**:
   - 添加`supabase-config.js`用于存储Supabase URL和密钥
   - 实现了在扩展中可配置的Supabase设置

4. **修改JS文件，增加Supabase支持**:
   - 更新`popup.js`以支持从Supabase获取用户数据
   - 更新`payment.js`以在支付流程中同步用户数据到Supabase

5. **添加Webhook支持**:
   - 创建了webhook处理程序接收Supabase数据变更通知
   - 添加了相关权限以支持webhook功能

## 部署和配置说明

### 1. 更新Supabase配置

修改`supabase-config.js`文件中的配置:

```js
const SUPABASE_CONFIG = {
  // 替换为你的Supabase项目URL
  SUPABASE_URL: 'https://your-project-id.supabase.co',

  // 替换为你的Supabase匿名密钥
  SUPABASE_ANON_KEY: 'your-anon-key',

  // 设置为true启用Supabase功能
  SUPABASE_ENABLED: true
};
```

### 2. 在Supabase中创建数据库表

执行以下SQL脚本创建必要的数据表:

```sql
-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Licenses table
CREATE TABLE public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    license_key TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### 3. 配置行级安全策略(RLS)

为表设置适当的安全策略:

```sql
-- 启用RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Users can read their own data" ON public.users
  FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can read their own licenses" ON public.licenses
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT clerk_id FROM public.users WHERE id = user_id
    )
  );
```

### 4. 配置Supabase Webhook

为了实现实时数据同步，需要设置Supabase数据库触发器和webhook：

1. **创建数据库函数**:

```sql
-- 创建webhook触发函数
CREATE OR REPLACE FUNCTION public.handle_db_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- 构建要发送的数据
  DECLARE
    payload JSONB;
  BEGIN
    payload := jsonb_build_object(
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'type', TG_OP,
      'record', row_to_json(NEW)
    );

    -- 对于DELETE操作，NEW为null，使用OLD
    IF TG_OP = 'DELETE' THEN
      payload := jsonb_set(payload, '{record}', 'null');
      payload := jsonb_set(payload, '{old_record}', row_to_json(OLD));
    ELSIF TG_OP = 'UPDATE' THEN
      -- 对于UPDATE，同时包含旧值和新值
      payload := jsonb_set(payload, '{old_record}', row_to_json(OLD));
    END IF;

    -- 使用Supabase的http扩展发送webhook
    PERFORM
      net.http_post(
        url := 'https://your-webhook-endpoint/api/webhooks',
        body := payload,
        headers := '{"Content-Type": "application/json"}'
      );

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **创建表触发器**:

```sql
-- 用户表触发器
CREATE TRIGGER users_changes
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_db_changes();

-- 许可证表触发器
CREATE TRIGGER licenses_changes
AFTER INSERT OR UPDATE OR DELETE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.handle_db_changes();
```

3. **配置中间服务器**:

由于Chrome扩展无法直接接收外部HTTP请求，需要一个中间服务器来接收webhook并将数据转发给扩展。详细配置请参考 `SUPABASE_WEBHOOK_SETUP.md` 文件。

## 使用示例

### 初始化Supabase客户端

```js
import { initSupabase } from './api.js';
import SUPABASE_CONFIG from './supabase-config.js';

// 初始化Supabase客户端
const supabaseClient = initSupabase(
  SUPABASE_CONFIG.SUPABASE_URL,
  SUPABASE_CONFIG.SUPABASE_ANON_KEY
);
```

### 获取用户数据

```js
import { getUserFromSupabase } from './api.js';

// 获取用户数据
async function loadUserData(clerkId) {
  const userData = await getUserFromSupabase(clerkId);
  if (userData) {
    console.log('用户数据:', userData);
    // 处理用户数据...
  }
}
```

### 验证许可证

```js
import { verifyLicenseWithSupabase } from './api.js';

// 验证许可证密钥
async function checkLicense(licenseKey) {
  const result = await verifyLicenseWithSupabase(licenseKey);
  if (result.valid) {
    console.log('许可证有效，到期日期:', result.expiresAt);
    // 启用高级功能...
  } else {
    console.log('许可证无效或已过期:', result.message);
    // 显示购买界面...
  }
}
```

### 处理Webhook事件

```js
// 在background.js中
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSubscription') {
    const { clerkId, subscription } = message.data;

    // 更新本地存储中的订阅状态
    chrome.storage.sync.set({ subscription }, () => {
      console.log('已更新订阅状态:', subscription);
      sendResponse({ success: true });
    });

    return true; // 异步响应
  }
});
```

## 故障排除

### Supabase库加载问题

如果遇到`supabase is not defined`错误，确保在HTML中正确加载了Supabase脚本:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 连接错误

如果连接到Supabase失败，检查:

1. `supabase-config.js`中的URL和密钥是否正确
2. 浏览器控制台是否有CORS错误
3. Supabase项目是否在线且配置正确

### Webhook错误

如果遇到webhook相关的错误:

1. 检查manifest.json中是否添加了必要的权限
2. 确认Supabase中的webhook触发器配置正确
3. 查看浏览器控制台中是否有webhook请求被拦截的日志

## 后续改进建议

1. **实现离线支持**:
   - 添加本地缓存机制以支持离线操作
   - 重新连接时同步离线更改

2. **更强的认证集成**:
   - 结合Clerk和Supabase Auth进行更无缝的身份验证
   - 实现JWT令牌交换机制

3. **数据同步优化**:
   - 实现增量同步而非全量同步
   - 添加冲突解决机制

4. **改进Webhook处理**:
   - 添加重试机制和错误处理
   - 实现更安全的webhook验证