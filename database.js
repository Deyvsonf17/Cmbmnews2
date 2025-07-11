const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

let db;

function initializeDatabase() {
  return new Promise(async (resolve, reject) => {
    try {
      // Conectar ao banco SQLite
      const dbPath = path.join(__dirname, 'database.db');
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erro ao conectar com SQLite:', err);
          reject(err);
          return;
        }
        console.log('Conexão com SQLite estabelecida:', dbPath);
      });

      // Habilitar foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Criar tabela de usuários
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            tipo TEXT DEFAULT 'aluno',
            ativo TEXT DEFAULT 'true',
            turma TEXT,
            ano TEXT,
            foto_perfil TEXT
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Adicionar coluna foto_perfil se não existir
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT`, (err) => {
          // Ignorar erro se coluna já existe
          resolve();
        });
      });

      // Criar tabela de notícias
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS noticias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            conteudo TEXT NOT NULL,
            categoria TEXT DEFAULT 'Geral',
            imagem_url TEXT,
            status TEXT DEFAULT 'rascunho',
            observacoes TEXT,
            autor_id INTEGER REFERENCES usuarios(id),
            revisor_id INTEGER REFERENCES usuarios(id),
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_publicacao DATETIME
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Criar tabela de códigos de redefinição
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS reset_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
            code TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used INTEGER DEFAULT 0,
            observacoes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Criar tabela de álbuns de fotos
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            descricao TEXT,
            data_evento DATE NOT NULL,
            autor_id INTEGER REFERENCES usuarios(id),
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Criar tabela de fotos
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS fotos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
            titulo TEXT,
            imagem_url TEXT NOT NULL,
            descricao TEXT,
            status TEXT DEFAULT 'pendente',
            observacoes TEXT,
            autor_id INTEGER REFERENCES usuarios(id),
            revisor_id INTEGER REFERENCES usuarios(id),
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_aprovacao DATETIME
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Criar tabela de homenagens
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS homenagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            relacao TEXT NOT NULL,
            periodo TEXT,
            frase TEXT,
            texto TEXT NOT NULL,
            foto_principal TEXT NOT NULL,
            status TEXT DEFAULT 'pendente',
            observacoes TEXT,
            autor_id INTEGER REFERENCES usuarios(id),
            revisor_id INTEGER REFERENCES usuarios(id),
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_aprovacao DATETIME,
            data_agendada DATETIME,
            ordem_publicacao INTEGER,
            publicada BOOLEAN DEFAULT 0
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Adicionar campos de agendamento se não existirem
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE homenagens ADD COLUMN data_agendada DATETIME`, (err) => {
          resolve(); // Ignorar erro se coluna já existe
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE homenagens ADD COLUMN ordem_publicacao INTEGER`, (err) => {
          resolve(); // Ignorar erro se coluna já existe
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE homenagens ADD COLUMN publicada BOOLEAN DEFAULT 0`, (err) => {
          resolve(); // Ignorar erro se coluna já existe
        });
      });

      // Criar tabela de fotos das homenagens
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS fotos_homenagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            homenagem_id INTEGER REFERENCES homenagens(id) ON DELETE CASCADE,
            url_foto TEXT NOT NULL,
            descricao TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Limpar tokens expirados
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE reset_codes 
          SET used = 1 
          WHERE datetime(expires_at) < datetime('now') AND used = 0
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Verificar se usuário admin existe
      const adminExists = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@cmbm.com.br'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!adminExists) {
        // Criar hash da senha
        const passwordHash = await bcrypt.hash('admin123', 10);

        // Inserir usuário administrador padrão
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo) VALUES (?, ?, ?, ?, ?)',
            ['Administrador', 'admin@cmbm.com.br', passwordHash, 'diretor', 'true'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log('Usuário administrador criado:');
        console.log('Email: admin@cmbm.com.br');
        console.log('Senha: admin123');
      }

      // Criar usuários de teste se não existirem
      const usuariosTeste = [
        { nome: 'Editor CMBM', email: 'editor@cmbm.com.br', senha: 'editor123', tipo: 'editor', turma: null, ano: null },
        { nome: 'Maria Silva', email: 'aluno@cmbm.com.br', senha: 'aluno123', tipo: 'aluno', turma: 'A', ano: '7º ano' },
        { nome: 'TI CMBM', email: 'ti@cmbm.com.br', senha: 'ti123', tipo: 'ti', turma: null, ano: null }
      ];

      for (const usuario of usuariosTeste) {
        const existe = await new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM usuarios WHERE email = ?', [usuario.email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (existe.count == 0) {
          const senhaHash = await bcrypt.hash(usuario.senha, 10);
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO usuarios (nome, email, senha_hash, tipo, turma, ano) VALUES (?, ?, ?, ?, ?, ?)', 
              [usuario.nome, usuario.email, senhaHash, usuario.tipo, usuario.turma, usuario.ano],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          console.log(`Usuário ${usuario.tipo} criado: ${usuario.email}`);
        }
      }

      console.log('Banco de dados SQLite inicializado com sucesso');
      resolve();
    } catch (error) {
      console.error('Erro ao inicializar banco de dados:', error);
      console.error('Stack:', error.stack);
      reject(error);
    }
  });
}

function getDatabase() {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }
  return db;
}

module.exports = {
  initializeDatabase,
  getDatabase
};