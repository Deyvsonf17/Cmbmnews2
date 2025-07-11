require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const nodemailer = require('nodemailer');
const multer = require('multer');
const transporter = require('./mailer');
const { initializeDatabase, getDatabase } = require('./database');

// Importar middlewares personalizados
const { errorHandler, notFoundHandler, uncaughtExceptionHandler } = require('./middleware/errorHandler');
const {
  rateLimits,
  compressionMiddleware,
  cacheControl,
  securityHeaders,
  performanceLogger,
  requestTimeout,
  bodySizeLimit,
  sqlInjectionProtection,
  healthCheck
} = require('./middleware/performance');
const { cacheNoticias, cacheAlbuns, cacheStats, invalidateCache, httpCache } = require('./middleware/cache');

// Rate limiting simples
const loginAttempts = new Map();
const maxAttempts = 5;
const lockoutTime = 15 * 60 * 1000; // 15 minutos

// Função para gerar slug amigável
function generateSlug(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-'); // Remove hífens duplicados
}

// Função para sanitizar entrada de texto
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 10000); // Limitar tamanho
}

// Função para gerar senha automática de 8 dígitos
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let password = '';

  // Garantir pelo menos 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial
  const categories = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz', 
    '0123456789',
    '!@#$%&*'
  ];

  // Adicionar um caractere de cada categoria
  for (let category of categories) {
    password += category.charAt(Math.floor(Math.random() * category.length));
  }

  // Completar os 4 caracteres restantes
  for (let i = 4; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Embaralhar a senha
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Função para validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.URL_ACESSO || 'https://de5a6fec-33bd-4e76-9e93-897a4d8ab78b-00-2ayg4w3174e48.riker.replit.dev';

// Configurar trust proxy para Replit
app.set('trust proxy', 1);

// Configurar tratamento de erros não capturados
uncaughtExceptionHandler();

// Aplicar middlewares de performance e segurança
app.use(performanceLogger);
app.use(requestTimeout(30000)); // 30 segundos de timeout
app.use(bodySizeLimit);
app.use(compressionMiddleware);
app.use(cacheControl);
app.use(securityHeaders);
app.use(sqlInjectionProtection);

// Rate limiting geral
app.use(rateLimits.general);

function getTransporter() {
  return transporter;
}

// Função para criar template de email profissional
function createEmailTemplate(title, content, hasLogo = true) {
  const baseUrl = BASE_URL;
  const logoUrl = hasLogo ? `${baseUrl}/public/logo.png` : '';

  // Substituir URLs do localhost no conteúdo
  content = content.replace(/http:\/\/localhost:5000/g, baseUrl);
  content = content.replace(/localhost:5000/g, baseUrl.replace('https://', '').replace('http://', ''));

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 30px 20px; text-align: center; position: relative;">
        ${hasLogo ? `<img src="${logoUrl}" alt="CMBM" style="height: 60px; margin-bottom: 15px; filter: brightness(0) invert(1);">` : ''}
        <h1 style="margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">CMBM NEWS</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Colégio Municipal Baltazar Moreno</p>
        <div style="position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; transform: translate(30px, -30px);"></div>
      </div>

      <!-- Title -->
      <div style="padding: 30px 20px 20px; background-color: #f8f9fa; border-bottom: 3px solid #001f3f;">
        <h2 style="margin: 0; color: #001f3f; font-size: 22px; text-align: center; font-weight: 600;">
          ${title}
        </h2>
      </div>

      <!-- Content -->
      <div style="padding: 30px 20px;">
        ${content}
      </div>

      <!-- Footer -->
      <div style="background-color: #001f3f; color: white; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} CMBM NEWS - Todos os direitos reservados</p>
        <p style="margin: 0; opacity: 0.8;">Colégio Municipal Baltazar Moreno</p>
      </div>
    </div>
  `;
}

// Função para agendar próximas homenagens (2 por semana)

function agendarProximasHomenagens() {
  const db = getDatabase();

  db.all(`
    SELECT id FROM homenagens 
    WHERE status = 'aprovada' 
    AND data_agendada IS NULL 
    AND publicada = 0 
    ORDER BY ordem_publicacao ASC
  `, [], (err, homenagensPendentes) => {
    if (err) {
      console.error('Erro ao buscar homenagens para agendar:', err);
      return;
    }

    if (!homenagensPendentes || homenagensPendentes.length === 0) return;

    db.get(`
      SELECT MAX(data_agendada) AS ultima_data 
      FROM homenagens 
      WHERE data_agendada IS NOT NULL
    `, [], (err, result) => {
      if (err) {
        console.error('Erro ao buscar última data agendada:', err);
        return;
      }

      let proximaData = result && result.ultima_data
        ? new Date(result.ultima_data)
        : getProximaSegunda(); // próxima segunda-feira às 09h

      proximaData.setHours(9, 0, 0, 0);

      let contadorSemana = 0;
      const HOMENAGENS_POR_SEMANA = 2;

      homenagensPendentes.forEach((homenagem) => {
        if (contadorSemana >= HOMENAGENS_POR_SEMANA) {
          proximaData.setDate(proximaData.getDate() + 7);
          contadorSemana = 0;
        }

        const dataAgendada = new Date(proximaData.getTime());
        if (contadorSemana === 1) {
          dataAgendada.setDate(dataAgendada.getDate() + 3); // quinta
        }

        db.run(`
          UPDATE homenagens 
          SET data_agendada = ? 
          WHERE id = ?
        `, [dataAgendada.toISOString(), homenagem.id], (err) => {
          if (err) {
            console.error(`Erro ao agendar homenagem ID ${homenagem.id}:`, err);
          } else {
            console.log(`✅ Homenagem ID ${homenagem.id} agendada para ${dataAgendada.toISOString()}`);
          }
        });

        contadorSemana++;
      });
    });
  });
}

// Função para obter próxima segunda-feira
function getProximaSegunda() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  const diasParaSegunda = diaSemana === 0 ? 1 : (8 - diaSemana) % 7 || 7;

  const proximaSegunda = new Date(hoje.getTime());
  proximaSegunda.setDate(hoje.getDate() + diasParaSegunda);
  proximaSegunda.setHours(9, 0, 0, 0); // 9h da manhã

  return proximaSegunda;
}

// Função para publicar homenagens agendadas
function publicarHomenagensProgramadas() {
  const db = getDatabase();
  const agora = new Date();

  db.all(`
    SELECT id, nome FROM homenagens 
    WHERE status = 'aprovada' 
    AND data_agendada IS NOT NULL 
    AND data_agendada <= ? 
    AND publicada = 0
  `, [agora.toISOString()], (err, homenagensProgramadas) => {
    if (err) {
      console.error('Erro ao buscar homenagens programadas:', err);
      return;
    }

    homenagensProgramadas.forEach(homenagem => {
      db.run(`
        UPDATE homenagens 
        SET publicada = 1 
        WHERE id = ?
      `, [homenagem.id], (err) => {
        if (err) {
          console.error('Erro ao publicar homenagem:', err);
        } else {
          console.log(`✅ Homenagem publicada automaticamente: ${homenagem.nome}`);
        }
      });
    });
  });
}

// Executar verificação de publicação a cada hora
setInterval(publicarHomenagensProgramadas, 60 * 60 * 1000); // 1 hora

// Função para enviar email
async function sendEmail(to, subject, html) {
  try {
    console.log('📧 Tentando enviar email para:', to);
    console.log('📧 Assunto:', subject);
    console.log('📧 SMTP User:', process.env.SMTP_USER);
    console.log('📧 SMTP configurado:', process.env.SMTP_USER ? 'Sim' : 'Não');

    // Configuração Elastic Email
    const mailOptions = {
      from: `"CMBM NEWS" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: html.replace(/<[^>]*>/g, ''), // Versão texto sem HTML
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'X-Mailer': 'CMBM NEWS System'
      }
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('✅ Email enviado com sucesso via Elastic Email!');
    console.log('📨 Message ID:', info.messageId);
    console.log('📬 Para:', to);
    console.log('📨 Response:', info.response);
    return true;
  } catch (error) {
    console.error('❌ Erro detalhado ao enviar email:');
    console.error('   Para:', to);
    console.error('   Assunto:', subject);
    console.error('   Erro:', error.message);
    console.error('   Code:', error.code);
    console.error('   Command:', error.command);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Configuração do Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware de segurança básica
app.use((req, res, next) => {
  // Remover header X-Powered-By
  res.removeHeader('X-Powered-By');

  // Adicionar headers de segurança
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  next();
});

// Configuração de sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'cmbm-news-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Mudar nome padrão do cookie
  cookie: { 
    secure: false, 
    httpOnly: true,
    maxAge: 2 * 60 * 60 * 1000, // Reduzir para 2 horas
    sameSite: 'lax'
  }
}));

// Rate limiting para login
function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };

  if (attempts.count >= maxAttempts) {
    if (now - attempts.lastAttempt < lockoutTime) {
      return false; // Bloqueado
    } else {
      // Reset após tempo de bloqueio
      loginAttempts.delete(ip);
      return true;
    }
  }

  return true;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(ip, attempts);
}

function clearFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

// Middleware para verificar autenticação
function requireAuth(req, res, next) {
  if (req.session.userId && req.session.user) {
    // Verificar se sessão não expirou
    if (req.session.cookie.expires && new Date() > req.session.cookie.expires) {
      req.session.destroy();
      return res.redirect('/login?error=session_expired');
    }
    next();
  } else {
    req.session.destroy();
    res.redirect('/login');
  }
}

// Middleware para verificar tipo de usuário
function requireRole(roles) {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    try {
      const db = getDatabase();
      db.get('SELECT tipo FROM usuarios WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
          console.error('Erro ao verificar permissões:', err);
          return res.status(500).render('error', { 
            message: 'Erro interno do servidor',
            user: req.session.user
          });
        }

        if (!user || !roles.includes(user.tipo)) {
          return res.status(403).render('error', { 
            message: 'Acesso negado. Você não tem permissão para acessar esta página.',
            user: req.session.user
          });
        }

        req.userType = user.tipo;
        next();
      });
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      res.status(500).render('error', { 
        message: 'Erro interno do servidor',
        user: req.session.user
      });
    }
  };
}

// Middleware para carregar dados do usuário
function loadUser(req, res, next) {
  if (req.session.userId) {
    try {
      const db = getDatabase();
      db.get('SELECT id, nome, email, tipo, foto_perfil FROM usuarios WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
          console.error('Erro ao carregar usuário:', err);
          req.session.user = null;
        } else {
          req.session.user = user || null;
        }
        next();
      });
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
      req.session.user = null;
      next();
    }
  } else {
    next();
  }
}

app.use(loadUser);

// Rota principal - página inicial com paginação, busca e filtros
app.get('/', httpCache(300), (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const categoria = req.query.categoria || '';
    const busca = req.query.busca || '';
    const limit = 5;
    const offset = (page - 1) * limit;

    const db = getDatabase();

    // Construir query de busca apenas para notícias publicadas
    let baseQuery = 'SELECT * FROM noticias WHERE status = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM noticias WHERE status = ?';
    let queryParams = ['publicada'];

    if (categoria && categoria !== 'todas') {
      baseQuery += ' AND categoria = ?';
      countQuery += ' AND categoria = ?';
      queryParams.push(categoria);
    }

    if (busca) {
      baseQuery += ' AND (titulo LIKE ? OR conteudo LIKE ?)';
      countQuery += ' AND (titulo LIKE ? OR conteudo LIKE ?)';
      queryParams.push(`%${busca}%`, `%${busca}%`);
    }

    baseQuery += ' ORDER BY data_criacao DESC LIMIT ? OFFSET ?';

    // Para o count, não adicionar limit/offset
    const countParams = [...queryParams];
    queryParams.push(limit, offset);

    // Executar queries SQLite
    db.all(baseQuery, queryParams, (err, noticias) => {
      if (err) {
        console.error('Erro ao carregar notícias:', err);
        return res.render('home', {
          noticias: [],
          categorias: [],
          currentPage: 1,
          totalPages: 1,
          categoria: '',
          busca: '',
          user: req.session.user
        });
      }

      db.get(countQuery, countParams, (err, totalResult) => {
        if (err) {
          console.error('Erro ao contar notícias:', err);
          return res.render('home', {
            noticias: [],
            categorias: [],
            currentPage: 1,
            totalPages: 1,
            categoria: '',
            busca: '',
            user: req.session.user
          });
        }

        db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', [], (err, categoriasResult) => {
          if (err) {
            console.error('Erro ao carregar categorias:', err);
            categoriasResult = [];
          }

          const total = parseInt(totalResult.total);
          const categorias = categoriasResult.map(row => row.categoria);
          const totalPages = Math.ceil(total / limit);

          res.render('home', {
            noticias: noticias || [],
            categorias,
            currentPage: page,
            totalPages,
            categoria,
            busca,
            user: req.session.user
          });
        });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar notícias:', error);
    res.render('home', {
      noticias: [],
      categorias: [],
      currentPage: 1,
      totalPages: 1,
      categoria: '',
      busca: '',
      user: req.session.user
    });
  }
});

// Rota para visualizar notícia individual
app.get('/noticia/:slug', (req, res) => {
  try {
    const db = getDatabase();
    db.get(`
      SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id 
      WHERE n.slug = ? AND n.status = ?
    `, [req.params.slug, 'publicada'], (err, noticia) => {
      if (err) {
        console.error('Erro ao carregar notícia:', err);
        return res.status(500).render('noticia', { 
          noticia: null, 
          user: req.session.user,
          error: 'Erro interno do servidor' 
        });
      }

    if (!noticia) {
        return res.status(404).render('noticia', { 
          noticia: null, 
          user: req.session.user,
          error: 'Notícia não encontrada ou não está publicada' 
        });
      }

      res.render('noticia', { noticia, user: req.session.user });
    });
  } catch (error) {
    console.error('Erro ao carregar notícia:', error);
    res.status(500).render('noticia', { 
      noticia: null, 
      user: req.session.user,
      error: 'Erro interno do servidor' 
    });
  }
});

// Configuração do multer para upload de fotos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não permitido. Use JPG, PNG ou WEBP.'), false);
    }
  }
});

