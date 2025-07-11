const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

console.log('🧪 Iniciando testes completos do sistema...');

async function createTestUsers() {
    console.log('\n👥 Criando usuários de teste...');
    
    const users = [
        { nome: 'João Silva', email: 'aluno.teste@cmbm.com.br', tipo: 'aluno', turma: 'A', ano: '6º ano' },
        { nome: 'Maria Santos', email: 'editor.teste@cmbm.com.br', tipo: 'editor' },
        { nome: 'Pedro Costa', email: 'ti.teste@cmbm.com.br', tipo: 'ti' },
        { nome: 'Ana Rodrigues', email: 'reporter.teste@cmbm.com.br', tipo: 'reporter' }
    ];
    
    const insertUser = db.prepare(`
        INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo, turma, ano) 
        VALUES (?, ?, ?, ?, 'sim', ?, ?)
    `);
    
    for (const user of users) {
        try {
            const hashedPassword = await bcrypt.hash('teste123', 10);
            insertUser.run(
                user.nome,
                user.email,
                hashedPassword,
                user.tipo,
                user.turma || null,
                user.ano || null
            );
            console.log(`✅ Usuário criado: ${user.email} (${user.tipo})`);
        } catch (error) {
            console.log(`ℹ️  Usuário já existe: ${user.email}`);
        }
    }
}

