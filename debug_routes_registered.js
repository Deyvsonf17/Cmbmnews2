const express = require('express');
const app = express();

// Middleware para interceptar o registro de rotas
const originalPost = app.post;
app.post = function(path, ...args) {
  console.log(`🔍 Registrando rota POST: ${path}`);
  return originalPost.call(this, path, ...args);
};

require('./server.js');

// Função para listar todas as rotas registradas
function listRoutes(app) {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        method: Object.keys(middleware.route.methods)[0].toUpperCase(),
        path: middleware.route.path
      });
    }
  });
  
  return routes;
}

// Aguardar um pouco para o servidor inicializar
setTimeout(() => {
  console.log('\n📊 Rotas registradas:');
  const routes = listRoutes(app);
  
  routes.forEach(route => {
    console.log(`${route.method} ${route.path}`);
  });
  
  // Filtrar apenas rotas de perfil
  const perfilRoutes = routes.filter(route => route.path.includes('/perfil'));
  console.log('\n🔍 Rotas de perfil encontradas:');
  perfilRoutes.forEach(route => {
    console.log(`${route.method} ${route.path}`);
  });
}, 2000);