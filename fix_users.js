const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

try {
  console.log('=== ATIVANDO TODOS OS USUÁRIOS ===');
  
  // Atualizar status de todos os usuários para ativo
  const updateResult = db.prepare('UPDATE usuarios SET ativo = ? WHERE 1=1').run('true');
  console.log(`Usuários atualizados: ${updateResult.changes}`);
  
  // Verificar os usuários principais
  console.log('\n=== VERIFICANDO USUÁRIOS PRINCIPAIS ===');
  const mainUsers = [
    'admin@cmbm.com.br',
    'editor@cmbm.com.br', 
    'aluno@cmbm.com.br',
    'ti@cmbm.com.br'
  ];
  
  mainUsers.forEach(email => {
    const user = db.prepare('SELECT email, nome, tipo, ativo FROM usuarios WHERE email = ?').get(email);
    if (user) {
      console.log(`✓ ${user.email} - ${user.nome} (${user.tipo}) - Ativo: ${user.ativo}`);
    } else {
      console.log(`✗ ${email} - Usuário não encontrado`);
    }
  });
  
  console.log('\n=== TODOS OS USUÁRIOS FORAM ATIVADOS ===');
  
} catch (error) {
  console.error('Erro ao ativar usuários:', error);
}

db.close();