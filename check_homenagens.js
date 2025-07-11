const { initializeDatabase, getDatabase } = require('./database');

async function checkHomenagensDB() {
    try {
        // Inicializar banco primeiro
        await initializeDatabase();
        const db = getDatabase();
        
        // Verificar se as tabelas existem
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%homenagem%'", (err, tables) => {
            if (err) {
                console.error('Erro ao buscar tabelas:', err);
                return;
            }
            
            console.log('Tabelas relacionadas a homenagens:');
            console.log(tables);
            
            // Verificar todas as tabelas
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, allTables) => {
                if (err) {
                    console.error('Erro ao buscar todas as tabelas:', err);
                    return;
                }
                
                console.log('\nTodas as tabelas no banco:');
                console.log(allTables);
                
                process.exit(0);
            });
        });
    } catch (error) {
        console.error('Erro ao verificar banco:', error);
        process.exit(1);
    }
}

checkHomenagensDB();