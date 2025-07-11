
const { initializeDatabase, getDatabase } = require('./database');

async function activateTIUser() {
  try {
    console.log('🔧 Iniciando ativação do usuário TI...');
    
    await initializeDatabase();
    const db = getDatabase();
    
    // Verificar usuários inativos
    console.log('\n📋 Verificando usuários inativos:');
    const inactiveUsers = await new Promise((resolve, reject) => {
      db.all("SELECT id, nome, email, tipo, ativo FROM usuarios WHERE ativo = 'false' OR ativo IS NULL", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('Usuários inativos encontrados:', inactiveUsers.length);
    inactiveUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Nome: ${user.nome}, Email: ${user.email}, Tipo: ${user.tipo}, Ativo: ${user.ativo}`);
    });
    
    // Encontrar e ativar usuário TI
    const tiUser = inactiveUsers.find(user => user.tipo === 'ti');
    
    if (!tiUser) {
      console.log('❌ Usuário TI não encontrado ou já está ativo');
      
      // Verificar se existe usuário TI ativo
      const activeTI = await new Promise((resolve, reject) => {
        db.all("SELECT id, nome, email, tipo, ativo FROM usuarios WHERE tipo = 'ti'", [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      if (activeTI.length > 0) {
        console.log('✅ Usuário(s) TI encontrado(s):');
        activeTI.forEach(user => {
          console.log(`- ID: ${user.id}, Nome: ${user.nome}, Email: ${user.email}, Ativo: ${user.ativo}`);
        });
      } else {
        console.log('❌ Nenhum usuário TI encontrado no sistema');
      }
      
      process.exit(0);
    }
    
    console.log(`\n🔑 Ativando usuário TI: ${tiUser.nome} (${tiUser.email})`);
    
    // Ativar usuário TI
    await new Promise((resolve, reject) => {
      db.run("UPDATE usuarios SET ativo = 'true' WHERE id = ?", [tiUser.id], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Verificar se foi ativado
    const verificacao = await new Promise((resolve, reject) => {
      db.get("SELECT id, nome, email, ativo FROM usuarios WHERE id = ?", [tiUser.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (verificacao.ativo === 'true') {
      console.log('✅ Usuário TI ativado com sucesso!');
      console.log(`✅ ${verificacao.nome} (${verificacao.email}) agora está ATIVO`);
    } else {
      console.log('❌ Falha ao ativar usuário TI');
    }
    
    // Mostrar todos os usuários TI ativos
    console.log('\n📊 Status final dos usuários TI:');
    const allTI = await new Promise((resolve, reject) => {
      db.all("SELECT id, nome, email, ativo FROM usuarios WHERE tipo = 'ti'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    allTI.forEach(user => {
      const status = user.ativo === 'true' ? '✅ ATIVO' : '❌ INATIVO';
      console.log(`- ${user.nome} (${user.email}): ${status}`);
    });
    
    console.log('\n🎉 Operação concluída!');
    console.log('💡 Agora você pode fazer login com a conta TI ativa.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao ativar usuário TI:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  activateTIUser();
}

module.exports = { activateTIUser };
