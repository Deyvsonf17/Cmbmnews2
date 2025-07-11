# Página de Prática CSS

## Overview

Uma página HTML pura e simples criada especificamente para prática de CSS básico. O projeto consiste em um único arquivo HTML com diversos elementos estruturados sem nenhuma estilização, permitindo ao usuário experimentar e aprender CSS do zero.

## Estrutura do Projeto

### Arquitetura Simples
- **Tecnologia**: HTML puro sem frameworks ou bibliotecas
- **Servidor**: Python http.server para servir o arquivo HTML estático
- **Estilização**: Nenhuma - página completamente sem CSS para prática
- **Estrutura**: Arquivo único index.html com elementos HTML básicos

### Elementos HTML Incluídos
- **Header**: Cabeçalho principal da página
- **Navigation**: Menu de navegação simples
- **Sections**: Diferentes seções de conteúdo para prática
- **Forms**: Formulário básico com inputs e textarea
- **Tables**: Tabela simples para estilização
- **Lists**: Listas ordenadas e não ordenadas
- **Footer**: Rodapé da página

## Key Components

### Database Layer (`database.js`)
- **Users Table**: Stores admin credentials (email, hashed password)
- **News Table**: Stores news articles (title, content, image URL, creation date)
- **Default Admin**: Creates admin@cmbm.com.br with password "admin123" on first run
- **Connection Management**: Single SQLite database file with better-sqlite3

### Server Layer (`server.js`)
- **Session Management**: Express-session with 24-hour cookie expiration
- **Authentication Middleware**: `requireAuth` function for protected routes
- **Route Handlers**: Public news viewing and admin management endpoints
- **Security**: CSRF protection through session validation

### Data Models
```sql
usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  senha_hash TEXT
)

noticias (
  id INTEGER PRIMARY KEY,
  titulo TEXT,
  conteudo TEXT,
  imagem_url TEXT,
  data_criacao DATETIME
)
```

## Data Flow

1. **Public Access**: Users can view all news articles on the homepage without authentication
2. **Admin Login**: Admin authenticates with email/password, creating a server-side session
3. **Content Management**: Authenticated admin can create, edit, and delete news articles
4. **Database Operations**: All data operations use prepared statements for security
5. **Session Persistence**: Login state maintained via express-session with cookie storage

## External Dependencies

### Core Dependencies
- **express**: Web framework (v5.1.0)
- **ejs**: Template engine (v3.1.10)
- **better-sqlite3**: SQLite database driver (v12.2.0)
- **express-session**: Session management (v1.18.1)
- **bcrypt**: Password hashing (v6.0.0)

### Frontend Dependencies
- **Bootstrap**: CSS framework via CDN
- **Custom CSS**: Navy blue theme with responsive design

## Deployment Strategy

### Replit Optimization
- **File-based Database**: SQLite database persists in the filesystem
- **Simple Dependencies**: Minimal npm packages for fast installation
- **Environment Variables**: Session secret configurable via process.env
- **Static Assets**: Public folder for CSS and images

### Configuration
- **Port**: Configurable via PORT environment variable (default: 5000)
- **Database**: Single `database.db` file in project root
- **Sessions**: In-memory session store (suitable for single-instance deployment)

### Security Considerations
- Password hashing with bcrypt (10 salt rounds)
- Session-based authentication with secure cookies
- Prepared SQL statements to prevent injection attacks
- Input validation through Express middleware

## Changelog

