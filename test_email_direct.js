require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailDirect() {
  console.log('🔍 TESTE DIRETO DE EMAIL PARA deyvsonf016@gmail.com');
  console.log('================================================');

  // Verificar variáveis de ambiente
  console.log('\n📋 VERIFICANDO CONFIGURAÇÃO:');
  console.log('SMTP_USER:', process.env.SMTP_USER ? '✅ Configurado' : '❌ Não configurado');
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✅ Configurado' : '❌ Não configurado');
  console.log('URL_ACESSO:', process.env.URL_ACESSO);

  const destinatario = 'deyvsonf016@gmail.com';
  console.log('\n📧 DESTINATÁRIO:', destinatario);

  // Configurar transporter Elastic Email
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
    // Teste 1: Verificar conexão
    console.log('\n🔌 TESTE 1: Verificando conexão com Elastic Email...');
    await transporter.verify();
    console.log('✅ Conexão estabelecida com sucesso!');

    // Teste 2: Enviar email simples
    console.log('\n📧 TESTE 2: Enviando email de teste...');
    const mailOptions = {
      from: `"CMBM NEWS Test" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject: '🧪 Teste Direto - CMBM NEWS (Elastic Email)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
          <div style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 28px;">🧪 TESTE ELASTIC EMAIL</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">CMBM NEWS - Sistema de Email</p>
          </div>

          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #001f3f; margin-bottom: 20px;">✅ Email Funcionando!</h2>
            <p><strong>🕐 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            <p><strong>📧 Destinatário:</strong> ${destinatario}</p>
            <p><strong>🏥 Servidor SMTP:</strong> smtp.elasticemail.com:2525</p>
            <p><strong>👤 Usuário SMTP:</strong> ${process.env.SMTP_USER}</p>
            <p><strong>🌐 URL Base:</strong> ${process.env.URL_ACESSO}</p>

            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin: 0 0 10px 0;">🎉 Sucesso!</h3>
              <p style="margin: 0; color: #155724;">Se você recebeu este email, a configuração do Elastic Email está funcionando perfeitamente!</p>
            </div>

            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin: 0 0 10px 0;">⚙️ Detalhes Técnicos:</h4>
              <ul style="margin: 0; color: #856404; padding-left: 20px;">
                <li>Protocolo: SMTP</li>
                <li>Porta: 2525</li>
                <li>Provedor: Elastic Email</li>
                <li>Codificação: UTF-8</li>
              </ul>
            </div>
          </div>
        </div>
      `,
      text: `
TESTE ELASTIC EMAIL - CMBM NEWS
===============================

Email funcionando!
Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Destinatário: ${destinatario}
Servidor: smtp.elasticemail.com:2525
Usuário SMTP: ${process.env.SMTP_USER}

Se você recebeu este email, a configuração do Elastic Email está funcionando!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ EMAIL ENVIADO COM SUCESSO!');
    console.log('📨 Message ID:', info.messageId);
    console.log('📬 Response:', info.response);
    console.log('📧 Para:', destinatario);
    console.log('📨 Envelope:', JSON.stringify(info.envelope, null, 2));

  } catch (error) {
    console.error('❌ ERRO DETALHADO:');
    console.error('   Nome:', error.name);
    console.error('   Mensagem:', error.message);
    console.error('   Código:', error.code);
    console.error('   Comando:', error.command);
    console.error('   Resposta:', error.response);
    console.error('   Stack:', error.stack);
  }

  console.log('\n🏁 TESTE CONCLUÍDO');
  console.log('==================');
  console.log('✅ Verifique sua caixa de email (incluindo spam)');
  console.log('📧 Destinatário testado:', destinatario);
  console.log('⏰ Aguarde alguns minutos para o recebimento');
}

testEmailDirect().then(() => {
  console.log('\n✅ Script finalizado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});