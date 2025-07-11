const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

try {
  console.log('=== USUÁRIOS CADASTRADOS ===');
  const users = db.prepare('SELECT email, nome, tipo, ativo, senha_hash FROM usuarios').all();
  
  users.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`Nome: ${user.nome}`);
    console.log(`Tipo: ${user.tipo}`);
    console.log(`Ativo: ${user.ativo} (tipo: ${typeof user.ativo})`);
    console.log(`Hash: ${user.senha_hash ? 'Configurado' : 'Não configurado'}`);
    console.log('---');
  });
  
  console.log(`Total de usuários: ${users.length}`);
  
} catch (error) {
  console.error('Erro ao consultar usuários:', error);
}

db.close();