```
Changelog:
- July 08, 2025. Initial setup
- July 08, 2025. Sistema de gestão de usuários melhorado:
  * Corrigida senha do admin (admin@cmbm.com.br / admin123)
  * Opção "Admin" adicionada no cadastro de usuários
  * Campos série/turma específicos para alunos (6°-9°, A-H)
  * Série e turma dos alunos agora aparecem nas publicações
  * Informações de série/turma adicionadas nos painéis de revisão
- July 08, 2025. Correções no cadastro de usuários:
  * Rota GET /usuarios/editar/:id criada para edição pelo painel TI
  * Formulário de cadastro corrigido para salvar série/turma dos alunos
  * Validação de campos obrigatórios para alunos (série e turma)
  * Valores dos selects padronizados (6º ano, 7º ano, etc.)
  * Query do painel TI atualizada para exibir série/turma dos alunos
- July 08, 2025. Limpeza de arquivos TypeScript interferentes:
  * Removidos arquivos TypeScript não relacionados ao projeto original
  * Mantido apenas código JavaScript original do usuário
  * PostgreSQL configurado e funcionando
  * Servidor funcionando corretamente na porta 5000
- July 10, 2025. Atualização do sistema de email e URLs:
  * Email configurado: deyvsonfteste@gmail.com com senha de aplicativo
  * URLs atualizadas de localhost e URL antiga para nova URL do Replit
  * Variável de ambiente URL_SITE configurada nos secrets do Replit
  * Arquivo test_form.html atualizado com nova URL
  * Dependência express-ejs-layouts instalada
  * Servidor funcionando corretamente na porta 5000
- July 10, 2025. Configuração de email Gmail e otimização de URLs:
  * Email SMTP migrado para Gmail: deyvsonfteste.01@gmail.com via smtp.gmail.com:587
  * Configuração de senha de aplicativo Gmail: qqjc bsor lpez imvd
  * Variáveis de ambiente configuradas nos secrets do Replit:
    - GMAIL_USER: deyvsonfteste.01@gmail.com
    - GMAIL_APP_PASSWORD: senha de aplicativo do Gmail
    - URL_ACESSO: https://eddf4bd7-9e5f-4e01-9c59-fccdafa09864-00-odn7cu9ial9v.riker.replit.dev/
  * Arquivo mailer.js atualizado para usar Gmail SMTP
  * Todas as referências localhost:5000 removidas do código
  * Sistema agora usa exclusivamente URL_ACESSO do environment
  * Arquivo .env criado com configurações locais
  * Dependências nodemailer e dotenv instaladas
  * Servidor funcionando corretamente na porta 5000
  * Sistema de email Gmail configurado e funcionando
  * Rota de teste /test-email disponível para diagnóstico
- July 10, 2025. Implementação da Galeria de Fotos:
  * Nova aba "Galeria" adicionada ao menu de navegação
  * Tabelas SQLite criadas: albums e fotos
  * Sistema de permissões implementado:
    - Visitantes: apenas visualizam fotos aprovadas
    - Repórteres: podem enviar fotos via upload ou URL
    - Editores: podem aprovar ou reprovar fotos
  * Funcionalidades implementadas:
    - Página principal da galeria com álbuns organizados por evento
    - Página de envio de fotos com validação de tipos e tamanhos
    - Sistema de aprovação para editores com motivos de reprovação
    - Visualização de álbuns individuais com lightbox para fotos
    - Upload de arquivos (até 5MB) ou URLs de imagens
  * Interface responsiva com Bootstrap e Font Awesome
  * Dependência multer instalada para upload de arquivos
  * Link "Aprovar Fotos" no menu dropdown para editores
- July 10, 2025. Redesign Profissional do Portal de Notícias:
  * Layout completamente reformulado com design de jornal profissional
  * Nova paleta de cores: vermelho editorial (#c41e3a), tons de cinza escuro
  * Tipografia profissional: Georgia/Times para corpo, Arial/Helvetica para títulos
  * Header redesenhado com masthead estilo jornal tradicional
  * Navegação responsiva com menu hambúrguer para dispositivos móveis
  * Cards de notícias com novo design profissional e animações suaves
  * Sistema de grid layout estilo jornal com sidebar informativa
  * Espaços publicitários estratégicos prontos para monetização:
    - Banner superior (728x90)
    - Banners intermediários entre notícias
    - Sidebar ads (300x250)
  * Login discreto movido para rodapé como "Área Restrita"
  * Footer profissional com informações detalhadas da escola e desenvolvedor
  * Seção hero redesenhada com call-to-actions profissionais
  * Barra de pesquisa melhorada com design moderno
  * Sistema responsivo otimizado para todas as telas (celular, tablet, desktop)
  * Funcionalidades JavaScript profissionais: smooth scroll, reading time
  * SEO melhorado com meta tags otimizadas
  * Print styles para impressão profissional
  * Animações e transições suaves para melhor experiência do usuário
- July 11, 2025. Otimizações Avançadas de Performance e Estabilidade:
  * Middlewares de performance implementados (compression, cache, security headers)
  * Sistema de rate limiting configurado para todas as rotas críticas
  * Proteção contra SQL injection e ataques XSS
  * Timeout de requisições configurado (30 segundos)
  * Limite de tamanho de body para uploads (10MB)
  * Sistema de cache em memória com invalidação automática
  * Cache HTTP para páginas públicas (5-10 minutos)
  * Health check endpoint para monitoramento (/health)
  * Tratamento robusto de erros com páginas personalizadas
  * Trust proxy configurado para Replit environment
  * Sistema de limpeza automática de cache baseado em uso de memória
  * Middleware de logging de performance para debug
  * Rate limiting específico para login, upload e recuperação de senha
  * Monitoramento contínuo de uptime e performance
- July 11, 2025. Limpeza Completa do Banco de Dados:
  * Removidos todos os usuários exceto admin@cmbm.com.br e deyvsonf016@gmail.com
  * Deletadas todas as postagens e notícias do site
  * Removidas todas as fotos da galeria e álbuns
  * Apagadas todas as homenagens e fotos relacionadas
  * Códigos de reset de senha limpos
  * Sistema pronto para criação de novas postagens do zero
  * Banco de dados otimizado com apenas 2 usuários ativos
- July 11, 2025. Correção Crítica do Sistema de Roteamento:
  * Identificado e corrigido problema de middlewares duplicados (errorHandler e notFoundHandler)
  * Middlewares de tratamento de erros estavam sendo registrados duas vezes
  * Remoção de rotas duplicadas que causavam conflitos
  * Restaurada rota principal `/perfil/confirmar-alteracao` com middleware requireAuth
  * Todas as rotas de perfil agora funcionam corretamente (404 → 200/302)
  * Sistema de autenticação e redirecionamento funcionando adequadamente
  * Arquivo server.js reduzido para 4622 linhas (otimizado)
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```

### Development Notes
- The application uses direct SQL queries without an ORM for simplicity
- Bootstrap styling provides responsive design without complex build processes
- Single admin user approach simplifies user management
- SQLite provides zero-configuration database setup ideal for Replit environment