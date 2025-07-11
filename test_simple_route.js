// Teste para verificar se a rota simples funciona
const https = require('https');

const options = {
  hostname: '5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev',
  port: 443,
  path: '/perfil/confirmar-alteracao-simples',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': 0
  }
};

console.log('🧪 Testando rota simples /perfil/confirmar-alteracao-simples...');

const req = https.request(options, (res) => {
  console.log('📊 Status Code:', res.statusCode);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('📄 Response:', body);
    if (res.statusCode === 200) {
      console.log('✅ Rota simples funcionando!');
    } else {
      console.log('❌ Rota simples também não funciona');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro na requisição:', e.message);
});

req.end();