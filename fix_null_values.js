const { initializeDatabase, getDatabase } = require('./database');

async function fixNullValues() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    // Atualizar todos os valores null para 'false'
    console.log('🔧 Corrigindo valores null no campo ativo...');
    
    const result = await new Promise((resolve, reject) => {
      db.run("UPDATE usuarios SET ativo = 'false' WHERE ativo IS NULL", [], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
    
    console.log('✅ Valores null corrigidos:', result.changes, 'registros atualizados');
    
    // Verificar se ficou tudo correto
    const usuarios = await new Promise((resolve, reject) => {
      db.all("SELECT id, nome, email, ativo FROM usuarios", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n=== Usuários após correção ===');
    usuarios.forEach(usuario => {
      console.log(`ID: ${usuario.id}, Nome: ${usuario.nome}, Ativo: "${usuario.ativo}" (tipo: ${typeof usuario.ativo})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

fixNullValues();