// ==== ROTAS DA GALERIA ====

// Rota para página principal da galeria
app.get('/galeria', httpCache(600), (req, res) => {
  try {
    const db = getDatabase();
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
    `, (err, albums) => {
      if (err) {
        console.error('Erro ao carregar álbuns:', err);
        return res.render('galeria', { albums: [], user: req.session.user, error: 'Erro ao carregar álbuns' });
      }
      console.log('📸 Álbuns encontrados:', albums.length);
      res.render('galeria', { albums, user: req.session.user });
    });
  } catch (error) {
    console.error('Erro ao carregar galeria:', error);
    res.render('galeria', { albums: [], user: req.session.user, error: 'Erro interno do servidor' });
  }
});

// Rota para visualizar álbum específico
app.get('/galeria/album/:slug', (req, res) => {
  try {
    const db = getDatabase();

    // Buscar álbum
    db.get(`
      SELECT a.*, u.nome as autor_nome
      FROM albums a
      LEFT JOIN usuarios u ON a.autor_id = u.id
      WHERE a.slug = ?
    `, [req.params.slug], (err, album) => {
      if (err) {
        console.error('Erro ao carregar álbum:', err);
        return res.render('galeria-album', { album: null, fotos: [], user: req.session.user, error: 'Erro ao carregar álbum' });
      }

      if (!album) {
        return res.status(404).render('galeria-album', { album: null, fotos: [], user: req.session.user, error: 'Álbum não encontrado' });
      }

      // Buscar fotos aprovadas do álbum
      db.all(`
        SELECT f.*, u.nome as autor_nome
        FROM fotos f
        LEFT JOIN usuarios u ON f.autor_id = u.id
        WHERE f.album_id = ? AND f.status = 'aprovada'
        ORDER BY f.data_criacao ASC
      `, [album.id], (err, fotos) => {
        if (err) {
          console.error('Erro ao carregar fotos:', err);
          return res.render('galeria-album', { album, fotos: [], user: req.session.user, error: 'Erro ao carregar fotos' });
        }

        res.render('galeria-album', { album, fotos, user: req.session.user });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar álbum:', error);
    res.render('galeria-album', { album: null, fotos: [], user: req.session.user, error: 'Erro interno do servidor' });
  }
});

// Rota para página de envio de fotos (apenas para repórteres)
app.get('/galeria/enviar', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'aluno') {
    return res.status(403).render('galeria-enviar', { 
      user, 
      error: 'Acesso negado. Apenas repórteres (alunos) podem enviar fotos.' 
    });
  }

  res.render('galeria-enviar', { user });
});

// Rota para processar envio de fotos
app.post('/galeria/enviar', rateLimits.upload, upload.fields([
  { name: 'fotos', maxCount: 50 },
  { name: 'titulo' },
  { name: 'data_evento' },
  { name: 'descricao' },
  { name: 'url_alternativa' }
]), async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'aluno') {
    return res.status(403).render('galeria-enviar', { 
      user, 
      error: 'Acesso negado. Apenas repórteres (alunos) podem enviar fotos.' 
    });
  }

  try {
    const { titulo, data_evento, descricao, url_alternativa } = req.body;

    if (!titulo || !data_evento) {
      return res.render('galeria-enviar', { 
        user, 
        error: 'Título e data do evento são obrigatórios' 
      });
    }

    const db = getDatabase();
    const slug = generateSlug(titulo);

    // Verificar se já existe álbum com mesmo slug
    db.get('SELECT id FROM albums WHERE slug = ?', [slug], (err, existingAlbum) => {
      if (err) {
        console.error('Erro ao verificar álbum:', err);
        return res.render('galeria-enviar', { user, error: 'Erro interno do servidor' });
      }

      if (existingAlbum) {
        return res.render('galeria-enviar', { 
          user, 
          error: 'Já existe um álbum com este título. Use um título diferente.' 
        });
      }

      // Processar fotos primeiro
        let fotosParaProcessar = [];

        // Processar uploads ou URLs
        if (req.files && req.files.fotos && req.files.fotos.length > 0) {
          // Verificar limite de 50 fotos
          if (req.files.fotos.length > 50) {
            return res.render('galeria-enviar', { 
              user, 
              error: 'Máximo de 50 fotos por envio. Você enviou ' + req.files.fotos.length + ' fotos.'
            });
          }

          // Processar arquivos reais (converter para base64 para armazenar)
          fotosParaProcessar = req.files.fotos.map((file, index) => {
            const base64Data = file.buffer.toString('base64');
            const imageUrl = `data:${file.mimetype};base64,${base64Data}`;
            return {
              url: imageUrl,
              titulo: file.originalname,
              dadosArquivo: file
            };
          });
        } else if (url_alternativa) {
          const urls = url_alternativa.split('\n').filter(url => url.trim());

          // Verificar limite de 50 URLs
          if (urls.length > 50) {
            return res.render('galeria-enviar', { 
              user, 
              error: 'Máximo de 50 URLs por envio. Você enviou ' + urls.length + ' URLs.'
            });
          }

          fotosParaProcessar = urls.map(url => ({
            url: url.trim(),
            titulo: null
          }));
        }

        if (fotosParaProcessar.length === 0) {
          return res.render('galeria-enviar', { 
            user, 
            error: 'Você deve enviar pelo menos uma foto (arquivo ou URL)' 
          });
        }

        // Dividir fotos em grupos de 10
        const fotosChunks = [];
        const FOTOS_POR_ALBUM = 10;

        for (let i = 0; i < fotosParaProcessar.length; i += FOTOS_POR_ALBUM) {
          fotosChunks.push(fotosParaProcessar.slice(i, i + FOTOS_POR_ALBUM));
        }

        let albumsCriados = 0;
        let totalFotos = fotosParaProcessar.length;

        // Função para criar álbum e inserir fotos
        const criarAlbumComFotos = (fotosGrupo, parteNumero) => {
          return new Promise((resolve, reject) => {
            const tituloAlbum = parteNumero > 1 ? `${titulo} - Parte ${parteNumero}` : titulo;
            const slugAlbum = parteNumero > 1 ? `${slug}-parte-${parteNumero}` : slug;

            // Verificar se álbum já existe
            db.get('SELECT id FROM albums WHERE slug = ?', [slugAlbum], (err, existingAlbum) => {
              if (err) {
                reject(err);
                return;
              }

              if (existingAlbum) {
                reject(new Error(`Álbum "${tituloAlbum}" já existe. Use um título diferente.`));
                return;
              }

              // Criar álbum
              db.run(`
                INSERT INTO albums (titulo, slug, descricao, data_evento, autor_id)
                VALUES (?, ?, ?, ?, ?)
              `, [tituloAlbum, slugAlbum, descricao || null, data_evento, user.id], function(err) {
                if (err) {
                  reject(err);
                  return;
                }

                const albumId = this.lastID;

                // Inserir fotos do grupo
                const insertPromises = fotosGrupo.map(foto => {
                  return new Promise((resolveInner, rejectInner) => {
                    db.run(`
                      INSERT INTO fotos (album_id, titulo, imagem_url, status, autor_id)
                      VALUES (?, ?, ?, 'pendente', ?)
                    `, [albumId, foto.titulo, foto.url, user.id], (err) => {
                      if (err) rejectInner(err);
                      else resolveInner();
                    });
                  });
                });

                Promise.all(insertPromises)
                  .then(() => {
                    albumsCriados++;
                    resolve({
                      albumTitulo: tituloAlbum,
                      fotoCount: fotosGrupo.length
                    });
                  })
                  .catch(reject);
              });
            });
          });
        };

        // Criar álbuns sequencialmente
        const criarAlbunsSequencial = async () => {
          try {
            const resultados = [];

            for (let i = 0; i < fotosChunks.length; i++) {
              const resultado = await criarAlbumComFotos(fotosChunks[i], i + 1);
              resultados.push(resultado);
            }

            const mensagemSucesso = fotosChunks.length === 1 
              ? `Álbum "${titulo}" criado com sucesso! ${totalFotos} foto(s) enviada(s) para aprovação.`
              : `${fotosChunks.length} álbuns criados com sucesso! Total: ${totalFotos} foto(s) enviada(s) para aprovação.\n` +
                resultados.map(r => `• ${r.albumTitulo}: ${r.fotoCount} fotos`).join('\n');

            res.render('galeria-enviar', { 
              user, 
              success: mensagemSucesso
            });
          } catch (error) {
            console.error('Erro ao criar álbuns:', error);
            res.render('galeria-enviar', { 
              user, 
              error: error.message || 'Erro ao criar álbuns' 
            });
          }
        };

        criarAlbunsSequencial();
    });

  } catch (error) {
    console.error('Erro ao processar envio:', error);
    res.render('galeria-enviar', { user, error: 'Erro interno do servidor' });
  }
});

// Rota para página de aprovação (apenas para editores)
app.get('/galeria/aprovar', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor') {
    return res.status(403).render('galeria-aprovar', { 
      user, 
      fotosPendentes: [],
      error: 'Acesso negado. Apenas editores podem aprovar fotos.' 
    });
  }

  try {
    const db = getDatabase();
    db.all(`
      SELECT f.*, a.titulo as album_titulo, u.nome as autor_nome
      FROM fotos f
      JOIN albums a ON f.album_id = a.id
      LEFT JOIN usuarios u ON f.autor_id = u.id
      WHERE f.status = 'pendente'
      ORDER BY f.data_criacao ASC
    `, (err, fotosPendentes) => {
      if (err) {
        console.error('Erro ao carregar fotos pendentes:', err);
        return res.render('galeria-aprovar', { user, fotosPendentes: [], error: 'Erro ao carregar fotos pendentes' });
      }

      console.log('📸 Fotos pendentes encontradas:', fotosPendentes.length);
      res.render('galeria-aprovar', { user, fotosPendentes });
    });
  } catch (error) {
    console.error('Erro ao carregar aprovações:', error);
    res.render('galeria-aprovar', { user, fotosPendentes: [], error: 'Erro interno do servidor' });
  }
});

// API para buscar álbuns do usuário (repórteres)
app.get('/api/meus-albums', requireAuth, (req, res) => {
  try {
    const user = req.session.user;

    // Apenas alunos (repórteres) podem acessar seus álbuns
    if (user.tipo !== 'aluno') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const db = getDatabase();

    // Buscar álbuns do usuário com estatísticas de fotos
    db.all(`
      SELECT 
        a.*,
        COUNT(f.id) as total_fotos,
        COUNT(CASE WHEN f.status = 'aprovada' THEN 1 END) as fotos_aprovadas,
        COUNT(CASE WHEN f.status = 'pendente' THEN 1 END) as fotos_pendentes,
        COUNT(CASE WHEN f.status = 'reprovada' THEN 1 END) as fotos_reprovadas
      FROM albums a
      LEFT JOIN fotos f ON a.id = f.album_id
      WHERE a.autor_id = ?
      GROUP BY a.id
      ORDER BY a.data_criacao DESC
    `, [user.id], (err, albums) => {
      if (err) {
        console.error('Erro ao buscar álbuns do usuário:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      // Calcular estatísticas gerais
      const total = albums.length;
      let aguardando = 0;
      let aprovados = 0;
      let reprovados = 0;

      albums.forEach(album => {
        if (album.fotos_reprovadas > 0 && album.fotos_pendentes === 0 && album.fotos_aprovadas === 0) {
          reprovados++;
        } else if (album.fotos_aprovadas > 0 && album.fotos_pendentes === 0) {
          aprovados++;
        } else if (album.fotos_pendentes > 0) {
          aguardando++;
        }
      });

      res.json({
        albums: albums || [],
        total,
        aguardando,
        aprovados,
        reprovados
      });
    });
  } catch (error) {
    console.error('Erro na API de álbuns:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para processar aprovação/reprovação
app.post('/galeria/aprovar/:id', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const fotoId = req.params.id;
    const { action, motivo } = req.body;
    const db = getDatabase();

    if (action === 'aprovar') {
      db.run(`
        UPDATE fotos 
        SET status = 'aprovada', revisor_id = ?, data_aprovacao = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [user.id, fotoId], (err) => {
        if (err) {
          console.error('Erro ao aprovar foto:', err);
          return res.redirect('/galeria/aprovar?error=Erro ao aprovar foto');
        }
        res.redirect('/galeria/aprovar?success=Foto aprovada com sucesso');
      });
    } else if (action === 'reprovar') {
      db.run(`
        UPDATE fotos 
        SET status = 'reprovada', revisor_id = ?, observacoes = ?
        WHERE id = ?
      `, [user.id, motivo || 'Reprovado sem motivo especificado', fotoId], (err) => {
        if (err) {
          console.error('Erro ao reprovar foto:', err);
          return res.redirect('/galeria/aprovar?error=Erro ao reprovar foto');
        }
        res.redirect('/galeria/aprovar?success=Foto reprovada');
      });
    } else {
      res.redirect('/galeria/aprovar?error=Ação inválida');
    }
  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    res.redirect('/galeria/aprovar?error=Erro interno do servidor');
  }
});

