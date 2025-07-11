
const { getDatabase } = require('./database');

async function fixTokens() {
  try {
    const db = getDatabase();
    
    console.log('🔧 Iniciando correção de tokens...');
    
    // Limpar todos os tokens expirados ou com formato inválido
    await db.query('DELETE FROM reset_codes WHERE used = 1 OR expires_at < datetime("now", "localtime")');
    console.log('✅ Tokens expirados removidos');
    
    // Limpar tokens com formato de data inválido
    await db.query('DELETE FROM reset_codes WHERE expires_at NOT LIKE "____-__-__T__:__:__.___Z"');
    console.log('✅ Tokens com formato inválido removidos');
    
    console.log('🎉 Correção de tokens concluída!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao corrigir tokens:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const { initializeDatabase } = require('./database');
  initializeDatabase().then(() => {
    fixTokens();
  });
}

module.exports = { fixTokens };
