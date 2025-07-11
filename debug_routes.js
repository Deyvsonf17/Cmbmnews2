// Debug para verificar rotas registradas
const express = require('express');
const app = express();

// Simular a mesma estrutura do servidor
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware de debug
app.use((req, res, next) => {
  console.log('📋 Rota acessada:', req.method, req.path);
  next();
});

// Registrar rota de teste
app.post('/perfil/confirmar-alteracao', (req, res) => {
  console.log('✅ Rota /perfil/confirmar-alteracao encontrada!');
  res.json({ success: true, message: 'Rota funcionando' });
});

// Middleware 404
app.use((req, res) => {
  console.log('❌ Rota não encontrada:', req.method, req.path);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Verificar se a rota está registrada
console.log('📊 Rotas registradas:');
app._router.stack.forEach((layer, index) => {
  if (layer.route) {
    console.log(`${index}: ${Object.keys(layer.route.methods)} ${layer.route.path}`);
  }
});

// Iniciar servidor de teste
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🧪 Servidor de teste rodando na porta ${PORT}`);
});