// Rotas de debug removidas para segurança

// Rota para página de login
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null, user: null });
});

// Rota para processar login
app.post('/login', rateLimits.login, (req, res) => {
  try {
    const { email, senha } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Verificar rate limiting
    if (!checkRateLimit(clientIP)) {
      return res.render('login', { 
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.', 
        user: null 
      });
    }

    // Validação básica
    if (!email || !senha) {
      recordFailedAttempt(clientIP);
      return res.render('login', { error: 'Email e senha são obrigatórios', user: null });
    }

    // Sanitizar email
    const emailSanitizado = email.toLowerCase().trim();

    const db = getDatabase();

    console.log(`🔍 Tentativa de login para: ${emailSanitizado}`);

    // Usar db.get() em vez de prepare() para SQLite
    db.get('SELECT * FROM usuarios WHERE email = ?', [emailSanitizado], (err, usuario) => {
      if (err) {
        console.error('❌ Erro ao buscar usuário:', err);
        recordFailedAttempt(clientIP);
        return res.render('login', { error: 'Erro interno do servidor', user: null });
      }

      if (!usuario) {
        console.log(`❌ Usuário não encontrado: ${emailSanitizado}`);
        recordFailedAttempt(clientIP);
        return res.render('login', { error: 'Email ou senha incorretos', user: null });
      }

      console.log(`👤 Usuário encontrado: ${usuario.nome}`);
      console.log(`📊 Status ativo: ${usuario.ativo} (tipo: ${typeof usuario.ativo})`);
      console.log(`🔑 Tipo: ${usuario.tipo}`);
      console.log(`🔐 Hash da senha existe: ${!!usuario.senha_hash}`);

      // Verificar se o usuário está ativo - remover verificação para usuários principais
      const usuariosPrincipais = ['admin@cmbm.com.br', 'ti@cmbm.com.br', 'aluno@cmbm.com.br', 'editor@cmbm.com.br'];

      if (!usuariosPrincipais.includes(emailSanitizado) && usuario.ativo !== 'true' && usuario.ativo !== true && usuario.ativo !== 1) {
        console.log(`🚫 Usuário inativo: ${emailSanitizado}`);
        recordFailedAttempt(clientIP);
        return res.render('login', { error: 'Conta desativada. Entre em contato com o administrador.', user: null });
      }

      console.log(`✅ Verificação de status ativo passou para: ${emailSanitizado}`);

      // Verificar se a senha hash existe
      if (!usuario.senha_hash) {
        console.error(`❌ Hash da senha não encontrado para: ${emailSanitizado}`);
        recordFailedAttempt(clientIP);
        return res.render('login', { error: 'Erro na configuração da conta. Entre em contato com o administrador.', user: null });
      }

      console.log(`🔐 Verificando senha para: ${emailSanitizado}`);

      bcrypt.compare(senha, usuario.senha_hash, (err, senhaValida) => {
        if (err) {
          console.error('❌ Erro ao verificar senha:', err);
          recordFailedAttempt(clientIP);
          return res.render('login', { error: 'Erro interno do servidor', user: null });
        }

        console.log(`🔐 Senha válida: ${senhaValida} para ${emailSanitizado}`);

        if (!senhaValida) {
          console.log(`❌ Senha incorreta para: ${emailSanitizado}`);
          recordFailedAttempt(clientIP);
          return res.render('login', { error: 'Email ou senha incorretos', user: null });
        }

        // Login bem-sucedido - limpar tentativas falhadas
        console.log(`✅ Login bem-sucedido para: ${emailSanitizado}`);
        clearFailedAttempts(clientIP);

        // Regenerar sessão para prevenir session fixation
        req.session.regenerate((err) => {
          if (err) {
            console.error('❌ Erro ao regenerar sessão:', err);
            return res.render('login', { error: 'Erro interno do servidor', user: null });
          }

          req.session.userId = usuario.id;
          req.session.user = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo,
            foto_perfil: usuario.foto_perfil
          };

          console.log(`📝 Sessão criada para usuário: ${usuario.nome} (${usuario.tipo})`);

          req.session.save((err) => {
            if (err) {
              console.error('❌ Erro ao salvar sessão:', err);
              return res.render('login', { error: 'Erro interno do servidor', user: null });
            }
            console.log(`🚀 Redirecionando para dashboard: ${emailSanitizado}`);
            res.redirect('/dashboard');
          });
        });
      });
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.render('login', { error: 'Erro interno do servidor', user: null });
  }
});

// Rota para logout
app.get('/logout', (req, res) => {
  console.log('🚪 Processando logout para usuário:', req.session.user?.nome || 'Anônimo');
  
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Erro ao destruir sessão:', err);
      return res.redirect('/dashboard');
    }
    
    // Limpar todos os cookies relacionados à sessão
    res.clearCookie('sessionId');
    res.clearCookie('connect.sid');
    
    console.log('✅ Logout realizado com sucesso');
    res.redirect('/login?logout=success');
  });
});

// Rota POST para logout (alternativa)
app.post('/logout', (req, res) => {
  console.log('🚪 Processando logout POST para usuário:', req.session.user?.nome || 'Anônimo');
  
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Erro ao destruir sessão:', err);
      return res.json({ success: false, error: 'Erro ao fazer logout' });
    }
    
    // Limpar todos os cookies relacionados à sessão
    res.clearCookie('sessionId');
    res.clearCookie('connect.sid');
    
    console.log('✅ Logout POST realizado com sucesso');
    res.json({ success: true, redirect: '/login?logout=success' });
  });
});

// Dashboard principal (redireciona para o painel específico)
app.get('/dashboard', requireAuth, (req, res) => {
  const userType = req.session.user.tipo;

  switch (userType) {
    case 'diretor':
      res.redirect('/admin');
      break;
    case 'editor':
      res.redirect('/editor');
      break;
    case 'aluno':
      res.redirect('/reporter');
      break;
    case 'ti':
      res.redirect('/ti');
      break;
    default:
      res.redirect('/login');
  }
});

