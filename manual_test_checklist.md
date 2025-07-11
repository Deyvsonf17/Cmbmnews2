# Lista de Verificação - Testes Manuais CMBM

## 📋 Dados de Teste Criados

### 👥 Usuários Disponíveis
- **admin@cmbm.com.br** (senha: admin123) - Tipo: diretor
- **deyvsonf016@gmail.com** (senha: admin123) - Tipo: ti
- **aluno.teste@cmbm.com.br** (senha: teste123) - Tipo: aluno
- **editor.teste@cmbm.com.br** (senha: teste123) - Tipo: editor
- **ti.teste@cmbm.com.br** (senha: teste123) - Tipo: ti
- **reporter.teste@cmbm.com.br** (senha: teste123) - Tipo: reporter

### 📰 Postagens Criadas
1. **Volta às Aulas 2025** (publicado)
2. **Feira de Ciências CMBM 2025** (rascunho)
3. **Novo Laboratório de Informática** (pendente)
4. **Campeonato Interclasses 2025** (publicado)

### 🏆 Homenagem Criada
- **Professora Helena Oliveira** (aprovado, agendada para 7 dias)

### 📸 Álbum de Fotos
- **Festa Junina CMBM 2025** com 3 fotos (2 aprovadas, 1 pendente)

### 🔑 Códigos de Reset
- **ADMIN123** (para admin@cmbm.com.br)
- **DEV456** (para deyvsonf016@gmail.com)

## 🧪 Roteiro de Testes

### 1. Teste de Login e Autenticação
- [ ] Login com admin@cmbm.com.br
- [ ] Login com cada tipo de usuário
- [ ] Teste de senha incorreta
- [ ] Teste de logout

### 2. Teste de Recuperação de Senha
- [ ] Solicitar código de reset
- [ ] Usar código ADMIN123
- [ ] Usar código DEV456
- [ ] Testar código inválido

### 3. Teste de Criação de Postagens
- [ ] Criar postagem como admin
- [ ] Criar postagem como editor
- [ ] Criar postagem como reporter
- [ ] Testar diferentes categorias
- [ ] Testar upload de imagem

### 4. Teste de Aprovação de Conteúdo
- [ ] Aprovar postagem pendente como editor
- [ ] Reprovar postagem como editor
- [ ] Aprovar foto da galeria
- [ ] Reprovar foto da galeria

### 5. Teste de Galeria de Fotos
- [ ] Ver álbuns como visitante
- [ ] Enviar foto como reporter
- [ ] Criar novo álbum
- [ ] Testar upload de arquivo
- [ ] Testar URL de imagem

### 6. Teste de Homenagens
- [ ] Ver homenagem agendada
- [ ] Criar nova homenagem
- [ ] Aprovar homenagem
- [ ] Testar agendamento

### 7. Teste de Gerenciamento de Usuários
- [ ] Criar novo usuário como admin
- [ ] Editar usuário existente
- [ ] Desativar usuário
- [ ] Testar diferentes tipos de usuário

### 8. Teste de Painéis Administrativos
- [ ] Painel do Admin
- [ ] Painel do Editor
- [ ] Painel do TI
- [ ] Painel do Reporter

### 9. Teste de Responsividade
- [ ] Testar em mobile
- [ ] Testar em tablet
- [ ] Testar em desktop

### 10. Teste de Funcionalidades Especiais
- [ ] Sistema de busca
- [ ] Filtros de categoria
- [ ] Paginação
- [ ] Compartilhamento social