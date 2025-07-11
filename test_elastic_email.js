
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testElasticEmail() {
  console.log('🧪 TESTE EXCLUSIVO - ELASTIC EMAIL');
  console.log('===================================');
  
  console.log('📋 Configuração:');
  console.log('Host: smtp.elasticemail.com');
  console.log('Porta: 2525');
  console.log('User:', process.env.SMTP_USER);
  console.log('Pass:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NÃO CONFIGURADA');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.elasticemail.com',
    port: 2525,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    debug: true,
    logger: true
  });

  try {
    console.log('\n🔌 Testando conexão...');
    await transporter.verify();
    console.log('✅ Conexão com Elastic Email estabelecida!');

    console.log('\n📧 Enviando email de teste...');
    const info = await transporter.sendMail({
      from: `"CMBM NEWS" <${process.env.SMTP_USER}>`,
      to: 'deyvsonf16@gmail.com',
      subject: '🧪 Teste Elastic Email - CMBM NEWS',
      html: `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 10px;">
          <h2 style="color: #001f3f;">✅ Elastic Email Funcionando!</h2>
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Servidor:</strong> smtp.elasticemail.com:2525</p>
          <p><strong>Status:</strong> Email enviado com sucesso!</p>
          <p><strong>Credenciais:</strong> ${process.env.SMTP_USER}</p>
        </div>
      `
    });

    console.log('✅ Email enviado!');
    console.log('📨 Message ID:', info.messageId);
    console.log('📬 Response:', info.response);
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('❌ Código:', error.code);
    
    if (error.code === 'EAUTH') {
      console.error('\n🚨 ERRO DE AUTENTICAÇÃO:');
      console.error('   - Verifique se o email está correto');
      console.error('   - Verifique se a API Key está correta');
      console.error('   - Confirme se a conta Elastic Email está ativa');
    }
  }
}

testElasticEmail().then(() => {
  console.log('\n🏁 Teste concluído');
  process.exit(0);
});
