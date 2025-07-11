// Teste para verificar se as rotas estão sendo registradas
const https = require('https');
const querystring = require('querystring');

const BASE_URL = 'https://5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev';

// Testar rota de teste
const testData = querystring.stringify({
  codigo: 'TEST1'
});

const testOptions = {
  hostname: '5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev',
  port: 443,
  path: '/perfil/confirmar-alteracao-teste',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🧪 Testando rota de teste /perfil/confirmar-alteracao-teste...');

const testReq = https.request(testOptions, (res) => {
  console.log('📊 Status Code (teste):', res.statusCode);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response (teste):', body);
  });
});

testReq.on('error', (e) => {
  console.error('❌ Erro na requisição de teste:', e.message);
});

testReq.write(testData);
testReq.end();