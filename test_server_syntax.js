// Teste de sintaxe do servidor
const fs = require('fs');

try {
    console.log('Lendo arquivo server.js...');
    const serverContent = fs.readFileSync('./server.js', 'utf8');
    
    console.log('Verificando sintaxe...');
    
    // Verificar se há problemas de sintaxe JS básicos
    try {
        new Function(serverContent);
        console.log('✅ Sintaxe básica JavaScript válida');
    } catch (syntaxError) {
        console.log('❌ Erro de sintaxe JavaScript:', syntaxError.message);
    }
    
    // Verificar se as rotas de homenagens estão presentes
    const hasHomenagemRoutes = serverContent.includes("app.get('/homenagens'");
    console.log(`✅ Rota GET /homenagens presente: ${hasHomenagemRoutes}`);
    
    const hasHomenagemEnviarRoute = serverContent.includes("app.get('/homenagens/enviar'");
    console.log(`✅ Rota GET /homenagens/enviar presente: ${hasHomenagemEnviarRoute}`);
    
    const hasHomenagemAprovarRoute = serverContent.includes("app.get('/homenagens/aprovar'");
    console.log(`✅ Rota GET /homenagens/aprovar presente: ${hasHomenagemAprovarRoute}`);
    
    // Verificar se há startServer function
    const hasStartServer = serverContent.includes("function startServer");
    console.log(`✅ Função startServer presente: ${hasStartServer}`);
    
    // Verificar se startServer é chamada
    const callsStartServer = serverContent.includes("startServer()");
    console.log(`✅ startServer() é chamada: ${callsStartServer}`);
    
    console.log('\n=== Verificação concluída ===');
    
} catch (error) {
    console.error('Erro ao ler arquivo:', error.message);
}