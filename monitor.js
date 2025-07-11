// Script de monitoramento de performance do servidor CMBM
const http = require('http');

const URL_BASE = process.env.URL_ACESSO || 'https://fa4e1230-c5dd-4140-9a8e-c02b44d1c05d-00-foigefqrsgcc.picard.replit.dev';

console.log('🔍 Iniciando monitoramento de performance...');
console.log(`📡 URL Base: ${URL_BASE}`);

// Função para fazer requisição HTTP
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${URL_BASE}${path}`;
    const startTime = Date.now();
    
    const req = http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        resolve({
          path,
          status: res.statusCode,
          duration,
          size: data.length,
          cache: res.headers['x-cache'] || 'N/A'
        });
      });
    });
    
    req.on('error', (err) => {
      reject({ path, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject({ path, error: 'Timeout' });
    });
  });
}

// Testes de performance
async function runPerformanceTests() {
  const tests = [
    '/',
    '/galeria',
    '/health',
    '/login'
  ];
  
  console.log('\n📊 Testando performance das páginas...\n');
  
  for (const path of tests) {
    try {
      // Primeira requisição (sem cache)
      const result1 = await makeRequest(path);
      
      // Segunda requisição (com cache)
      await new Promise(resolve => setTimeout(resolve, 100));
      const result2 = await makeRequest(path);
      
      console.log(`📄 ${path}`);
      console.log(`   1ª req: ${result1.status} | ${result1.duration}ms | ${(result1.size/1024).toFixed(2)}KB | Cache: ${result1.cache}`);
      console.log(`   2ª req: ${result2.status} | ${result2.duration}ms | ${(result2.size/1024).toFixed(2)}KB | Cache: ${result2.cache}`);
      
      // Calcular melhoria de performance
      const improvement = ((result1.duration - result2.duration) / result1.duration * 100).toFixed(1);
      if (improvement > 0) {
        console.log(`   ⚡ Melhoria: ${improvement}% mais rápido\n`);
      } else {
        console.log(`   ⚠️ Sem melhoria significativa\n`);
      }
      
    } catch (error) {
      console.log(`❌ ${path}: ${error.error}\n`);
    }
  }
}

// Teste de carga básico
async function runLoadTest() {
  console.log('🚀 Iniciando teste de carga básico (10 requisições simultâneas)...\n');
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(makeRequest('/'));
  }
  
  try {
    const results = await Promise.all(promises);
    const times = results.map(r => r.duration);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log('📈 Resultados do teste de carga:');
    console.log(`   Tempo médio: ${avg.toFixed(2)}ms`);
    console.log(`   Tempo mínimo: ${min}ms`);
    console.log(`   Tempo máximo: ${max}ms`);
    console.log(`   ✅ Todas as ${results.length} requisições foram bem-sucedidas\n`);
    
  } catch (error) {
    console.log(`❌ Erro no teste de carga: ${error}\n`);
  }
}

// Monitoramento contínuo
async function continuousMonitoring() {
  console.log('⏰ Iniciando monitoramento contínuo (a cada 30 segundos)...\n');
  
  setInterval(async () => {
    try {
      const health = await makeRequest('/health');
      const main = await makeRequest('/');
      
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      console.log(`[${timestamp}] Health: ${health.status} (${health.duration}ms) | Main: ${main.status} (${main.duration}ms)`);
      
    } catch (error) {
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      console.log(`[${timestamp}] ❌ Erro: ${error.error}`);
    }
  }, 30000);
}

// Executar todos os testes
async function runAllTests() {
  try {
    await runPerformanceTests();
    await runLoadTest();
    continuousMonitoring();
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Verificar se o servidor está funcionando primeiro
makeRequest('/health')
  .then(() => {
    console.log('✅ Servidor está online e responsivo\n');
    runAllTests();
  })
  .catch(() => {
    console.log('❌ Servidor não está respondendo. Verifique se está rodando na porta 5000.\n');
    process.exit(1);
  });