function createTestPosts() {
    console.log('\n📰 Criando postagens de teste...');
    
    const posts = [
        {
            titulo: 'Volta às Aulas 2025',
            conteudo: 'O CMBM prepara uma recepção especial para todos os alunos neste retorno às aulas. Serão atividades de integração, apresentação dos novos professores e uma programação especial para os primeiros dias do ano letivo.',
            categoria: 'educacao',
            status: 'publicado',
            autor_id: 8 // deyvsonf016@gmail.com
        },
        {
            titulo: 'Feira de Ciências CMBM 2025',
            conteudo: 'A tradicional Feira de Ciências do CMBM acontecerá em março. Os alunos estão convidados a apresentar seus projetos científicos e inovadores. Premiação para os melhores trabalhos de cada categoria.',
            categoria: 'eventos',
            status: 'rascunho',
            autor_id: 8
        },
        {
            titulo: 'Novo Laboratório de Informática',
            conteudo: 'O CMBM inaugura seu novo laboratório de informática com 30 computadores de última geração. O espaço será utilizado para aulas de programação, robótica e projetos digitais.',
            categoria: 'infraestrutura',
            status: 'pendente',
            autor_id: 8
        },
        {
            titulo: 'Campeonato Interclasses 2025',
            conteudo: 'Inscrições abertas para o Campeonato Interclasses de futebol, vôlei e basquete. Venha representar sua turma e mostrar seu talento esportivo. Jogos acontecem durante o recreio.',
            categoria: 'esportes',
            status: 'publicado',
            autor_id: 8
        }
    ];
    
    const insertPost = db.prepare(`
        INSERT INTO noticias (titulo, slug, conteudo, categoria, status, autor_id, data_criacao, data_publicacao)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    
    posts.forEach((post, index) => {
        const slug = post.titulo.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        insertPost.run(
            post.titulo,
            slug,
            post.conteudo,
            post.categoria,
            post.status,
            post.autor_id
        );
        console.log(`✅ Postagem criada: ${post.titulo} (${post.status})`);
    });
}

function createTestHomenagem() {
    console.log('\n🏆 Criando homenagem de teste...');
    
    const homenagem = {
        nome: 'Professora Helena Oliveira',
        relacao: 'Professora de Matemática',
        periodo: '1995-2024',
        frase: 'Ensinar é mais que transmitir conhecimento, é inspirar.',
        texto: 'A Professora Helena Oliveira dedicou 29 anos de sua vida ao ensino da matemática no CMBM. Conhecida por sua paciência e dedicação, ela transformou a vida de milhares de alunos, fazendo com que muitos descobrissem o amor pelos números. Sua aposentadoria marca o fim de uma era, mas seu legado permanecerá para sempre em nossos corações.',
        foto_principal: '/images/homenagem-helena.jpg',
        status: 'aprovado',
        autor_id: 8,
        data_agendada: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias no futuro
    };
    
    const insertHomenagem = db.prepare(`
        INSERT INTO homenagens (nome, relacao, periodo, frase, texto, foto_principal, status, autor_id, data_criacao, data_agendada, ordem_publicacao, publicada)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 1, 0)
    `);
    
    insertHomenagem.run(
        homenagem.nome,
        homenagem.relacao,
        homenagem.periodo,
        homenagem.frase,
        homenagem.texto,
        homenagem.foto_principal,
        homenagem.status,
        homenagem.autor_id,
        homenagem.data_agendada
    );
    
    console.log(`✅ Homenagem criada: ${homenagem.nome}`);
}

function createTestAlbum() {
    console.log('\n📸 Criando álbum de fotos de teste...');
    
    // Criar álbum
    const album = {
        titulo: 'Festa Junina CMBM 2025',
        descricao: 'Fotos da tradicional Festa Junina do CMBM com apresentações culturais, quadrilha e comidas típicas.',
        data_evento: '2025-06-15',
        autor_id: 8
    };
    
    const insertAlbum = db.prepare(`
        INSERT INTO albums (titulo, slug, descricao, data_evento, autor_id, data_criacao)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    
    const slug = album.titulo.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    const albumResult = insertAlbum.run(
        album.titulo,
        slug,
        album.descricao,
        album.data_evento,
        album.autor_id
    );
    
    console.log(`✅ Álbum criado: ${album.titulo}`);
    
    // Criar fotos do álbum
    const fotos = [
        {
            titulo: 'Quadrilha dos alunos do 6º ano',
            imagem_url: '/uploads/festa-junina-quadrilha.jpg',
            descricao: 'Apresentação da quadrilha com os alunos do 6º ano',
            status: 'aprovado'
        },
        {
            titulo: 'Barraca de comidas típicas',
            imagem_url: '/uploads/festa-junina-comidas.jpg',
            descricao: 'Deliciosas comidas típicas preparadas pelos pais',
            status: 'pendente'
        },
        {
            titulo: 'Decoração da festa',
            imagem_url: '/uploads/festa-junina-decoracao.jpg',
            descricao: 'Decoração temática com bandeirolas e balões',
            status: 'aprovado'
        }
    ];
    
    const insertFoto = db.prepare(`
        INSERT INTO fotos (album_id, titulo, imagem_url, descricao, status, autor_id, data_criacao)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    fotos.forEach(foto => {
        insertFoto.run(
            albumResult.lastInsertRowid,
            foto.titulo,
            foto.imagem_url,
            foto.descricao,
            foto.status,
            album.autor_id
        );
        console.log(`✅ Foto adicionada: ${foto.titulo} (${foto.status})`);
    });
}

function createResetCodes() {
    console.log('\n🔑 Criando códigos de reset para teste...');
    
    const resetCodes = [
        {
            user_id: 1, // admin@cmbm.com.br
            code: 'ADMIN123',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        },
        {
            user_id: 8, // deyvsonf016@gmail.com
            code: 'DEV456',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    
    const insertResetCode = db.prepare(`
        INSERT INTO reset_codes (user_id, code, expires_at, used, created_at)
        VALUES (?, ?, ?, 0, datetime('now'))
    `);
    
    resetCodes.forEach(reset => {
        insertResetCode.run(reset.user_id, reset.code, reset.expires_at);
        console.log(`✅ Código de reset criado para usuário ID ${reset.user_id}: ${reset.code}`);
    });
}

function showSummary() {
    console.log('\n📊 Resumo dos dados de teste criados:');
    
    const countUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    console.log(`👥 Usuários: ${countUsers.count}`);
    
    const countPosts = db.prepare('SELECT COUNT(*) as count FROM noticias').get();
    console.log(`📰 Postagens: ${countPosts.count}`);
    
    const countHomenagens = db.prepare('SELECT COUNT(*) as count FROM homenagens').get();
    console.log(`🏆 Homenagens: ${countHomenagens.count}`);
    
    const countAlbums = db.prepare('SELECT COUNT(*) as count FROM albums').get();
    console.log(`📁 Álbuns: ${countAlbums.count}`);
    
    const countFotos = db.prepare('SELECT COUNT(*) as count FROM fotos').get();
    console.log(`📸 Fotos: ${countFotos.count}`);
    
    const countResetCodes = db.prepare('SELECT COUNT(*) as count FROM reset_codes WHERE used = 0').get();
    console.log(`🔑 Códigos de reset ativos: ${countResetCodes.count}`);
    
    console.log('\n🎯 Dados para teste de login:');
    console.log('📧 Usuários criados com senha "teste123":');
    console.log('   - admin@cmbm.com.br (admin123)');
    console.log('   - deyvsonf016@gmail.com (admin123)');
    console.log('   - aluno.teste@cmbm.com.br (teste123)');
    console.log('   - editor.teste@cmbm.com.br (teste123)');
    console.log('   - ti.teste@cmbm.com.br (teste123)');
    console.log('   - reporter.teste@cmbm.com.br (teste123)');
    
    console.log('\n🔐 Códigos de reset disponíveis:');
    console.log('   - ADMIN123 (para admin@cmbm.com.br)');
    console.log('   - DEV456 (para deyvsonf016@gmail.com)');
}

async function runAllTests() {
    try {
        await createTestUsers();
        createTestPosts();
        createTestHomenagem();
        createTestAlbum();
        createResetCodes();
        showSummary();
        
        console.log('\n✅ Todos os dados de teste foram criados com sucesso!');
        console.log('🚀 O sistema está pronto para testes completos');
        
    } catch (error) {
        console.error('❌ Erro durante a criação dos dados de teste:', error);
    } finally {
        db.close();
    }
}

runAllTests();