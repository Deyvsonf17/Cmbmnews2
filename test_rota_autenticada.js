const fetch = require('node-fetch');

async function testAuthenticatedRoute() {
  console.log('🧪 Testando rota autenticada /perfil/confirmar-alteracao...');
  
  try {
    const baseUrl = 'https://5bfcbcb7-e416-4789-b521-901f3256f0d4-00-jldd55nqvj83.janeway.replit.dev';
    
    // Primeiro vamos fazer login
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'email=admin@cmbm.com.br&senha=admin123'
    });
    
    console.log('📊 Status do login:', loginResponse.status);
    
    if (loginResponse.status === 302) {
      // Obter cookie de sessão
      const cookies = loginResponse.headers.get('set-cookie');
      console.log('🍪 Cookie obtido:', cookies ? 'Sim' : 'Não');
      
      if (cookies) {
        // Testar rota protegida
        const testResponse = await fetch(`${baseUrl}/perfil/confirmar-alteracao`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookies
          },
          body: 'codigo=12345'
        });
        
        console.log('📊 Status da rota protegida:', testResponse.status);
        console.log('📋 Headers:', testResponse.headers.raw());
        
        if (testResponse.status === 200) {
          console.log('✅ Rota protegida acessível!');
        } else {
          console.log('⚠️  Rota protegida retornou status:', testResponse.status);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testAuthenticatedRoute();