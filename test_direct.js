const { initializeDatabase, getDatabase } = require('./database');

async function testDirectUpdate() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    // Testar update direto
    console.log('=== TESTE DIRETO DE UPDATE ===');
    
    // Buscar um usuário
    const usuario = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM usuarios WHERE id = ?", [6], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('Usuário antes:', usuario);
    
    // Alternar status
    const novoStatus = usuario.ativo === 'true' ? 'false' : 'true';
    console.log('Novo status:', novoStatus);
    
    // Fazer update
    const result = await new Promise((resolve, reject) => {
      db.run("UPDATE usuarios SET ativo = ? WHERE id = ?", [novoStatus, 6], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
    
    console.log('Update result:', result);
    
    // Verificar se funcionou
    const usuarioDepois = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM usuarios WHERE id = ?", [6], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    console.log('Usuário depois:', usuarioDepois);
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

testDirectUpdate();