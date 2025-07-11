const { initializeDatabase, getDatabase } = require('./database');

async function debugDatabase() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    // Verificar estrutura da tabela
    console.log('=== Estrutura da tabela usuarios ===');
    const schema = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(usuarios)", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(schema);
    
    // Verificar dados dos usuários
    console.log('\n=== Dados dos usuários ===');
    const usuarios = await new Promise((resolve, reject) => {
      db.all("SELECT id, nome, email, ativo FROM usuarios", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(usuarios);
    
    // Verificar especificamente o campo ativo
    console.log('\n=== Análise do campo ativo ===');
    usuarios.forEach(usuario => {
      console.log(`ID: ${usuario.id}, Nome: ${usuario.nome}, Ativo: "${usuario.ativo}" (tipo: ${typeof usuario.ativo})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

debugDatabase();