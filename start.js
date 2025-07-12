
#!/usr/bin/env node

// Script de inicialização otimizado para Koyeb
require('dotenv').config();

// Detectar ambiente Koyeb
if (process.env.KOYEB_PUBLIC_DOMAIN) {
  console.log('🚀 Detectado ambiente Koyeb');
  console.log(`📡 Domínio público: ${process.env.KOYEB_PUBLIC_DOMAIN}`);
  
  // Configurar variáveis específicas do Koyeb apenas se BASE_URL não estiver definida
  if (!process.env.BASE_URL) {
    process.env.BASE_URL = `https://${process.env.KOYEB_PUBLIC_DOMAIN}`;
  }
  process.env.NODE_ENV = 'production';
}

// Configurações para Koyeb
process.env.HOST = '0.0.0.0';
process.env.PORT = process.env.PORT || 8000;

console.log(`🔧 Configurações do servidor:`);
console.log(`   HOST: ${process.env.HOST}`);
console.log(`   PORT: ${process.env.PORT}`);
console.log(`   BASE_URL: ${process.env.BASE_URL}`);
console.log(`   URL_ACESSO: ${process.env.URL_ACESSO}`);

// Iniciar servidor principal
require('./server.js');
