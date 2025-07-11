// Debug para verificar se as rotas estão sendo registradas no Express
const { getDatabase } = require('./database');

console.log('🔍 Verificando rotas registradas no Express...');

// Simular carregamento do servidor
const express = require('express');
const app = express();

// Configurar middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Adicionar uma rota de teste simples
app.post('/test-route', (req, res) => {
  console.log('✅ Rota de teste funcionando!');
  res.json({ success: true });
});

// Verificar se a rota foi registrada
console.log('📊 Verificando rotas registradas:');
if (app._router && app._router.stack) {
  app._router.stack.forEach((layer, index) => {
    if (layer.route) {
      console.log(`${index}: ${Object.keys(layer.route.methods)} ${layer.route.path}`);
    } else if (layer.name) {
      console.log(`${index}: Middleware - ${layer.name}`);
    }
  });
} else {
  console.log('❌ Nenhuma rota encontrada no stack do Express');
}

// Testar a rota localmente
const http = require('http');
const server = http.createServer(app);

server.listen(3002, () => {
  console.log('🧪 Servidor de debug rodando na porta 3002');
  
  // Testar a rota
  setTimeout(() => {
    const postData = JSON.stringify({ test: 'data' });
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/test-route',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`📊 Status: ${res.statusCode}`);
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('📄 Response:', body);
        server.close();
      });
    });
    
    req.on('error', (e) => {
      console.error('❌ Erro:', e.message);
      server.close();
    });
    
    req.write(postData);
    req.end();
  }, 100);
});