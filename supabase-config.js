/**
 * Supabase配置文件
 * 包含Supabase项目URL和匿名密钥
 */

// 默认值为空，需要在部署时替换为实际值
const SUPABASE_CONFIG = {
  // Supabase项目URL
  SUPABASE_URL: 'https://cwqpnokkoemeupybhatu.supabase.co',

  // Supabase匿名公共密钥（安全在客户端使用）
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cXBub2trb2VtZXVweWJoYXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5ODM5NzQsImV4cCI6MjA2NTU1OTk3NH0.sZdUtCUypocb0ysdvuM62EQHtxLZ21xbttu_UcZYyEM',

  // 是否启用Supabase（默认启用）
  SUPABASE_ENABLED: true
};

// 设置为全局变量以便其他脚本访问
self.SUPABASE_CONFIG = SUPABASE_CONFIG;

// 保存到chrome.storage以便在不同上下文中访问
try {
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      'supabaseUrl': SUPABASE_CONFIG.SUPABASE_URL,
      'supabaseAnonKey': SUPABASE_CONFIG.SUPABASE_ANON_KEY,
      'supabaseEnabled': SUPABASE_CONFIG.SUPABASE_ENABLED
    });
    console.log('Supabase配置已保存到chrome.storage');
  }
} catch (err) {
  console.warn('无法保存Supabase配置到chrome.storage:', err);
}