// Sistema de cache simples em memória para otimização de performance
const memoize = require('memoizee');

// Cache para consultas do banco de dados
const dbCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para notícias da página inicial
const cacheNoticias = memoize(async (getDatabase) => {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id 
      WHERE n.publicada = 1 
      ORDER BY n.data_criacao DESC 
      LIMIT 20
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}, {
  maxAge: CACHE_TTL,
  max: 1,
  promise: true
});

// Cache para álbuns da galeria
const cacheAlbuns = memoize(async (getDatabase) => {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT a.*, u.nome as autor_nome,
             COUNT(f.id) as total_fotos,
             (SELECT f2.imagem_url FROM fotos f2 
              WHERE f2.album_id = a.id AND f2.status = 'aprovada' 
              ORDER BY f2.data_criacao ASC LIMIT 1) as foto_capa
      FROM albums a
      LEFT JOIN usuarios u ON a.autor_id = u.id
      LEFT JOIN fotos f ON a.id = f.album_id AND f.status = 'aprovada'
      GROUP BY a.id
      HAVING COUNT(f.id) > 0
      ORDER BY a.data_evento DESC
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}, {
  maxAge: CACHE_TTL,
  max: 1,
  promise: true
});

// Cache para estatísticas do sistema
const cacheStats = memoize(async (getDatabase) => {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    Promise.all([
      new Promise((res, rej) => {
        db.get('SELECT COUNT(*) as total FROM noticias WHERE publicada = 1', [], (err, row) => {
          if (err) rej(err);
          else res(row.total);
        });
      }),
      new Promise((res, rej) => {
        db.get('SELECT COUNT(*) as total FROM usuarios WHERE ativo = "true"', [], (err, row) => {
          if (err) rej(err);
          else res(row.total);
        });
      }),
      new Promise((res, rej) => {
        db.get('SELECT COUNT(*) as total FROM fotos WHERE status = "aprovada"', [], (err, row) => {
          if (err) rej(err);
          else res(row.total);
        });
      })
    ]).then(([noticias, usuarios, fotos]) => {
      resolve({ noticias, usuarios, fotos });
    }).catch(reject);
  });
}, {
  maxAge: CACHE_TTL * 2, // 10 minutos para estatísticas
  max: 1,
  promise: true
});

// Middleware para invalidar cache quando necessário
const invalidateCache = (cacheType) => {
  switch (cacheType) {
    case 'noticias':
      cacheNoticias.clear();
      console.log('🗑️ Cache de notícias invalidado');
      break;
    case 'albuns':
      cacheAlbuns.clear();
      console.log('🗑️ Cache de álbuns invalidado');
      break;
    case 'stats':
      cacheStats.clear();
      console.log('🗑️ Cache de estatísticas invalidado');
      break;
    case 'all':
      cacheNoticias.clear();
      cacheAlbuns.clear();
      cacheStats.clear();
      console.log('🗑️ Todos os caches invalidados');
      break;
    default:
      console.log('⚠️ Tipo de cache desconhecido:', cacheType);
  }
};

// Middleware para limpeza automática do cache
const cacheCleanup = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    // Se uso de memória for > 100MB, limpar caches
    if (memUsageMB > 100) {
      console.log(`🧹 Limpando cache - Uso de memória: ${memUsageMB.toFixed(2)}MB`);
      invalidateCache('all');
    }
  }, 10 * 60 * 1000); // A cada 10 minutos
};

// Middleware para cache de resposta HTTP
const httpCache = (duration = 300) => {
  return (req, res, next) => {
    // Não cachear se usuário logado
    if (req.session && req.session.userId) {
      return next();
    }
    
    // Apenas páginas GET
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = req.originalUrl;
    const cached = dbCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < (duration * 1000)) {
      console.log(`📦 Cache hit: ${key}`);
      res.set('X-Cache', 'HIT');
      return res.send(cached.data);
    }
    
    // Interceptar res.send para cachear
    const originalSend = res.send;
    res.send = function(data) {
      // Cachear apenas se resposta foi bem sucedida
      if (res.statusCode === 200) {
        dbCache.set(key, {
          data,
          timestamp: Date.now()
        });
        res.set('X-Cache', 'MISS');
        console.log(`📝 Cached: ${key}`);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Cleanup automático do cache HTTP
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of dbCache.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) { // 5 minutos
      dbCache.delete(key);
    }
  }
}, 60 * 1000); // A cada minuto

// Inicializar limpeza automática
cacheCleanup();

module.exports = {
  cacheNoticias,
  cacheAlbuns,
  cacheStats,
  invalidateCache,
  httpCache
};