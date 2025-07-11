const express = require('express');
const { initializeDatabase, getDatabase } = require('./database');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware para debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Rota de teste
app.post('/test-toggle/:id', async (req, res) => {
  console.log('=== TESTE TOGGLE ===');
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  console.log('Body keys:', Object.keys(req.body));
  
  const { ativo } = req.body;
  console.log('Valor ativo:', ativo);
  console.log('Tipo:', typeof ativo);
  console.log('JSON:', JSON.stringify(ativo));
  
  if (ativo !== 'true' && ativo !== 'false') {
    console.log('❌ Valor inválido!');
    return res.json({ error: 'Valor inválido', received: ativo });
  }
  
  console.log('✅ Valor válido!');
  res.json({ success: true, received: ativo });
});

async function startTest() {
  await initializeDatabase();
  app.listen(3001, () => {
    console.log('Servidor de teste rodando na porta 3001');
  });
}

startTest();