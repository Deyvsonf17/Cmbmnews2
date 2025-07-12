// Middleware de otimização de performance e proteção
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Rate limiting para proteger contra ataques
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: true,
      statusCode: 429,
      title: 'Muitas Tentativas',
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const error = new Error(message);
      error.statusCode = 429;
      throw error;
    }
  });
};

// Rate limits específicos
const rateLimits = {
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // máximo de 1000 requests por IP
    message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
  }),

  login: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // máximo de 10 tentativas de login por IP
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
  }),

  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 50, // máximo de 50 uploads por IP
    message: 'Muitos uploads. Tente novamente em 1 hora.',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
  }),

  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // máximo de 5 tentativas por IP
    message: 'Muitas tentativas de redefinição. Tente novamente em 1 hora.',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
  })
};

// Middleware de compressão
const compressionMiddleware = compression({
  // Comprimir apenas se a resposta for maior que 1KB
  threshold: 1024,
  // Não comprimir se já estiver comprimido
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

// Middleware de cache para recursos estáticos
const cacheControl = (req, res, next) => {
  // Cache para recursos estáticos (imagens, CSS, JS)
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 ano
  } else if (req.url.startsWith('/api/')) {
    // Não cachear APIs
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    // Cache moderado para páginas HTML
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos
  }
  next();
};

// Middleware de segurança básica
const securityHeaders = (req, res, next) => {
  // Prevenir ataques XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // HTTPS redirect (se em produção)
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
    return;
  }

  next();
};

// Middleware para log de performance
const performanceLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log requisições lentas (> 1 segundo)
    if (duration > 1000) {
      console.warn(`🐌 Requisição lenta: ${req.method} ${req.url} - ${duration}ms`);
    }

    // Log para análise de performance
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
};

// Middleware para timeout de requisições
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      const error = new Error('Timeout da requisição');
      error.statusCode = 408;
      next(error);
    });
    next();
  };
};

// Middleware para limitar tamanho do body
const bodySizeLimit = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    const error = new Error('Payload muito grande');
    error.statusCode = 413;
    return next(error);
  }

  next();
};

// Middleware para detectar e prevenir SQL injection básico
const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\bOR\b.*=.*\bOR\b)/gi,
    /(\bAND\b.*=.*\bAND\b)/gi
  ];

  const checkForSqlInjection = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            console.warn(`🚨 Possível SQL Injection detectado: ${key} = ${obj[key]}`);
            console.warn(`🌐 IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
            const error = new Error('Entrada inválida detectada');
            error.statusCode = 400;
            throw error;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkForSqlInjection(obj[key]);
      }
    }
  };

  try {
    if (req.body) checkForSqlInjection(req.body);
    if (req.query) checkForSqlInjection(req.query);
    if (req.params) checkForSqlInjection(req.params);
  } catch (error) {
    return next(error);
  }

  next();
};

// Health check endpoint para monitoramento
const healthCheck = (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    node_version: process.version
  };

  res.json(healthData);
};

module.exports = {
  rateLimits,
  compressionMiddleware,
  cacheControl,
  securityHeaders,
  performanceLogger,
  requestTimeout,
  bodySizeLimit,
  sqlInjectionProtection,
  healthCheck
};