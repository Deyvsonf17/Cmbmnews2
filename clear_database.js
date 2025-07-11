
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

try {
  console.log('🗑️  INICIANDO LIMPEZA DO BANCO DE DADOS...');
  
  // Definir usuários que devem ser mantidos
  const usuariosParaManter = [
    'deyvsonf016@gmail.com',
    'admin@cmbm.com.br'
  ];
  
  console.log('\n📋 Usuários que serão mantidos:', usuariosParaManter);
  
  // Verificar se os usuários existem
  console.log('\n🔍 Verificando usuários existentes...');
  usuariosParaManter.forEach(email => {
    const user = db.prepare('SELECT email, nome, tipo FROM usuarios WHERE email = ?').get(email);
    if (user) {
      console.log(`✅ ${user.email} - ${user.nome} (${user.tipo})`);
    } else {
      console.log(`⚠️  ${email} - Usuário não encontrado`);
    }
  });
  
  // Obter IDs dos usuários para manter
  const idsParaManter = db.prepare(`
    SELECT id FROM usuarios 
    WHERE email IN (${usuariosParaManter.map(() => '?').join(',')})
  `).all(...usuariosParaManter).map(u => u.id);
  
  console.log('\n🔢 IDs dos usuários para manter:', idsParaManter);
  
  // 1. LIMPAR DADOS DAS TABELAS (ordem importante por causa das foreign keys)
  console.log('\n🧹 Removendo dados das tabelas...');
  
  // Limpar fotos das homenagens
  const fotosHomenagensDeletadas = db.prepare('DELETE FROM fotos_homenagens').run();
  console.log(`📸 Fotos de homenagens removidas: ${fotosHomenagensDeletadas.changes}`);
  
  // Limpar homenagens
  const homenagensDeletadas = db.prepare('DELETE FROM homenagens').run();
  console.log(`🏆 Homenagens removidas: ${homenagensDeletadas.changes}`);
  
  // Limpar fotos dos álbuns
  const fotosDeletadas = db.prepare('DELETE FROM fotos').run();
  console.log(`📷 Fotos removidas: ${fotosDeletadas.changes}`);
  
  // Limpar álbuns
  const albunsDeletados = db.prepare('DELETE FROM albums').run();
  console.log(`📁 Álbuns removidos: ${albunsDeletados.changes}`);
  
  // Limpar notícias
  const noticiasDeletadas = db.prepare('DELETE FROM noticias').run();
  console.log(`📰 Notícias removidas: ${noticiasDeletadas.changes}`);
  
  // Limpar códigos de redefinição
  const codigosDeletados = db.prepare('DELETE FROM reset_codes').run();
  console.log(`🔑 Códigos de redefinição removidos: ${codigosDeletados.changes}`);
  
  // 2. REMOVER USUÁRIOS (exceto os administrativos)
  console.log('\n👥 Removendo usuários...');
  
  const usuariosDeletados = db.prepare(`
    DELETE FROM usuarios 
    WHERE email NOT IN (${usuariosParaManter.map(() => '?').join(',')})
  `).run(...usuariosParaManter);
  
  console.log(`👤 Usuários removidos: ${usuariosDeletados.changes}`);
  
  // 3. RESETAR AUTO INCREMENT DAS TABELAS
  console.log('\n🔄 Resetando contadores auto increment...');
  
  const tabelas = ['usuarios', 'noticias', 'albums', 'fotos', 'homenagens', 'fotos_homenagens', 'reset_codes'];
  
  tabelas.forEach(tabela => {
    try {
      db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(tabela);
      console.log(`🔢 Contador resetado para: ${tabela}`);
    } catch (error) {
      console.log(`⚠️  Não foi possível resetar contador para: ${tabela}`);
    }
  });
  
  // 4. VERIFICAR RESULTADO FINAL
  console.log('\n📊 RESULTADO FINAL:');
  
  // Verificar usuários restantes
  const usuariosRestantes = db.prepare('SELECT email, nome, tipo FROM usuarios ORDER BY email').all();
  console.log('\n👥 Usuários restantes:');
  usuariosRestantes.forEach(user => {
    console.log(`   ${user.email} - ${user.nome} (${user.tipo})`);
  });
  
  // Verificar contagem de dados
  const estatisticas = {
    usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count,
    noticias: db.prepare('SELECT COUNT(*) as count FROM noticias').get().count,
    albums: db.prepare('SELECT COUNT(*) as count FROM albums').get().count,
    fotos: db.prepare('SELECT COUNT(*) as count FROM fotos').get().count,
    homenagens: db.prepare('SELECT COUNT(*) as count FROM homenagens').get().count,
    fotos_homenagens: db.prepare('SELECT COUNT(*) as count FROM fotos_homenagens').get().count,
    reset_codes: db.prepare('SELECT COUNT(*) as count FROM reset_codes').get().count
  };
  
  console.log('\n📈 Estatísticas finais:');
  Object.entries(estatisticas).forEach(([tabela, count]) => {
    console.log(`   ${tabela}: ${count} registros`);
  });
  
  // 5. VACUUM PARA OTIMIZAR O BANCO
  console.log('\n🗜️  Otimizando banco de dados...');
  db.prepare('VACUUM').run();
  console.log('✅ Banco otimizado');
  
  console.log('\n🎉 LIMPEZA CONCLUÍDA COM SUCESSO!');
  console.log('\n📋 Resumo:');
  console.log(`   • ${usuariosDeletados.changes} usuários removidos`);
  console.log(`   • ${noticiasDeletadas.changes} notícias removidas`);
  console.log(`   • ${albunsDeletados.changes} álbuns removidos`);
  console.log(`   • ${fotosDeletadas.changes} fotos removidas`);
  console.log(`   • ${homenagensDeletadas.changes} homenagens removidas`);
  console.log(`   • ${fotosHomenagensDeletadas.changes} fotos de homenagens removidas`);
  console.log(`   • ${codigosDeletados.changes} códigos de redefinição removidos`);
  console.log(`   • ${usuariosRestantes.length} usuários administrativos mantidos`);
  
} catch (error) {
  console.error('❌ Erro durante a limpeza:', error);
  console.error('Stack:', error.stack);
} finally {
  db.close();
  console.log('\n🔒 Conexão com banco fechada');
}
