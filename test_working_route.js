// Teste para verificar se alguma rota POST está funcionando
const https = require('https');

const BASE_URL = 'https://5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev';

// Testar uma rota POST que sabemos que existe
const options = {
  hostname: '5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev',
  port: 443,
  path: '/logout',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': 0
  }
};

console.log('🧪 Testando rota POST /logout...');

const req = https.request(options, (res) => {
  console.log('📊 Status Code:', res.statusCode);
  console.log('📋 Headers:', res.headers);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response length:', body.length);
    if (res.statusCode === 404) {
      console.log('❌ Rota POST /logout também retorna 404');
    } else {
      console.log('✅ Rota POST /logout funciona! Status:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro na requisição:', e.message);
});

req.end();