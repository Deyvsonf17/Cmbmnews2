
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: false,
  logger: false,
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
});

// Função para testar a conexão
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Erro na configuração do Gmail SMTP:', error);
    console.log('❌ Verifique suas credenciais:');
    console.log('   - GMAIL_USER:', process.env.GMAIL_USER);
    console.log('   - GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '***configurada***' : 'NÃO CONFIGURADA');
  } else {
    console.log('✅ Servidor Gmail SMTP configurado com sucesso');
    console.log('📧 Pronto para enviar emails via smtp.gmail.com:587');
  }
});

module.exports = transporter;
