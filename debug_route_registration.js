const express = require('express');
const app = express();

console.log('🔍 Simulando registro de rotas de perfil...');

// Testar registro de rotas
app.post('/perfil/confirmar-alteracao-simples', (req, res) => {
  console.log('Rota simples registrada');
  res.json({ success: true });
});

app.post('/perfil/confirmar-alteracao', (req, res) => {
  console.log('Rota confirmar alteração registrada');
  res.json({ success: true });
});

// Verificar se as rotas foram registradas
console.log('\n📊 Verificando rotas registradas:');
if (app._router && app._router.stack) {
  app._router.stack.forEach((layer, index) => {
    if (layer.route) {
      console.log(`${index}: ${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
    }
  });
} else {
  console.log('❌ Nenhuma rota encontrada');
}

// Iniciar servidor de teste
const port = 3001;
app.listen(port, () => {
  console.log(`\n✅ Servidor de teste rodando na porta ${port}`);
});