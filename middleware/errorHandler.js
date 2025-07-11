// Middleware de tratamento de erros centralizado
const path = require('path');

// Mapear códigos de erro para mensagens personalizadas
const errorMessages = {
  400: {
    title: 'Requisição Inválida',
    message: 'Os dados enviados estão malformados ou incompletos.',
    icon: '⚠️',
    color: '#fd7e14'
  },
  401: {
    title: 'Acesso Não Autorizado',
    message: 'Você precisa fazer login para acessar esta página.',
    icon: '🔐',
    color: '#6f42c1',
    redirect: '/login'
  },
  403: {
    title: 'Acesso Negado',
    message: 'Você não tem permissão para acessar este recurso.',
    icon: '🚫',
    color: '#dc3545'
  },
  404: {
    title: 'Página Não Encontrada',
    message: 'A página que você está procurando não existe.',
    icon: '🔍',
    color: '#6c757d'
  },
  405: {
    title: 'Método Não Permitido',
    message: 'Este método HTTP não é suportado para esta rota.',
    icon: '❌',
    color: '#dc3545'
  },
  413: {
    title: 'Arquivo Muito Grande',
    message: 'O arquivo enviado excede o tamanho máximo permitido.',
    icon: '📁',
    color: '#fd7e14'
  },
  415: {
    title: 'Tipo de Arquivo Inválido',
    message: 'O tipo de arquivo enviado não é suportado.',
    icon: '📄',
    color: '#fd7e14'
  },
  422: {
    title: 'Dados Inválidos',
    message: 'Os dados fornecidos contêm erros de validação.',
    icon: '📝',
    color: '#fd7e14'
  },
  429: {
    title: 'Muitas Tentativas',
    message: 'Você fez muitas requisições em pouco tempo. Tente novamente em alguns minutos.',
    icon: '⏰',
    color: '#ffc107'
  },
  500: {
    title: 'Erro Interno do Servidor',
    message: 'Ocorreu um erro interno. Nossa equipe foi notificada.',
    icon: '🔧',
    color: '#dc3545'
  },
  502: {
    title: 'Gateway Inválido',
    message: 'Erro de comunicação com o servidor. Tente novamente.',
    icon: '🌐',
    color: '#dc3545'
  },
  503: {
    title: 'Serviço Indisponível',
    message: 'O servidor está temporariamente indisponível. Tente novamente em alguns minutos.',
    icon: '⚙️',
    color: '#ffc107'
  },
  504: {
    title: 'Timeout do Gateway',
    message: 'O servidor demorou demais para responder. Tente novamente.',
    icon: '⏱️',
    color: '#ffc107'
  }
};

// Middleware principal de tratamento de erros
function errorHandler(err, req, res, next) {
  console.error('🚨 Erro capturado pelo middleware:', err);
  
  // Definir código de status padrão
  let statusCode = err.statusCode || err.status || 500;
  
  // Tratar diferentes tipos de erro
  if (err.name === 'ValidationError') {
    statusCode = 422;
  } else if (err.name === 'CastError') {
    statusCode = 400;
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 415;
  }

  // Buscar configuração de erro
  const errorConfig = errorMessages[statusCode] || errorMessages[500];
  
  // Log detalhado do erro para debug
  console.error('📊 Detalhes do erro:', {
    status: statusCode,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Preparar dados para o template
  const errorData = {
    statusCode,
    title: errorConfig.title,
    message: errorConfig.message,
    icon: errorConfig.icon,
    color: errorConfig.color,
    originalUrl: req.originalUrl,
    canGoBack: req.get('Referer') ? true : false,
    user: req.session ? req.session.user : null,
    timestamp: new Date().toLocaleString('pt-BR')
  };

  // Se for requisição AJAX, retornar JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      error: true,
      statusCode,
      title: errorConfig.title,
      message: errorConfig.message
    });
  }

  // Verificar se deve redirecionar (ex: 401 para login)
  if (errorConfig.redirect) {
    return res.redirect(errorConfig.redirect);
  }

  // Renderizar página de erro
  res.status(statusCode).render('error', errorData);
}

// Middleware para capturar rotas não encontradas (404)
function notFoundHandler(req, res, next) {
  const error = new Error(`Rota não encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

// Middleware para tratar erros não capturados
function uncaughtExceptionHandler() {
  process.on('uncaughtException', (error) => {
    console.error('💥 Erro não capturado:', error);
    console.error('Stack:', error.stack);
    // Log para arquivo se necessário
    // Não sair do processo para manter o servidor rodando
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Promise rejeitada não tratada:', reason);
    console.error('Em:', promise);
    // Log para arquivo se necessário
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  uncaughtExceptionHandler
};