// Painel do Diretor (Admin)
app.get('/admin', requireRole(['diretor']), (req, res) => {
  try {
    const db = getDatabase();

    // Buscar notícias
    db.all(`
      SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id 
      ORDER BY n.data_criacao DESC 
      LIMIT 20
    `, (err, noticias) => {
      if (err) {
        console.error('Erro ao buscar notícias:', err);
        return res.render('admin', { 
          noticias: [], 
          usuarios: [],
          estatisticas: { publicadas: 0, aguardando: 0, rascunhos: 0 },
          user: req.session.user 
        });
      }

      // Buscar usuários
      db.all('SELECT id, nome, email, tipo, ativo FROM usuarios ORDER BY nome', (err, usuarios) => {
        if (err) {
          console.error('Erro ao buscar usuários:', err);
          return res.render('admin', { 
            noticias: noticias || [], 
            usuarios: [],
            estatisticas: { publicadas: 0, aguardando: 0, rascunhos: 0 },
            user: req.session.user 
          });
        }

        // Buscar estatísticas
        db.get(`
          SELECT 
            COUNT(CASE WHEN status = 'publicada' THEN 1 END) as publicadas,
            COUNT(CASE WHEN status = 'aguardando_revisao' THEN 1 END) as aguardando,
            COUNT(CASE WHEN status = 'rascunho' THEN 1 END) as rascunhos
          FROM noticias
        `, (err, estatisticas) => {
          if (err) {
            console.error('Erro ao buscar estatísticas:', err);
            estatisticas = { publicadas: 0, aguardando: 0, rascunhos: 0 };
          }

          res.render('admin', { 
            noticias: noticias || [],
            usuarios: usuarios || [],
            estatisticas: estatisticas || { publicadas: 0, aguardando: 0, rascunhos: 0 },
            user: req.session.user 
          });
        });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar painel admin:', error);
    res.render('admin', { 
      noticias: [], 
      usuarios: [],
      estatisticas: { publicadas: 0, aguardando: 0, rascunhos: 0 },
      user: req.session.user 
    });
  }
});

// Painel do Editor
app.get('/editor', requireRole(['editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();

    // Buscar notícias para revisão
    db.all(`
      SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id 
      WHERE n.status = 'aguardando_revisao'
      ORDER BY n.data_criacao ASC
    `, (err, noticiasParaRevisao) => {
      if (err) {
        console.error('Erro ao buscar notícias para revisão:', err);
        return res.render('editor', { 
          noticiasParaRevisao: [],
          todasNoticias: [],
          user: req.session.user 
        });
      }

      // Buscar todas as notícias
      db.all(`
        SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
        FROM noticias n 
        LEFT JOIN usuarios u ON n.autor_id = u.id 
        ORDER BY n.data_criacao DESC 
        LIMIT 50
      `, (err, todasNoticias) => {
        if (err) {
          console.error('Erro ao buscar todas as notícias:', err);
          return res.render('editor', { 
            noticiasParaRevisao: noticiasParaRevisao || [],
            todasNoticias: [],
            user: req.session.user 
          });
        }

        res.render('editor', { 
          noticiasParaRevisao: noticiasParaRevisao || [],
          todasNoticias: todasNoticias || [],
          user: req.session.user 
        });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar painel editor:', error);
    res.render('editor', { 
      noticiasParaRevisao: [],
      todasNoticias: [],
      user: req.session.user 
    });
  }
});

// Painel do Aluno Reporter
app.get('/reporter', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();

    // Alunos só veem suas próprias notícias
    const autorId = req.session.user.tipo === 'aluno' ? req.session.user.id : null;
    let query = `
      SELECT n.*, u.nome as autor_nome, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id
    `;
    let params = [];

    if (autorId) {
      query += ' WHERE n.autor_id = ?';
      params = [autorId];
    }

    query += ' ORDER BY n.data_criacao DESC';

    console.log('🔍 Executando query SQLite:', query);
    console.log('📋 Parâmetros:', params);

    db.all(query, params, (err, noticias) => {
      if (err) {
        console.error('❌ Erro ao buscar notícias do reporter:', err);
        return res.render('reporter', { 
          noticias: [],
          user: req.session.user 
        });
      }

      console.log('✅ Query executada com sucesso, linhas:', noticias ? noticias.length : 0);
      res.render('reporter', { 
        noticias: noticias || [],
        user: req.session.user 
      });
    });
  } catch (error) {
    console.error('Erro ao carregar painel reporter:', error);
    res.render('reporter', { 
      noticias: [],
      user: req.session.user 
    });
  }
});

// Painel de TI
app.get('/ti', requireRole(['ti', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();

    // Buscar usuários
    db.all('SELECT id, nome, email, tipo, COALESCE(ativo, \'false\') as ativo, ano, turma FROM usuarios ORDER BY nome', (err, usuarios) => {
      if (err) {
        console.error('Erro ao buscar usuários:', err);
        return res.render('ti', { 
          usuarios: [],
          estatisticas: { total_noticias: 0, publicadas: 0 },
          user: req.session.user 
        });
      }

      // Buscar estatísticas
      db.get(`
        SELECT COUNT(*) as total_noticias,
               COUNT(CASE WHEN status = 'publicada' THEN 1 END) as publicadas
        FROM noticias
      `, (err, estatisticas) => {
        if (err) {
          console.error('Erro ao buscar estatísticas:', err);
          estatisticas = { total_noticias: 0, publicadas: 0 };
        }

        res.render('ti', { 
          usuarios: usuarios || [],
          estatisticas: estatisticas || { total_noticias: 0, publicadas: 0 },
          user: req.session.user 
        });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar painel TI:', error);
    res.render('ti', { 
      usuarios: [],
      estatisticas: { total_noticias: 0, publicadas: 0 },
      user: req.session.user 
    });
  }
});

// Rota para criar nova notícia (admin)
app.get('/admin/nova', requireRole(['diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', (err, categorias) => {
      if (err) {
        console.error('Erro ao carregar categorias:', err);
        categorias = [];
      }

      res.render('nova', { 
        error: null, 
        user: req.session.user,
        categorias: categorias ? categorias.map(row => row.categoria) : [],
        noticia: null
      });
    });
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    res.render('nova', { 
      error: null, 
      user: req.session.user,
      categorias: [],
      noticia: null
    });
  }
});

// Rota para criar nova notícia
app.get('/criar-noticia', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', (err, categorias) => {
      if (err) {
        console.error('Erro ao carregar categorias:', err);
        categorias = [];
      }

      res.render('nova', { 
        error: null, 
        user: req.session.user,
        categorias: categorias ? categorias.map(row => row.categoria) : [],
        noticia: null
      });
    });
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    res.render('nova', { 
      error: null, 
      user: req.session.user,
      categorias: [],
      noticia: null
    });
  }
});

// Rota para salvar nova notícia (admin)
app.post('/admin/nova', requireRole(['diretor']), async (req, res) => {
  try {
    const { titulo, conteudo, categoria, imagem_url, acao } = req.body;

    if (!titulo || !conteudo || !categoria) {
      const db = getDatabase();
      const categoriasResult = await db.query('SELECT DISTINCT categoria FROM noticias ORDER BY categoria');
      const categorias = categoriasResult.rows.map(row => row.categoria);

      return res.render('nova', { 
        error: 'Título, conteúdo e categoria são obrigatórios', 
        user: req.session.user,
        categorias: categorias,
        noticia: { titulo, conteudo, categoria, imagem_url }
      });
    }

    // Admin pode publicar diretamente
    let status = 'publicada';

    // Gerar slug único
    let baseSlug = generateSlug(titulo);
    let slug = baseSlug;
    let counter = 1;

    const db = getDatabase();

    function checkSlugAndInsert() {
      db.get('SELECT id FROM noticias WHERE slug = ?', [slug], (err, existingSlug) => {
        if (err) {
          console.error('Erro ao verificar slug:', err);
          return res.render('nova', { 
            error: 'Erro ao salvar notícia', 
            user: req.session.user,
            categorias: [],
            noticia: req.body
          });
        }

        if (existingSlug) {
          slug = `${baseSlug}-${counter}`;
          counter++;
          checkSlugAndInsert();
        } else {
          db.run(
            'INSERT INTO noticias (titulo, slug, conteudo, categoria, imagem_url, status, autor_id, data_publicacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [titulo, slug, conteudo, categoria, imagem_url || null, status, req.session.user.id, status === 'publicada' ? new Date().toISOString() : null],
            function(err) {
              if (err) {
                console.error('Erro ao inserir notícia:', err);
                return res.render('nova', { 
                  error: 'Erro ao salvar notícia', 
                  user: req.session.user,
                  categorias: [],
                  noticia: req.body
                });
              }
              res.redirect('/admin');
            }
          );
        }
      });
    }

    checkSlugAndInsert();

    res.redirect('/admin');
  } catch (error) {
    console.error('Erro ao salvar notícia:', error);
    res.render('nova', { 
      error: 'Erro ao salvar notícia', 
      user: req.session.user,
      categorias: [],
      noticia: req.body
    });
  }
});

// Rota para salvar nova notícia
app.post('/criar-noticia', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const { titulo, conteudo, categoria, imagem_url, acao } = req.body;

    if (!titulo || !conteudo || !categoria) {
      const db = getDatabase();
      db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', [], (err, categoriasResult) => {
        if (err) {
          console.error('Erro ao carregar categorias:', err);
          categoriasResult = [];
        }

        const categorias = categoriasResult.map(row => row.categoria);

        return res.render('nova', { 
          error: 'Título, conteúdo e categoria são obrigatórios', 
          user: req.session.user,
          categorias: categorias,
          noticia: { titulo, conteudo, categoria, imagem_url }
        });
      });
      return;
    }

    // Determinar status baseado na ação e tipo de usuário
    let status = 'rascunho';

    // Alunos (repórteres) SEMPRE enviam para revisão, nunca publicam diretamente
    if (req.session.user.tipo === 'aluno') {
      status = 'aguardando_revisao';
    } 
    // Apenas editores e diretores podem publicar diretamente
    else if (acao === 'publicar' && ['editor', 'diretor'].includes(req.session.user.tipo)) {
      status = 'publicada';
    }
    // Editores e diretores podem salvar como rascunho se quiserem
    else if (acao === 'salvar_rascunho' && ['editor', 'diretor'].includes(req.session.user.tipo)) {
      status = 'rascunho';
    }

    // Gerar slug único
    let baseSlug = generateSlug(titulo);
    let slug = baseSlug;
    let counter = 1;

    const db = getDatabase();

    function checkSlugAndInsert() {
      db.get('SELECT id FROM noticias WHERE slug = ?', [slug], (err, existingSlug) => {
        if (err) {
          console.error('Erro ao verificar slug:', err);
          return res.render('nova', { 
            error: 'Erro ao salvar notícia', 
            user: req.session.user,
            categorias: [],
            noticia: req.body
          });
        }

        if (existingSlug) {
          slug = `${baseSlug}-${counter}`;
          counter++;
          checkSlugAndInsert();
        } else {
          db.run(
            'INSERT INTO noticias (titulo, slug, conteudo, categoria, imagem_url, status, autor_id, data_publicacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [titulo, slug, conteudo, categoria, imagem_url || null, status, req.session.user.id, status === 'publicada' ? new Date().toISOString() : null],
            function(err) {
              if (err) {
                console.error('Erro ao inserir notícia:', err);
                return res.render('nova', { 
                  error: 'Erro ao salvar notícia', 
                  user: req.session.user,
                  categorias: [],
                  noticia: req.body
                });
              }
              res.redirect('/dashboard');
            }
          );
        }
      });
    }

    checkSlugAndInsert();
  } catch (error) {
    console.error('Erro ao salvar notícia:', error);
    res.render('nova', { 
      error: 'Erro ao salvar notícia', 
      user: req.session.user,
      categorias: [],
      noticia: req.body
    });
  }
});

// Rota para revisar notícia (editor)
app.get('/revisar/:id', requireRole(['editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.get(`
      SELECT n.*, u.nome as autor_nome, u.email as autor_email, u.tipo as autor_tipo, u.ano as autor_serie, u.turma as autor_turma
      FROM noticias n 
      LEFT JOIN usuarios u ON n.autor_id = u.id 
      WHERE n.id = ?
    `, [req.params.id], (err, noticia) => {
      if (err) {
        console.error('Erro ao carregar notícia para revisão:', err);
        return res.redirect('/editor');
      }

      if (!noticia) {
        return res.redirect('/editor');
      }

      res.render('revisar', { 
        noticia, 
        error: null, 
        user: req.session.user 
      });
    });
  } catch (error) {
    console.error('Erro ao carregar notícia para revisão:', error);
    res.redirect('/editor');
  }
});

// Rota para processar revisão
app.post('/revisar/:id', requireRole(['editor', 'diretor']), (req, res) => {
  try {
    const { acao, observacoes } = req.body;
    const id = req.params.id;

    let status;
    let dataPublicacao = null;

    switch (acao) {
      case 'aprovar':
        status = 'aprovada';
        break;
      case 'publicar':
        status = 'publicada';
        dataPublicacao = new Date().toISOString();
        break;
      case 'recusar':
        status = 'recusada';
        break;
      default:
        return res.redirect('/editor');
    }

    const db = getDatabase();
    db.run(
      'UPDATE noticias SET status = ?, observacoes = ?, revisor_id = ?, data_publicacao = ? WHERE id = ?', 
      [status, observacoes || null, req.session.user.id, dataPublicacao, id],
      (err) => {
        if (err) {
          console.error('Erro ao processar revisão:', err);
        } else {
          // Invalidar cache quando notícia é publicada
          if (status === 'publicada') {
            invalidateCache('noticias');
          }
        }
        res.redirect('/editor');
      }
    );
  } catch (error) {
    console.error('Erro ao processar revisão:', error);
    res.redirect('/editor');
  }
});

// Rota para editar notícia
app.get('/editar/:id', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.get('SELECT * FROM noticias WHERE id = ?', [req.params.id], (err, noticia) => {
      if (err) {
        console.error('Erro ao carregar notícia para edição:', err);
        return res.redirect('/dashboard');
      }

      if (!noticia) {
        return res.redirect('/dashboard');
      }

      // Alunos só podem editar suas próprias notícias
      if (req.session.user.tipo === 'aluno' && noticia.autor_id !== req.session.user.id) {
        return res.status(403).render('error', { 
          message: 'Você só pode editar suas próprias notícias',
          user: req.session.user
        });
      }

      db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', [], (err, categoriasResult) => {
        if (err) {
          console.error('Erro ao carregar categorias:', err);
          categoriasResult = [];
        }

        const categorias = categoriasResult.map(row => row.categoria);

        res.render('editar', { 
          noticia, 
          categorias,
          error: null, 
          user: req.session.user 
        });
      });
    });
  } catch (error) {
    console.error('Erro ao carregar notícia para edição:', error);
    res.redirect('/dashboard');
  }
});

// Rota para salvar edição de notícia
app.post('/editar/:id', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const { titulo, conteudo, categoria, imagem_url, acao } = req.body;
    const id = req.params.id;

    const db = getDatabase();
    db.get('SELECT * FROM noticias WHERE id = ?', [id], (err, noticia) => {
      if (err) {
        console.error('Erro ao carregar notícia atual:', err);
        return res.redirect('/dashboard');
      }

      if (!noticia) {
        return res.redirect('/dashboard');
      }

      // Alunos só podem editar suas próprias notícias
      if (req.session.user.tipo === 'aluno' && noticia.autor_id !== req.session.user.id) {
        return res.status(403).render('error', { 
          message: 'Você só pode editar suas próprias notícias',
          user: req.session.user
        });
      }

      if (!titulo || !conteudo || !categoria) {
        db.all('SELECT DISTINCT categoria FROM noticias ORDER BY categoria', [], (err, categoriasResult) => {
          if (err) {
            console.error('Erro ao carregar categorias:', err);
            categoriasResult = [];
          }

          const categorias = categoriasResult.map(row => row.categoria);

          return res.render('editar', { 
            noticia: { ...noticia, titulo, conteudo, categoria, imagem_url },
            categorias,
            error: 'Título, conteúdo e categoria são obrigatórios', 
            user: req.session.user
          });
        });
        return;
      }

      // Determinar status baseado na ação e tipo de usuário
      let status = noticia.status;
      let dataPublicacao = noticia.data_publicacao;

      // Para alunos, sempre reenviar para revisão quando salvam alterações
      if (req.session.user.tipo === 'aluno') {
        if (acao === 'enviar_revisao' || acao === 'salvar') {
          status = 'aguardando_revisao';
        }
      } else if (acao === 'publicar' && ['editor', 'diretor'].includes(req.session.user.tipo)) {
        status = 'publicada';
        dataPublicacao = new Date().toISOString();
      }

      // Atualizar slug se o título mudou
      let slug = noticia.slug;
      if (titulo !== noticia.titulo) {
        let baseSlug = generateSlug(titulo);
        slug = baseSlug;
        let counter = 1;

        const checkSlugAndUpdate = () => {
          db.get('SELECT id FROM noticias WHERE slug = ? AND id != ?', [slug, id], (err, existingSlug) => {
            if (err) {
              console.error('Erro ao verificar slug:', err);
              return res.redirect('/dashboard');
            }

            if (existingSlug) {
              slug = `${baseSlug}-${counter}`;
              counter++;
              checkSlugAndUpdate();
            } else {
              // Atualizar notícia
              db.run(
                'UPDATE noticias SET titulo = ?, slug = ?, conteudo = ?, categoria = ?, imagem_url = ?, status = ?, data_publicacao = ? WHERE id = ?', 
                [titulo, slug, conteudo, categoria, imagem_url || null, status, dataPublicacao, id],
                (err) => {
                  if (err) {
                    console.error('Erro ao atualizar notícia:', err);
                  }
                  res.redirect('/dashboard');
                }
              );
            }
          });
        };

        checkSlugAndUpdate();
      } else {
        // Atualizar notícia sem mudança de slug
        db.run(
          'UPDATE noticias SET titulo = ?, conteudo = ?, categoria = ?, imagem_url = ?, status = ?, data_publicacao = ? WHERE id = ?', 
          [titulo, conteudo, categoria, imagem_url || null, status, dataPublicacao, id],
          (err) => {
            if (err) {
              console.error('Erro ao atualizar notícia:', err);
            }
            res.redirect('/dashboard');
          }
        );
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    res.redirect('/dashboard');
  }
});

// Rota para excluir notícia (apenas diretor)
app.post('/excluir/:id', requireRole(['diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.run('DELETE FROM noticias WHERE id = ?', [req.params.id], (err) => {
      if (err) {
        console.error('Erro ao excluir notícia:', err);
      }
      res.redirect('/admin');
    });
  } catch (error) {
    console.error('Erro ao excluir notícia:', error);
    res.redirect('/admin');
  }
});

// Rota para excluir notícia (usuários comuns - suas próprias notícias)
app.post('/excluir-noticia/:id', requireRole(['aluno', 'editor', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();
    const id = req.params.id;

    // Verificar se a notícia existe e se o usuário tem permissão
    db.get('SELECT * FROM noticias WHERE id = ?', [id], (err, noticia) => {
      if (err) {
        console.error('Erro ao buscar notícia:', err);
        return res.redirect('/dashboard');
      }

      if (!noticia) {
        return res.redirect('/dashboard');
      }

      // Alunos só podem excluir suas próprias notícias
      if (req.session.user.tipo === 'aluno' && noticia.autor_id !== req.session.user.id) {
        return res.status(403).render('error', { 
          message: 'Você só pode excluir suas próprias notícias',
          user: req.session.user
        });
      }

      db.run('DELETE FROM noticias WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('Erro ao excluir notícia:', err);
        }
        res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('Erro ao excluir notícia:', error);
    res.redirect('/dashboard');
  }
});

// Rota para gerenciar usuários (TI e Diretor)
app.get('/usuarios', requireRole(['ti', 'diretor']), (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT id, nome, email, tipo, ativo, ano, turma FROM usuarios ORDER BY nome', [], (err, usuarios) => {
      if (err) {
        console.error('Erro ao carregar usuários:', err);
        return res.render('usuarios', { 
          usuarios: [],
          user: req.session.user,
          error: 'Erro ao carregar usuários'
        });
      }

      res.render('usuarios', { 
        usuarios: usuarios || [],
        user: req.session.user,
        error: null
      });
    });
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    res.render('usuarios', { 
      usuarios: [],
      user: req.session.user,
      error: 'Erro ao carregar usuários'
    });
  }
});

// Rota para criar usuário
app.post('/usuarios', requireRole(['ti', 'diretor']), async (req, res) => {
  try {
    const { nome, email, tipo, turma, ano } = req.body;

    // Validação básica (sem senha, pois será gerada automaticamente)
    if (!nome || !email || !tipo) {
      const db = getDatabase();
      const usuariosResult = await db.query('SELECT id, nome, email, tipo, ativo, ano, turma FROM usuarios ORDER BY nome');

      return res.render('usuarios', { 
        usuarios: usuariosResult.rows,
        user: req.session.user,
        error: 'Nome, email e tipo são obrigatórios'
      });
    }

    // Validação de email
    if (!isValidEmail(email)) {
      const db = getDatabase();
      const usuariosResult = await db.query('SELECT id, nome, email, tipo, ativo, ano, turma FROM usuarios ORDER BY nome');

      return res.render('usuarios', { 
        usuarios: usuariosResult.rows,
        user: req.session.user,
        error: 'Email inválido'
      });
    }

    // Verificar se email já existe
    const db = getDatabase();
    const emailExistsResult = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    
    if (emailExistsResult.rows.length > 0) {
      const usuariosResult = await db.query('SELECT id, nome, email, tipo, ativo, ano, turma FROM usuarios ORDER BY nome');
      
      return res.render('usuarios', { 
        usuarios: usuariosResult.rows,
        user: req.session.user,
        error: 'Email já está em uso'
      });
    }

    // Gerar senha temporária
    const senhaTemporaria = Math.random().toString(36).slice(-8);
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

    // Inserir usuário
    await db.query(`
      INSERT INTO usuarios (nome, email, senha_hash, tipo, ano, turma, ativo) 
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [nome, email, senhaHash, tipo, ano || null, turma || null]);

    // Redirecionar com sucesso
    res.redirect('/usuarios?success=Usuário criado com sucesso');

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    const db = getDatabase();
    const usuariosResult = await db.query('SELECT id, nome, email, tipo, ativo, ano, turma FROM usuarios ORDER BY nome');
    
    res.render('usuarios', { 
      usuarios: usuariosResult.rows,
      user: req.session.user,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota para gerenciar fila de homenagens (apenas para editores)
app.get('/homenagens/fila', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor' && user.tipo !== 'diretor') {
    return res.status(403).render('error', { 
      message: 'Acesso negado. Apenas editores podem gerenciar a fila de homenagens.',
      user
    });
  }

  try {
    const db = getDatabase();

    // Buscar homenagens aprovadas (na fila)
    db.all(`
      SELECT h.*, u.nome as autor_nome,
             CASE 
               WHEN h.publicada = 1 THEN 'Publicada'
               WHEN h.data_agendada IS NOT NULL THEN 'Agendada'
               ELSE 'Na fila'
             END as status_publicacao
      FROM homenagens h
      LEFT JOIN usuarios u ON h.autor_id = u.id
      WHERE h.status = 'aprovada'
      ORDER BY h.ordem_publicacao ASC
    `, (err, filaHomenagens) => {
      if (err) {
        console.error('Erro ao carregar fila de homenagens:', err);
        return res.render('homenagens-fila', { 
          user, 
          filaHomenagens: [], 
          error: 'Erro ao carregar fila de homenagens' 
        });
      }

      res.render('homenagens-fila', { 
        user, 
        filaHomenagens: filaHomenagens || []
      });
    });
  } catch (error) {
    console.error('Erro ao carregar fila:', error);
    res.render('homenagens-fila', { 
      user, 
      filaHomenagens: [], 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para reordenar fila de homenagens
app.post('/homenagens/reordenar', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const user = req.session.user;
  if (user.tipo !== 'editor' && user.tipo !== 'diretor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const { novaOrdem } = req.body; // Array com IDs na nova ordem

    if (!Array.isArray(novaOrdem)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const db = getDatabase();

    // Atualizar ordem de cada homenagem
    const updatePromises = novaOrdem.map((homenagemId, index) => {
      return new Promise((resolve, reject) => {
        db.run(`
          UPDATE homenagens 
          SET ordem_publicacao = ? 
          WHERE id = ? AND status = 'aprovada'
        `, [index + 1, homenagemId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    Promise.all(updatePromises)
      .then(() => {
        // Reagendar todas as homenagens com a nova ordem
        db.run(`
          UPDATE homenagens 
          SET data_agendada = NULL 
          WHERE status = 'aprovada' AND publicada = 0
        `, (err) => {
          if (err) {
            console.error('Erro ao limpar agendamentos:', err);
            return res.status(500).json({ error: 'Erro ao reagendar' });
          }

          agendarProximasHomenagens();
          res.json({ success: true, message: 'Ordem atualizada e reagendamento realizado' });
        });
      })
      .catch(err => {
        console.error('Erro ao reordenar:', err);
        res.status(500).json({ error: 'Erro ao reordenar fila' });
      });
  } catch (error) {
    console.error('Erro ao processar reordenação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para publicar homenagem imediatamente
app.post('/homenagens/publicar-agora/:id', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor' && user.tipo !== 'diretor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const homenagemId = req.params.id;
    const db = getDatabase();

    db.run(`
      UPDATE homenagens 
      SET publicada = 1, data_agendada = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'aprovada'
    `, [homenagemId], (err) => {
      if (err) {
        console.error('Erro ao publicar homenagem:', err);
        return res.redirect('/homenagens/fila?error=Erro ao publicar homenagem');
      }

      res.redirect('/homenagens/fila?success=Homenagem publicada imediatamente');
    });
  } catch (error) {
    console.error('Erro ao publicar homenagem:', error);
    res.redirect('/homenagens/fila?error=Erro interno do servidor');
  }
});

// Rota para exibir formulário de edição de usuário
app.get('/usuarios/editar/:id', requireRole(['ti', 'diretor']), async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
    const usuario = result.rows[0];

    if (!usuario) {
      return res.redirect('/usuarios?error=Usuário não encontrado');
    }

    res.render('editar-usuario', { 
      usuario, 
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.redirect('/usuarios?error=Erro ao buscar usuário');
  }
});

// Rota para editar usuário
app.post('/usuarios/:id/edit', requireRole(['ti', 'diretor']), async (req, res) => {
  try {
    const { nome, email, senha, tipo, turma, ano } = req.body;
    const userId = req.params.id;

    if (!nome || !email || !tipo) {
      return res.redirect('/usuarios?error=Campos obrigatórios não preenchidos');
    }

    const db = getDatabase();

    // Verificar se email já existe para outro usuário
    const emailExists = await db.query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [email, userId]);
    if (emailExists.rows.length > 0) {
      return res.redirect('/usuarios?error=Email já está em uso por outro usuário');
    }

    // Se senha foi fornecida, criptografar
    if (senha && senha.trim() !== '') {
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.query(
        'UPDATE usuarios SET nome = $1, email = $2, senha_hash = $3, tipo = $4, turma = $5, ano = $6 WHERE id = $7',
        [nome, email, senhaHash, tipo, turma || null, ano || null, userId]
      );
    } else {
      await db.query(
        'UPDATE usuarios SET nome = $1, email = $2, tipo = $3, turma = $4, ano = $5 WHERE id = $6',
        [nome, email, tipo, turma || null, ano || null, userId]
      );
    }

    res.redirect('/usuarios');
  } catch (error) {
    console.error('Erro ao editar usuário:', error);
    res.redirect('/usuarios?error=Erro ao salvar alterações');
  }
});

// Rota para alternar status de usuário
app.post('/usuarios/:id/toggle', requireRole(['ti', 'diretor']), async (req, res) => {
  try {
    const { ativo } = req.body;
    const userId = req.params.id;

    console.log('🔄 Alterando status do usuário:', userId, 'para:', ativo);
    console.log('📋 Dados recebidos no body:', req.body);
    console.log('🔍 Tipo do valor ativo:', typeof ativo);
    console.log('🔍 Valor exato do ativo:', JSON.stringify(ativo));
    console.log('🔍 Comparação com true:', ativo === 'true');
    console.log('🔍 Comparação com false:', ativo === 'false');

    // Validar se o valor do ativo é válido
    if (ativo !== 'true' && ativo !== 'false') {
      console.log('❌ Valor inválido para ativo:', ativo);
      console.log('❌ Possíveis valores recebidos:', Object.keys(req.body));
      return res.redirect('/ti?error=Valor inválido para status do usuário');
    }

    const db = getDatabase();

    // Verificar se o usuário existe
    const usuario = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM usuarios WHERE id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!usuario) {
      console.log('❌ Usuário não encontrado:', userId);
      return res.redirect('/ti?error=Usuário não encontrado');
    }

    console.log('👤 Usuário encontrado:', usuario.nome);

    // Se o campo ativo é null, definir como 'false' primeiro
    if (usuario.ativo === null) {
      console.log('🔧 Corrigindo campo ativo null para false');
      await new Promise((resolve, reject) => {
        db.run("UPDATE usuarios SET ativo = ? WHERE id = ?", ['false', userId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Atualizar status
    await new Promise((resolve, reject) => {
      db.run("UPDATE usuarios SET ativo = ? WHERE id = ?", [ativo, userId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ Status atualizado para:', ativo);

    // Verificar se foi atualizado
    const verificacao = await new Promise((resolve, reject) => {
      db.get("SELECT ativo FROM usuarios WHERE id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const novoStatus = verificacao.ativo;
    console.log('✔️ Verificação - novo status:', novoStatus);

    // Verificar se a atualização foi bem-sucedida
    if (novoStatus === ativo) {
      console.log('✅ Atualização confirmada no banco de dados');
      const action = ativo === 'true' ? 'ativado' : 'desativado';
      res.redirect(`/ti?success=Usuário ${action} com sucesso!`);
    } else {
      console.log('❌ Falha na atualização do banco de dados');
      res.redirect('/ti?error=Falha ao atualizar status do usuário');
    }
  } catch (error) {
    console.error('❌ Erro ao alterar status do usuário:', error);
    console.error('Stack:', error.stack);
    res.redirect('/ti?error=Erro interno do servidor');
  }
});

// Rota para editar notícia no admin
app.get('/admin/editar/:id', requireRole(['diretor']), async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM noticias WHERE id = $1', [req.params.id]);
    const noticia = result.rows[0];

    if (!noticia) {
      return res.redirect('/admin');
    }

    const categoriasResult = await db.query('SELECT DISTINCT categoria FROM noticias ORDER BY categoria');
    const categorias = categoriasResult.rows.map(row => row.categoria);

    res.render('editar', { 
      noticia, 
      categorias,
      error: null, 
      user: req.session.user 
    });
  } catch (error) {
    console.error('Erro ao carregar notícia para edição:', error);
    res.redirect('/admin');
  }
});

// Rota para salvar edição de notícia no admin
app.post('/admin/editar/:id', requireRole(['diretor']), async (req, res) => {
  try {
    const { titulo, conteudo, categoria, imagem_url } = req.body;
    const id = req.params.id;

    if (!titulo || !conteudo || !categoria) {
      const db = getDatabase();
      const noticiaResult = await db.query('SELECT * FROM noticias WHERE id = $1', [id]);
      const categoriasResult = await db.query('SELECT DISTINCT categoria FROM noticias ORDER BY categoria');

      return res.render('editar', { 
        noticia: { ...noticiaResult.rows[0], titulo, conteudo, categoria, imagem_url },
        categorias: categoriasResult.rows.map(row => row.categoria),
        error: 'Título, conteúdo e categoria são obrigatórios', 
        user: req.session.user
      });
    }

    const db = getDatabase();
    const currentNoticia = await db.query('SELECT * FROM noticias WHERE id = $1', [id]);
    const noticia = currentNoticia.rows[0];

    // Atualizar slug se o título mudou
    let slug = noticia.slug;
    if (titulo !== noticia.titulo) {
      let baseSlug = generateSlug(titulo);
      slug = baseSlug;
      let counter = 1;

      while (true) {
        const existingSlug = await db.query('SELECT id FROM noticias WHERE slug = $1 AND id != $2', [slug, id]);
        if (existingSlug.rows.length === 0) {
          break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    await db.query(
      'UPDATE noticias SET titulo = $1, slug = $2, conteudo = $3, categoria = $4, imagem_url = $5 WHERE id = $6', 
      [titulo, slug, conteudo, categoria, imagem_url || null, id]
    );

    res.redirect('/admin');
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    res.redirect('/admin');
  }
});

// Função para gerar código de verificação
function generateVerificationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Rota para verificar código (DEVE VIR ANTES da rota genérica)
app.get('/redefinir-senha/verificar', (req, res) => {
  res.render('verificar-codigo', { 
    error: null, 
    user: null 
  });
});

// Rota para processar verificação de código (DEVE VIR ANTES da rota genérica)
app.post('/redefinir-senha/verificar', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.render('verificar-codigo', { 
        error: 'Código inválido', 
        user: null 
      });
    }

    const db = getDatabase();

    // Verificar código - adaptado para SQLite
    const resetData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT rc.*, u.nome, u.email 
        FROM reset_codes rc 
        JOIN usuarios u ON rc.user_id = u.id 
        WHERE rc.code = ? AND rc.used = 0 AND rc.expires_at > datetime('now', 'localtime')
      `, [code.toUpperCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!resetData) {
      return res.render('verificar-codigo', { 
        error: 'Código inválido ou expirado', 
        user: null 
      });
    }

    // Marcar código como usado - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE id = ?', [resetData.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Render página para nova senha
    res.render('nova-senha', { 
      error: null, 
      user: null, 
      userId: resetData.user_id,
      userName: resetData.nome
    });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    res.render('verificar-codigo', { 
      error: 'Erro interno do servidor', 
      user: null 
    });
  }
});

// Rota para redefinir senha com token direto (DEVE VIR ANTES da rota genérica)
app.get('/redefinir-senha/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Token recebido na URL:', token);

    const db = getDatabase();

    // Verificar token - adaptado para SQLite
    const resetData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT rc.*, u.nome, u.email 
        FROM reset_codes rc 
        JOIN usuarios u ON rc.user_id = u.id 
        WHERE rc.code = ? AND rc.used = 0 AND rc.expires_at > datetime('now', 'localtime')
      `, [token], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('🔍 Resultado da busca do token:', resetData ? 1 : 0);

    if (!resetData) {
      console.log('❌ Token inválido, expirado ou já usado:', token);
      return res.render('redefinir-senha', { 
        error: 'Link inválido ou expirado. Solicite um novo link de redefinição.', 
        success: null, 
        user: null, 
        step: 'email' 
      });
    }

    console.log('✅ Token válido para o usuário:', resetData.nome, '| Email:', resetData.email);

    res.render('nova-senha', { 
      error: null, 
      user: null, 
      userId: resetData.user_id,
      userName: resetData.nome,
      token: token
    });
  } catch (error) {
    console.error('🚨 Erro ao acessar token:', error);
    console.error('Stack:', error.stack);
    res.render('redefinir-senha', { 
      error: 'Erro interno do servidor. Tente novamente.', 
      success: null, 
      user: null, 
      step: 'email' 
    });
  }
});

// Rota para página de redefinição de senha (ROTA GENÉRICA - DEVE VIR DEPOIS)
app.get('/redefinir-senha', (req, res) => {
  res.render('redefinir-senha', { 
    error: null, 
    success: null, 
    user: null, 
    step: 'email' 
  });
});

// Rota para solicitar redefinição de senha
app.post('/redefinir-senha', rateLimits.passwordReset, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.render('redefinir-senha', { 
        error: 'Email inválido', 
        success: null, 
        user: null, 
        step: 'email' 
      });
    }

    const db = getDatabase();
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      // Não revelar se o email existe ou não por segurança
      return res.render('redefinir-senha', { 
        error: null, 
        success: 'Se o email existir em nosso sistema, você receberá instruções para redefinir sua senha.', 
        user: null, 
        step: 'email' 
      });
    }

    // Gerar código de verificação
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    const expiresAtISO = expiresAt.toISOString(); // Formato ISO para SQLite

    // Invalidar códigos anteriores - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE user_id = ? AND used = 0', [user.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Inserir novo código - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO reset_codes (user_id, code, expires_at) VALUES (?, ?, ?)',
        [user.id, code, expiresAtISO],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Enviar email com link direto para redefinição
    const emailSubject = '🔐 Link para redefinir sua senha - CMBM NEWS';
    const baseUrl = BASE_URL;
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">🔐 Redefinir Senha</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Redefina sua senha com segurança</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #001f3f;">
        <h3 style="color: #001f3f; margin: 0 0 15px 0; font-size: 18px;">👋 Olá, ${user.nome}!</h3>
        <p style="margin: 0 0 15px 0; color: #495057; line-height: 1.6;">
          Recebemos uma solicitação para redefinir a senha da sua conta no CMBM NEWS. Para sua segurança, criamos um link exclusivo para você.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 30px; border-radius: 15px; margin: 25px 0; text-align: center; box-shadow: 0 8px 16px rgba(0,31,63,0.3);">
        <h4 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 300;">🔑 Redefinir Senha</h4>
        <p style="margin: 0 0 25px 0; opacity: 0.9; line-height: 1.5;">
          Clique no botão abaixo para acessar o formulário de redefinição de senha. O link é válido por 15 minutos.
        </p>
        <a href="${baseUrl}/redefinir-senha/token/${code}" 
           style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: #001f3f; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); transition: all 0.3s;">
          🔓 Redefinir Minha Senha
        </a>
      </div>

      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #856404; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">📋</span> Como proceder:
        </h4>
        <ol style="margin: 0; color: #856404; padding-left: 20px;">
          <li style="margin-bottom: 8px;">🔗 Clique no link "Redefinir Minha Senha" acima</li>
          <li style="margin-bottom: 8px;">🔐 Digite sua nova senha</li>
          <li style="margin-bottom: 8px;">✅ Confirme a nova senha</li>
          <li style="margin-bottom: 0;">🎉 Sua senha será alterada imediatamente</li>
        </ol>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #721c24; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">🚨</span> Importante:
        </h4>
        <ul style="margin: 0; color: #721c24; padding-left: 20px;">
          <li style="margin-bottom: 8px;">⏰ Este link expira em 15 minutos</li>
          <li style="margin-bottom: 8px;">🔒 Use apenas uma vez</li>
          <li style="margin-bottom: 8px;">🚫 Não compartilhe este link</li>
          <li style="margin-bottom: 0;">❌ Se você não solicitou, ignore este email</li>
        </ul>
      </div>

      ${
        `<div style="text-align: center; margin-top: 30px;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            Caso tenha problemas com o link, você pode tentar novamente em:
          </p>
          <a href="${baseUrl}/redefinir-senha" style="color: #007bff; text-decoration: none; font-weight: bold; font-size: 16px;">
            🌐 ${baseUrl}/redefinir-senha
          </a>
        </div>`
      }
    `;

    const emailHtml = createEmailTemplate('Redefinição de Senha', content);

    await sendEmail(user.email, emailSubject, emailHtml);

    res.render('redefinir-senha', { 
      error: null, 
      success: 'Código de verificação enviado para seu email!', 
      user: null, 
      step: 'email' 
    });
  } catch (error) {
    console.error('Erro ao solicitar redefinição:', error);
    res.render('redefinir-senha', { 
      error: 'Erro interno do servidor', 
      success: null, 
      user: null, 
      step: 'email' 
    });
  }
});



// Rota para perfil do usuário
app.get('/perfil', requireAuth, (req, res) => {
  try {
    const db = getDatabase();
    console.log('🔍 Buscando perfil do usuário ID:', req.session.userId);

    db.get('SELECT id, nome, email, tipo, ano, turma, foto_perfil FROM usuarios WHERE id = ?', [req.session.userId], (err, usuario) => {
      if (err) {
        console.error('❌ Erro ao buscar usuário:', err);
        return res.render('perfil', { 
          user: req.session.user,
          error: 'Erro ao carregar perfil',
          success: null
        });
      }

      console.log('👤 Dados do usuário encontrado:', usuario);

      if (!usuario) {
        console.log('❌ Usuário não encontrado, redirecionando para login');
        return res.redirect('/login');
      }

      res.render('perfil', { 
        user: usuario,
        error: null,
        success: null
      });
    });
  } catch (error) {
    console.error('❌ Erro ao carregar perfil:', error);
    res.render('perfil', { 
      user: req.session.user,
      error: 'Erro ao carregar perfil',
      success: null
    });
  }
});

// Rota para página de verificação de código de senha
app.get('/perfil/verificar-codigo', requireAuth, (req, res) => {
  res.render('verificar-codigo-senha', { 
    user: req.session.user,
    error: null,
    success: null
  });
});

// Rota para alterar senha do perfil (solicitar código)
app.post('/perfil/alterar-senha', requireAuth, async (req, res) => {
  try {
    const { senhaAtual, novaSenha, confirmarSenha } = req.body;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      const db = getDatabase();
      const usuario = await new Promise((resolve, reject) => {
        db.get('SELECT id, nome, email, tipo, ano, turma FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return res.render('perfil', { 
        user: usuario,
        error: 'Todos os campos são obrigatórios',
        success: null
      });
    }

    if (novaSenha !== confirmarSenha) {
      const db = getDatabase();
      const usuario = await new Promise((resolve, reject) => {
        db.get('SELECT id, nome, email, tipo, ano, turma FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return res.render('perfil', { 
        user: usuario,
        error: 'As senhas não coincidem',
        success: null
      });
    }

    if (novaSenha.length < 6) {
      const db = getDatabase();
      const usuario = await new Promise((resolve, reject) => {
        db.get('SELECT id, nome, email, tipo, ano, turma FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return res.render('perfil', { 
        user: usuario,
        error: 'A nova senha deve ter pelo menos 6 caracteres',
        success: null
      });
    }

    const db = getDatabase();

    // Verificar senha atual
    const userAtual = await new Promise((resolve, reject) => {
      db.get('SELECT senha_hash, nome, email FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!userAtual) {
      return res.redirect('/login');
    }

    const senhaAtualValida = await bcrypt.compare(senhaAtual, userAtual.senha_hash);

    if (!senhaAtualValida) {
      const usuario = await new Promise((resolve, reject) => {
        db.get('SELECT id, nome, email, tipo, ano, turma FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return res.render('perfil', { 
        user: usuario,
        error: 'Senha atual incorreta',
        success: null
      });
    }

    // Gerar código de confirmação de 5 dígitos
    const confirmationCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    const expiresAtISO = expiresAt.toISOString(); // Formato ISO para SQLite

    // Salvar nova senha temporariamente com o código
    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    
    // Invalidar códigos anteriores - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE user_id = ? AND used = 0', [req.session.userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Inserir novo código com a nova senha - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO reset_codes (user_id, code, expires_at, observacoes) VALUES (?, ?, ?, ?)',
        [req.session.userId, confirmationCode, expiresAtISO, novaSenhaHash],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Enviar email com código
    const emailSubject = '🔐 Código de confirmação - Alteração de senha';
    const baseUrl = BASE_URL;
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">🔐 Alteração de Senha</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Confirme sua identidade para continuar</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #001f3f;">
        <h3 style="color: #001f3f; margin: 0 0 15px 0; font-size: 18px;">👋 Olá, ${userAtual.nome}!</h3>
        <p style="margin: 0 0 15px 0; color: #495057; line-height: 1.6;">
          Você solicitou a alteração de sua senha no CMBM NEWS. Para sua segurança, precisamos confirmar sua identidade.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 30px; border-radius: 15px; margin: 25px 0; text-align: center; box-shadow: 0 8px 16px rgba(0,31,63,0.3);">
        <h4 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 300;">🔑 Seu Código de Confirmação</h4>
        <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed rgba(255,255,255,0.3);">
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${confirmationCode}
          </div>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">
          ⏰ Este código expira em <strong>10 minutos</strong>
        </p>
      </div>

      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #856404; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">📋</span> Como proceder:
        </h4>
        <ol style="margin: 0; color: #856404; padding-left: 20px;">
          <li style="margin-bottom: 8px;">🔄 Volte para a página de perfil</li>
          <li style="margin-bottom: 8px;">⌨️ Digite o código de confirmação acima</li>
          <li style="margin-bottom: 8px;">✅ Confirme a alteração</li>
          <li style="margin-bottom: 0;">🎉 Sua senha será alterada com sucesso</li>
        </ol>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #721c24; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">🚨</span> Importante:
        </h4>
        <ul style="margin: 0; color: #721c24; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Este código é válido por apenas 10 minutos</li>
          <li style="margin-bottom: 8px;">Não compartilhe este código com ninguém</li>
          <li style="margin-bottom: 0;">Se você não solicitou esta alteração, ignore este email</li>
        </ul>
      </div>
    `;

    const emailHtml = createEmailTemplate('Código de Confirmação', content);
    await sendEmail(userAtual.email, emailSubject, emailHtml);

    res.render('verificar-codigo-senha', { 
      user: req.session.user,
      error: null,
      success: 'Código de confirmação enviado para seu email!'
    });
  } catch (error) {
    console.error('Erro ao solicitar alteração de senha:', error);
    const db = getDatabase();
    const result = await db.query('SELECT id, nome, email, tipo, ano, turma FROM usuarios WHERE id = $1', [req.session.userId]);
    const usuario = result.rows[0];

    res.render('perfil', { 
      user: usuario || req.session.user,
      error: 'Erro interno do servidor',
      success: null
    });
  }
});

// Rota para definir nova senha
app.post('/redefinir-senha/nova', async (req, res) => {
  try {
    const { senha, confirmarSenha, userId, token } = req.body;

    if (!senha || !confirmarSenha || !userId) {
      return res.render('nova-senha', { 
        error: 'Todos os campos são obrigatórios', 
        user: null, 
        userId, 
        userName: ''
      });
    }

    if (senha !== confirmarSenha) {
      return res.render('nova-senha', { 
        error: 'As senhas não coincidem', 
        user: null, 
        userId, 
        userName: ''
      });
    }

    if (senha.length < 6) {
      return res.render('nova-senha', { 
        error: 'A senha deve ter pelo menos 6 caracteres', 
        user: null, 
        userId, 
        userName: ''
      });
    }

    const db = getDatabase();
    const senhaHash = await bcrypt.hash(senha, 10);

    // Buscar dados do usuário
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT nome, email FROM usuarios WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.render('nova-senha', { 
        error: 'Usuário não encontrado', 
        user: null, 
        userId, 
        userName: ''
      });
    }

    // Validar token se fornecido - adaptado para SQLite
    if (token) {
      const tokenData = await new Promise((resolve, reject) => {
        db.get(`
          SELECT id FROM reset_codes 
          WHERE code = ? AND user_id = ? AND used = 0 AND expires_at > datetime('now', 'localtime')
        `, [token, userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!tokenData) {
        return res.render('nova-senha', { 
          error: 'Token inválido ou expirado', 
          user: null, 
          userId, 
          userName: '',
          token
        });
      }

      // Marcar token como usado - adaptado para SQLite
      await new Promise((resolve, reject) => {
        db.run('UPDATE reset_codes SET used = 1 WHERE code = ?', [token], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Atualizar senha - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [senhaHash, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Enviar email de confirmação
    const emailSubject = '🛡️ Senha alterada com sucesso - CMBM NEWS';
    const baseUrl = BASE_URL;
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">🛡️ Senha Alterada</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Sua senha foi alterada com sucesso</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #001f3f;">
        <h3 style="color: #001f3f; margin: 0 0 15px 0; font-size: 18px;">👋 Olá, ${user.nome}!</h3>
        <p style="margin: 0 0 15px 0; color: #495057; line-height: 1.6;">
          Informamos que a senha da sua conta no CMBM NEWS foi alterada com sucesso através do sistema de redefinição de senha.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border: 2px solid #28a745;">
        <div style="text-align: center;">
          <div style="background: #28a745; color: white; padding: 10px; border-radius: 50px; display: inline-block; margin-bottom: 15px;">
            <span style="font-size: 24px;">✅</span>
          </div>
          <h4 style="color: #155724; margin: 0 0 15px 0; font-size: 20px;">Alteração Confirmada</h4>
          <p style="margin: 0; color: #155724; font-size: 16px;">
            <strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/login" 
           style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,31,63,0.3);">
          🔑 Fazer Login Agora
        </a>
      </div>

      <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #856404; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">🔐</span> Próximos Passos:
        </h4>
        <ul style="margin: 0; color: #856404; padding-left: 20px;">
          <li style="margin-bottom: 8px;">✅ Sua nova senha já está ativa</li>
          <li style="margin-bottom: 8px;">🔑 Use a nova senha para fazer login</li>
          <li style="margin-bottom: 8px;">💡 Guarde-a em local seguro</li>
          <li style="margin-bottom: 0;">🚫 Não compartilhe com terceiros</li>
        </ul>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #721c24; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">🚨</span> Não foi você?
        </h4>
        <p style="margin: 0 0 15px 0; color: #721c24; line-height: 1.6;">
          Se você não solicitou esta alteração, sua conta pode estar comprometida. Clique no botão abaixo para iniciar uma nova redefinição de senha:
        </p>
        <div style="text-align: center;">
          <a href="${baseUrl}/redefinir-senha" 
             style="background: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 14px;">
            🔒 Recuperar Minha Conta
          </a>
        </div>
      </div>
    `;

    const emailHtml = createEmailTemplate('Senha Alterada com Sucesso', content);

    await sendEmail(user.email, emailSubject, emailHtml);

    res.render('login', { 
      error: null, 
      success: 'Senha alterada com sucesso! Faça login com sua nova senha.', 
      user: null 
    });
  } catch (error) {
    console.error('Erro ao definir nova senha:', error);
    res.render('nova-senha', { 
      error: 'Erro interno do servidor', 
      user: null, 
      userId: req.body.userId || '', 
      userName: ''
    });
  }
});

// Health check endpoint
app.get('/health', healthCheck);

// Middleware para capturar rotas não encontradas (404)
app.use(notFoundHandler);

// Middleware principal de tratamento de erros
app.use(errorHandler);

// Inicializar banco de dados e servidor
async function startServer() {
  try {
    await initializeDatabase();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor CMBM NEWS rodando na porta ${PORT}`);
      console.log(`Acesse: ${BASE_URL}`);
    });

    app.get('/debug', (req, res) => {
      res.send('Servidor rodando com sucesso');
    });

    // Rota para testar envio de email
    app.get('/test-email', async (req, res) => {
      try {
        const testEmail = 'deyvsonfteste@gmail.com';
        const subject = 'Teste de envio de email - CMBM NEWS';
        const content = `
          <div style="padding: 20px; text-align: center;">
            <h2>Teste de Funcionalidade</h2>
            <p>Se você recebeu este email, o sistema de envio está funcionando corretamente.</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Servidor:</strong> CMBM NEWS</p>
          </div>
        `;

        const emailHtml = createEmailTemplate('Teste de Email', content);
        const emailSent = await sendEmail(testEmail, subject, emailHtml);

        if (emailSent) {
          res.json({ 
            success: true, 
            message: 'Email de teste enviado com sucesso!',
            timestamp: new Date().toISOString()
          });
        } else {
          res.json({ 
            success: false, 
            message: 'Falha no envio do email de teste',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Erro no teste de email:', error);
        res.json({ 
          success: false, 
          message: 'Erro interno: ' + error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
    // Configurar timeout do servidor
    server.timeout = 0;

    // Tratamento de erros do servidor
    server.on('error', (error) => {
      console.error('Erro do servidor:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Porta ${PORT} já está em uso`);
        process.exit(1);
      }
    });

    // Manter o processo vivo
    process.on('SIGTERM', () => {
      console.log('Recebido SIGTERM. Finalizando servidor...');
      server.close(() => {
        console.log('Servidor finalizado');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('Recebido SIGINT. Finalizando servidor...');
      server.close(() => {
        console.log('Servidor finalizado');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Erro ao inicializar servidor:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Manter o processo vivo
setInterval(() => {
  // Heartbeat para manter o processo ativo
}, 30000);

startServer();

// Rota para redefinir senha com token direto (DEVE VIR ANTES da rota genérica)
app.get('/redefinir-senha/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Token recebido na URL:', token);

    const db = getDatabase();

    // Verificar token - adaptado para SQLite
    const resetData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT rc.*, u.nome, u.email 
        FROM reset_codes rc 
        JOIN usuarios u ON rc.user_id = u.id 
        WHERE rc.code = ? AND rc.used = 0 AND rc.expires_at > datetime('now', 'localtime')
      `, [token], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('🔍 Resultado da busca do token:', resetData ? 1 : 0);

    if (!resetData) {
      console.log('❌ Token inválido, expirado ou já usado:', token);
      return res.render('redefinir-senha', { 
        error: 'Link inválido ou expirado. Solicite um novo link de redefinição.', 
        success: null, 
        user: null, 
        step: 'email' 
      });
    }

    console.log('✅ Token válido para o usuário:', resetData.nome, '| Email:', resetData.email);

    res.render('nova-senha', { 
      error: null, 
      user: null, 
      userId: resetData.user_id,
      userName: resetData.nome,
      token: token
    });
  } catch (error) {
    console.error('🚨 Erro ao acessar token:', error);
    console.error('Stack:', error.stack);
    res.render('redefinir-senha', { 
      error: 'Erro interno do servidor. Tente novamente.', 
      success: null, 
      user: null, 
      step: 'email' 
    });
  }
});

// Rota para verificar código (DEVE VIR ANTES da rota genérica)
app.get('/redefinir-senha/verificar', (req, res) => {
  res.render('verificar-codigo', { 
    error: null, 
    user: null 
  });
});

// Rota para processar verificação de código (DEVE VIR ANTES da rota genérica)
app.post('/redefinir-senha/verificar', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.render('verificar-codigo', { 
        error: 'Código inválido', 
        user: null 
      });
    }

    const db = getDatabase();

    // Verificar código - adaptado para SQLite
    const resetData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT rc.*, u.nome, u.email 
        FROM reset_codes rc 
        JOIN usuarios u ON rc.user_id = u.id 
        WHERE rc.code = ? AND rc.used = 0 AND rc.expires_at > datetime('now', 'localtime')
      `, [code.toUpperCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!resetData) {
      return res.render('verificar-codigo', { 
        error: 'Código inválido ou expirado', 
        user: null 
      });
    }

    // Marcar código como usado - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE id = ?', [resetData.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Render página para nova senha
    res.render('nova-senha', { 
      error: null, 
      user: null, 
      userId: resetData.user_id,
      userName: resetData.nome
    });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    res.render('verificar-codigo', { 
      error: 'Erro interno do servidor', 
      user: null 
    });
  }
});

// Rota para ativação de conta com token
app.get('/ativar-conta/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Token de ativação recebido:', token);

    const db = getDatabase();

    // Verificar token de ativação - adaptado para SQLite
    const activationData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT rc.*, u.nome, u.email 
        FROM reset_codes rc 
        JOIN usuarios u ON rc.user_id = u.id 
        WHERE rc.code = ? AND rc.used = 0 AND rc.expires_at > datetime('now', 'localtime')
      `, [token], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('🔍 Resultado da busca do token de ativação:', activationData ? 1 : 0);

    if (!activationData) {
      console.log('❌ Token de ativação inválido, expirado ou já usado:', token);
      return res.render('login', { 
        error: 'Link de ativação inválido ou expirado. Entre em contato com o administrador.', 
        user: null 
      });
    }

    console.log('✅ Token de ativação válido para o usuário:', activationData.nome);

    // Ativar a conta do usuário - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET ativo = ? WHERE id = ?', ['true', activationData.user_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Marcar token como usado - adaptado para SQLite
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE code = ?', [token], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Enviar email de confirmação de ativação
    const emailSubject = '🎉 Conta ativada com sucesso - CMBM NEWS';
    const baseUrl = BASE_URL;
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">🎉 Conta Ativada!</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Bem-vindo ao CMBM NEWS</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #001f3f;">
        <h3 style="color: #001f3f; margin: 0 0 15px 0; font-size: 18px;">👋 Parabéns, ${activationData.nome}!</h3>
        <p style="margin: 0 0 15px 0; color: #495057; line-height: 1.6;">
          Sua conta no CMBM NEWS foi ativada com sucesso! Agora você pode fazer login e começar a usar todas as funcionalidades do sistema.
        </p>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/login" 
           style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,31,63,0.3);">
          🔑 Fazer Login Agora
        </a>
      </div>

      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 10px; margin: 25px 0;">
        <h4 style="color: #155724; margin: 0 0 15px 0; font-size: 16px;">
          <span style="font-size: 20px;">✅</span> Próximos Passos:
        </h4>
        <ul style="margin: 0; color: #155724; padding-left: 20px;">
          <li style="margin-bottom: 8px;">🔑 Acesse o sistema com suas credenciais</li>
          <li style="margin-bottom: 8px;">📰 Comece a criar e gerenciar notícias</li>
          <li style="margin-bottom: 8px;">👥 Conecte-se com a comunidade escolar</li>
          <li style="margin-bottom: 0;">💡 Explore todas as funcionalidades disponíveis</li>
        </ul>
      </div>
    `;

    const emailHtml = createEmailTemplate('Conta Ativada com Sucesso', content);
    await sendEmail(activationData.email, emailSubject, emailHtml);

    console.log('✅ Conta ativada com sucesso para:', activationData.email);
    res.render('login', { 
      error: null, 
      success: 'Conta ativada com sucesso! Você já pode fazer login.', 
      user: null 
    });
  } catch (error) {
    console.error('🚨 Erro ao ativar conta:', error);
    console.error('Stack:', error.stack);
    res.render('login', { 
      error: 'Erro interno do servidor. Tente novamente.', 
      user: null 
    });
  }
});

// Rota para upload de foto de perfil
app.post('/perfil/foto', requireAuth, rateLimits.upload, upload.single('foto'), (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/perfil?error=Nenhum arquivo selecionado');
    }

    // Verificar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.redirect('/perfil?error=Formato de arquivo não permitido. Use JPG, PNG ou WEBP');
    }

    // Verificar tamanho (2MB)
    if (req.file.size > 2 * 1024 * 1024) {
      return res.redirect('/perfil?error=Arquivo muito grande. Máximo 2MB');
    }

    // Converter para base64
    const base64Data = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    const db = getDatabase();

    // Atualizar foto de perfil no banco
    db.run('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [imageUrl, req.session.userId], (err) => {
      if (err) {
        console.error('Erro ao atualizar foto de perfil:', err);
        return res.redirect('/perfil?error=Erro ao salvar foto de perfil');
      }

      // Atualizar sessão
      if (req.session.user) {
        req.session.user.foto_perfil = imageUrl;
      }

      res.redirect('/perfil?success=Foto de perfil atualizada com sucesso!');
    });
  } catch (error) {
    console.error('Erro ao processar upload:', error);
    res.redirect('/perfil?error=Erro interno do servidor');
  }
});

// Rota para remover foto de perfil
app.post('/perfil/remover-foto', requireAuth, (req, res) => {
  try {
    const db = getDatabase();

    db.run('UPDATE usuarios SET foto_perfil = NULL WHERE id = ?', [req.session.userId], (err) => {
      if (err) {
        console.error('Erro ao remover foto de perfil:', err);
        return res.redirect('/perfil?error=Erro ao remover foto de perfil');
      }

      // Atualizar sessão
      if (req.session.user) {
        req.session.user.foto_perfil = null;
      }

      res.redirect('/perfil?success=Foto de perfil removida com sucesso!');
    });
  } catch (error) {
    console.error('Erro ao remover foto:', error);
    res.redirect('/perfil?error=Erro interno do servidor');
  }
});

// Rota para processar verificação de código de alteração de senha
app.post('/perfil/verificar-codigo', requireAuth, async (req, res) => {
  try {
    const { codigo } = req.body;

    if (!codigo || codigo.length !== 5) {
      return res.render('verificar-codigo-senha', { 
        user: req.session.user,
        error: 'Código inválido',
        success: null
      });
    }

    const db = getDatabase();

    // Verificar código
    const resetData = await new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM reset_codes 
        WHERE code = ? AND user_id = ? AND used = 0 AND expires_at > datetime('now', 'localtime')
      `, [codigo.toUpperCase(), req.session.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!resetData) {
      return res.render('verificar-codigo-senha', { 
        user: req.session.user,
        error: 'Código inválido ou expirado',
        success: null
      });
    }

    // Atualizar senha
    await new Promise((resolve, reject) => {
      db.run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [resetData.observacoes, req.session.userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Marcar código como usado
    await new Promise((resolve, reject) => {
      db.run('UPDATE reset_codes SET used = 1 WHERE id = ?', [resetData.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Buscar dados do usuário para envio de email
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT nome, email FROM usuarios WHERE id = ?', [req.session.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Enviar email de confirmação
    const emailSubject = '🛡️ Senha alterada com sucesso - CMBM NEWS';
    const baseUrl = BASE_URL;
    const content = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">🛡️ Senha Alterada</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Sua senha foi alterada com sucesso</p>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #001f3f;">
        <h3 style="color: #001f3f; margin: 0 0 15px 0; font-size: 18px;">👋 Olá, ${user.nome}!</h3>
        <p style="margin: 0 0 15px 0; color: #495057; line-height: 1.6;">
          Informamos que a senha da sua conta no CMBM NEWS foi alterada com sucesso através do seu perfil.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border: 2px solid #28a745;">
        <div style="text-align: center;">
          <div style="background: #28a745; color: white; padding: 10px; border-radius: 50px; display: inline-block; margin-bottom: 15px;">
            <span style="font-size: 24px;">✅</span>
          </div>
          <h4 style="color: #155724; margin: 0 0 15px 0; font-size: 20px;">Alteração Confirmada</h4>
          <p style="margin: 0; color: #155724; font-size: 16px;">
            <strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/perfil" 
           style="background: linear-gradient(135deg, #001f3f 0%, #003366 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,31,63,0.3);">
          👤 Voltar ao Perfil
        </a>
      </div>
    `;

    const emailHtml = createEmailTemplate('Senha Alterada com Sucesso', content);
    await sendEmail(user.email, emailSubject, emailHtml);

    // Destruir sessão para forçar novo login
    req.session.destroy((err) => {
      if (err) {
        console.error('Erro ao destruir sessão:', err);
      }
      res.render('login', { 
        error: null, 
        success: 'Senha alterada com sucesso! Faça login com sua nova senha.',
        user: null 
      });
    });
  } catch (error) {
    console.error('Erro ao verificar código:', error);
    res.render('verificar-codigo-senha', { 
      user: req.session.user,
      error: 'Erro interno do servidor',
      success: null
    });
  }
});

// ==== ROTAS DE HOMENAGENS ====

// Rota para página principal de homenagens
app.get('/homenagens', (req, res) => {
  try {
    const db = getDatabase();
    db.all(`
      SELECT h.*, u.nome as autor_nome
      FROM homenagens h
      LEFT JOIN usuarios u ON h.autor_id = u.id
      WHERE h.status = 'aprovada' AND h.publicada = 1
      ORDER BY h.data_agendada DESC
    `, (err, homenagens) => {
      if (err) {
        console.error('Erro ao carregar homenagens:', err);
        return res.render('homenagens', { 
          homenagens: [], 
          user: req.session.user, 
          error: 'Erro ao carregar homenagens' 
        });
      }

      // Buscar fotos das homenagens
      const promisesHomenagens = homenagens.map(homenagem => {
        return new Promise((resolve, reject) => {
          db.all(`
            SELECT url_foto, descricao
            FROM fotos_homenagens
            WHERE homenagem_id = ?
            ORDER BY data_criacao ASC
          `, [homenagem.id], (err, fotos) => {
            if (err) {
              reject(err);
            } else {
              homenagem.fotos = fotos;
              resolve(homenagem);
            }
          });
        });
      });

      Promise.all(promisesHomenagens)
        .then(homenagensFinals => {
          res.render('homenagens', { 
            homenagens: homenagensFinals, 
            user: req.session.user 
          });
        })
        .catch(err => {
          console.error('Erro ao carregar fotos das homenagens:', err);
          res.render('homenagens', { 
            homenagens, 
            user: req.session.user,
            error: 'Erro ao carregar fotos das homenagens' 
          });
        });
    });
  } catch (error) {
    console.error('Erro ao carregar homenagens:', error);
    res.render('homenagens', { 
      homenagens: [], 
      user: req.session.user, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para página de envio de homenagem (apenas para repórteres)
app.get('/homenagens/enviar', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'aluno') {
    return res.status(403).render('homenagens-enviar', { 
      user, 
      error: 'Acesso negado. Apenas repórteres (alunos) podem enviar homenagens.' 
    });
  }

  // Verificar se o usuário já enviou uma homenagem esta semana
  const db = getDatabase();
  const umaSemanAAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  db.get(`
    SELECT COUNT(*) as count 
    FROM homenagens 
    WHERE autor_id = ? AND data_criacao >= ?
  `, [user.id, umaSemanAAtras.toISOString()], (err, result) => {
    if (err) {
      console.error('Erro ao verificar homenagens da semana:', err);
      return res.render('homenagens-enviar', { 
        user, 
        error: 'Erro interno do servidor' 
      });
    }

    if (result.count > 0) {
      return res.render('homenagens-enviar', { 
        user, 
        error: 'Você já enviou uma homenagem esta semana. Aguarde para enviar outra.' 
      });
    }

    res.render('homenagens-enviar', { user });
  });
});

// Rota para processar envio de homenagem
app.post('/homenagens/enviar', rateLimits.upload, upload.fields([
  { name: 'foto_principal', maxCount: 1 },
  { name: 'galeria_fotos', maxCount: 5 }
]), (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'aluno') {
    return res.status(403).render('homenagens-enviar', { 
      user, 
      error: 'Acesso negado. Apenas repórteres (alunos) podem enviar homenagens.' 
    });
  }

  try {
    const { nome, relacao, periodo, frase, texto, foto_principal_url, galeria_urls } = req.body;

    // Validar campos obrigatórios
    if (!nome || !relacao || !texto) {
      return res.render('homenagens-enviar', { 
        user, 
        error: 'Campos obrigatórios: Nome, Relação com o colégio e Texto da homenagem' 
      });
    }

    // Processar foto principal
    let fotoPrincipal = '';
    if (req.files && req.files.foto_principal && req.files.foto_principal[0]) {
      const file = req.files.foto_principal[0];
      const base64Data = file.buffer.toString('base64');
      fotoPrincipal = `data:${file.mimetype};base64,${base64Data}`;
    } else if (foto_principal_url) {
      fotoPrincipal = foto_principal_url.trim();
    }

    if (!fotoPrincipal) {
      return res.render('homenagens-enviar', { 
        user, 
        error: 'Foto principal é obrigatória (upload ou URL)' 
      });
    }

    // Processar galeria de fotos
    let galeriaFotos = [];

    // Fotos por upload
    if (req.files && req.files.galeria_fotos) {
      const fotosUpload = req.files.galeria_fotos.map(file => {
        const base64Data = file.buffer.toString('base64');
        return `data:${file.mimetype};base64,${base64Data}`;
      });
      galeriaFotos = galeriaFotos.concat(fotosUpload);
    }

    // Fotos por URL
    if (galeria_urls) {
      const fotosUrl = galeria_urls.split('\n')
        .filter(url => url.trim())
        .map(url => url.trim());
      galeriaFotos = galeriaFotos.concat(fotosUrl);
    }

    // Limitar a 5 fotos na galeria
    if (galeriaFotos.length > 5) {
      return res.render('homenagens-enviar', { 
        user, 
        error: 'Máximo de 5 fotos na galeria' 
      });
    }

    // Verificar se o usuário já enviou uma homenagem esta semana
    const db = getDatabase();
    const umaSemanAAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    db.get(`
      SELECT COUNT(*) as count 
      FROM homenagens 
      WHERE autor_id = ? AND data_criacao >= ?
    `, [user.id, umaSemanAAtras.toISOString()], (err, result) => {
      if (err) {
        console.error('Erro ao verificar homenagens da semana:', err);
        return res.render('homenagens-enviar', { 
          user, 
          error: 'Erro interno do servidor' 
        });
      }

      if (result.count > 0) {
        return res.render('homenagens-enviar', { 
          user, 
          error: 'Você já enviou uma homenagem esta semana. Aguarde para enviar outra.' 
        });
      }

      // Inserir homenagem
      db.run(`
        INSERT INTO homenagens (nome, relacao, periodo, frase, texto, foto_principal, autor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [nome, relacao, periodo || null, frase || null, texto, fotoPrincipal, user.id], function(err) {
        if (err) {
          console.error('Erro ao criar homenagem:', err);
          return res.render('homenagens-enviar', { 
            user, 
            error: 'Erro ao criar homenagem' 
          });
        }

        const homenagemId = this.lastID;

        // Inserir fotos da galeria
        if (galeriaFotos.length > 0) {
          const insertPromises = galeriaFotos.map(foto => {
            return new Promise((resolve, reject) => {
              db.run(`
                INSERT INTO fotos_homenagens (homenagem_id, url_foto)
                VALUES (?, ?)
              `, [homenagemId, foto], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          });

          Promise.all(insertPromises)
            .then(() => {
              res.render('homenagens-enviar', { 
                user, 
                success: 'Homenagem enviada com sucesso! Aguarde a aprovação do editor.' 
              });
            })
            .catch(err => {
              console.error('Erro ao inserir fotos da galeria:', err);
              res.render('homenagens-enviar', { 
                user, 
                error: 'Homenagem criada, mas erro ao adicionar fotos da galeria' 
              });
            });
        } else {
          res.render('homenagens-enviar', { 
            user, 
            success: 'Homenagem enviada com sucesso! Aguarde a aprovação do editor.' 
          });
        }
      });
    });
  } catch (error) {
    console.error('Erro ao processar homenagem:', error);
    res.render('homenagens-enviar', { 
      user, 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para página de aprovação de homenagens (apenas para editores)
app.get('/homenagens/aprovar', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor' && user.tipo !== 'diretor') {
    return res.status(403).render('homenagens-aprovar', { 
      user, 
      homenagensPendentes: [],
      error: 'Acesso negado. Apenas editores podem aprovar homenagens.' 
    });
  }

  try {
    const db = getDatabase();
    db.all(`
      SELECT h.*, u.nome as autor_nome
      FROM homenagens h
      LEFT JOIN usuarios u ON h.autor_id = u.id
      WHERE h.status = 'pendente'
      ORDER BY h.data_criacao ASC
    `, (err, homenagensPendentes) => {
      if (err) {
        console.error('Erro ao carregar homenagens pendentes:', err);
        return res.render('homenagens-aprovar', { 
          user, 
          homenagensPendentes: [], 
          error: 'Erro ao carregar homenagens pendentes' 
        });
      }

      // Buscar fotos das homenagens
      const promisesHomenagens = homenagensPendentes.map(homenagem => {
        return new Promise((resolve, reject) => {
          db.all(`
            SELECT url_foto, descricao
            FROM fotos_homenagens
            WHERE homenagem_id = ?
            ORDER BY data_criacao ASC
          `, [homenagem.id], (err, fotos) => {
            if (err) {
              reject(err);
            } else {
              homenagem.fotos = fotos;
              resolve(homenagem);
            }
          });
        });
      });

      Promise.all(promisesHomenagens)
        .then(homenagensFinals => {
          res.render('homenagens-aprovar', { 
            user, 
            homenagensPendentes: homenagensFinals 
          });
        })
        .catch(err => {
          console.error('Erro ao carregar fotos das homenagens:', err);
          res.render('homenagens-aprovar', { 
            user, 
            homenagensPendentes,
            error: 'Erro ao carregar fotos das homenagens' 
          });
        });
    });
  } catch (error) {
    console.error('Erro ao carregar aprovações:', error);
    res.render('homenagens-aprovar', { 
      user, 
      homenagensPendentes: [], 
      error: 'Erro interno do servidor' 
    });
  }
});

// Rota para processar aprovação/reprovação de homenagem
app.post('/homenagens/aprovar/:id', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const user = req.session.user;
  if (user.tipo !== 'editor' && user.tipo !== 'diretor') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const homenagemId = req.params.id;
    const { action, motivo } = req.body;
    const db = getDatabase();

    if (action === 'aprovar') {
      // Buscar próxima posição na fila
      db.get(`
        SELECT COALESCE(MAX(ordem_publicacao), 0) + 1 as proxima_ordem
        FROM homenagens 
        WHERE status = 'aprovada'
      `, (err, result) => {
        if (err) {
          console.error('Erro ao buscar ordem:', err);
          return res.redirect('/homenagens/aprovar?error=Erro ao aprovar homenagem');
        }

        const proximaOrdem = result.proxima_ordem;

        db.run(`
          UPDATE homenagens 
          SET status = 'aprovada', revisor_id = ?, data_aprovacao = CURRENT_TIMESTAMP, ordem_publicacao = ?
          WHERE id = ?
        `, [user.id, proximaOrdem, homenagemId], (err) => {
          if (err) {
            console.error('Erro ao aprovar homenagem:', err);
            return res.redirect('/homenagens/aprovar?error=Erro ao aprovar homenagem');
          }

          // Executar o agendamento automático
          agendarProximasHomenagens();
          res.redirect('/homenagens/aprovar?success=Homenagem aprovada e adicionada à fila de publicação');
        });
      });
    } else if (action === 'reprovar') {
      db.run(`
        UPDATE homenagens 
        SET status = 'reprovada', revisor_id = ?, observacoes = ?
        WHERE id = ?
      `, [user.id, motivo || 'Reprovado sem motivo especificado', homenagemId], (err) => {
        if (err) {
          console.error('Erro ao reprovar homenagem:', err);
          return res.redirect('/homenagens/aprovar?error=Erro ao reprovar homenagem');
        }
        res.redirect('/homenagens/aprovar?success=Homenagem reprovada');
      });
    } else {
      res.redirect('/homenagens/aprovar?error=Ação inválida');
    }
  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    res.redirect('/homenagens/aprovar?error=Erro interno do servidor');
  }
});

// Rota para página Sobre
app.get('/sobre', (req, res) => {
  res.render('sobre', { 
    user: req.session.user || null,
    title: 'Sobre Nossa Escola'
  });
});

// Rota para página Contato
app.get('/contato', (req, res) => {
  res.render('contato', { 
    user: req.session.user || null,
    title: 'Entre em Contato'
  });
});

// Servidor inicializado com sucesso