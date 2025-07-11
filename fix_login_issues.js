
const { initializeDatabase, getDatabase } = require('./database');
const bcrypt = require('bcrypt');

async function fixLoginIssues() {
  try {
    await initializeDatabase();
    const db = getDatabase();
    
    console.log('🔧 Verificando e corrigindo problemas de login...');
    
    // Verificar usuários principais
    const mainUsers = [
      { email: 'admin@cmbm.com.br', senha: 'admin123', nome: 'Administrador', tipo: 'diretor' },
      { email: 'editor@cmbm.com.br', senha: 'editor123', nome: 'Editor CMBM', tipo: 'editor' },
      { email: 'aluno@cmbm.com.br', senha: 'aluno123', nome: 'Maria Silva', tipo: 'aluno' },
      { email: 'ti@cmbm.com.br', senha: 'ti123', nome: 'TI CMBM', tipo: 'ti' }
    ];

    for (const userData of mainUsers) {
      console.log(`\n🔍 Verificando usuário: ${userData.email}`);
      
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM usuarios WHERE email = ?', [userData.email], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (user) {
        console.log(`✅ Usuário encontrado: ${user.nome}`);
        console.log(`📊 Status atual: ativo=${user.ativo}, tipo=${user.tipo}`);
        
        // Garantir que está ativo
        if (user.ativo !== 'true') {
          await new Promise((resolve, reject) => {
            db.run('UPDATE usuarios SET ativo = ? WHERE id = ?', ['true', user.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          console.log(`🔧 Status ativado para: ${userData.email}`);
        }

        // Verificar/resetar senha
        const senhaHash = await bcrypt.hash(userData.senha, 10);
        await new Promise((resolve, reject) => {
          db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, user.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log(`🔐 Senha resetada para: ${userData.email}`);
        
      } else {
        console.log(`❌ Usuário não encontrado, criando: ${userData.email}`);
        
        const senhaHash = await bcrypt.hash(userData.senha, 10);
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo) VALUES (?, ?, ?, ?, ?)',
            [userData.nome, userData.email, senhaHash, userData.tipo, 'true'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        console.log(`✅ Usuário criado: ${userData.email}`);
      }
    }

    // Limpar sessões inválidas
    console.log('\n🧹 Limpando tokens expirados...');
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM reset_codes WHERE datetime(expires_at) < datetime("now")', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('\n🎉 Correção concluída!');
    console.log('\n=== CREDENCIAIS DE ACESSO ===');
    console.log('Admin: admin@cmbm.com.br / admin123');
    console.log('Editor: editor@cmbm.com.br / editor123');
    console.log('Aluno: aluno@cmbm.com.br / aluno123');
    console.log('TI: ti@cmbm.com.br / ti123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao corrigir problemas:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixLoginIssues();
}

module.exports = { fixLoginIssues };
