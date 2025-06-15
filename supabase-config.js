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

// 确保在其他脚本中可以访问配置
export default SUPABASE_CONFIG;