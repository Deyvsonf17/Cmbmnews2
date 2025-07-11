// Teste para rota /perfil/confirmar-alteracao
const https = require('https');
const querystring = require('querystring');

const BASE_URL = 'https://5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev';

// Dados para teste
const postData = querystring.stringify({
  codigo: 'TEST1'
});

const options = {
  hostname: '5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev',
  port: 443,
  path: '/perfil/confirmar-alteracao',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testando rota /perfil/confirmar-alteracao...');

const req = https.request(options, (res) => {
  console.log('📊 Status Code:', res.statusCode);
  console.log('📋 Headers:', res.headers);

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response body length:', body.length);
    if (res.statusCode === 404) {
      console.log('❌ Erro 404: Rota não encontrada');
    } else if (res.statusCode === 302) {
      console.log('✅ Redirecionamento encontrado');
    } else {
      console.log('📄 Status:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro na requisição:', e.message);
});

req.write(postData);
req.end();