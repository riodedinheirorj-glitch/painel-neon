# Configuração do Administrador

## Aplicação Web DeliveryFlow

Sistema completo de gerenciamento de ordens de entrega com autenticação e painel administrativo.

---

## 🚀 Funcionalidades Implementadas

### ✅ Páginas de Usuário

1. **Login** (`/auth`)
   - Acesso com email e senha
   - Validação de credenciais
   - Redirecionamento automático após login

2. **Cadastro** (`/auth`)
   - Criação de nova conta com email e senha
   - Campo de nome completo
   - Auto-confirmação de email habilitada (sem necessidade de verificar email)

3. **Recuperar Senha** (`/auth`)
   - Funcionalidade de reset de senha via email
   - Interface intuitiva

### ✅ Dashboard Admin (`/admin`)

- **Estatísticas**:
  - Total de usuários cadastrados
  - Total de downloads realizados
  
- **Tabela de Usuários**:
  - Lista completa de usuários
  - Número de downloads por usuário
  - Emails e nomes

### ✅ Sistema de Segurança

- Autenticação completa com Lovable Cloud
- Row Level Security (RLS) configurado
- Roles separados em tabela dedicada (segurança contra privilege escalation)
- Função `has_role()` com security definer

---

## 📋 Como Criar o Usuário Admin

### ✅ Método Recomendado (Mais Simples)

1. **Acesse a aplicação** em `/auth` e crie uma conta normalmente com qualquer email e senha

2. **Acesse o backend** (clique no botão "Backend" ou "Cloud" na interface)

3. **Vá para a tabela `profiles`** e copie o `id` do seu usuário (é um UUID)

4. **Execute este SQL no SQL Editor**:

```sql
-- Substitua 'SEU_ID_AQUI' pelo UUID que você copiou
INSERT INTO user_roles (user_id, role)
VALUES ('SEU_ID_AQUI', 'admin'::app_role);
```

5. **Pronto!** Faça logout e login novamente - você verá o botão "Admin" no canto superior direito

### 💡 Método Alternativo: Promover por Email

Se preferir, pode usar este SQL que busca pelo email:

```sql
-- Substitua 'seu@email.com' pelo email que você usou no cadastro
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM profiles
WHERE email = 'seu@email.com';
```

### ⚡ Criação Rápida de Admin Padrão

Se quiser criar um usuário `admin@deliveryflow.com` / `admin`:

1. Crie a conta normalmente em `/auth` com:
   - Email: `admin@deliveryflow.com`
   - Senha: `admin` (ou a que preferir)

2. Execute o SQL:

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM profiles
WHERE email = 'admin@deliveryflow.com';
```

**⚠️ IMPORTANTE**: Mude essa senha imediatamente se for usar em produção!

---

## 🔐 Segurança Implementada

### Tabelas Criadas

1. **profiles**: Informações dos usuários
2. **user_roles**: Roles dos usuários (separado por segurança)
3. **downloads**: Rastreamento de downloads por usuário

### Políticas RLS

- Usuários só podem ver seus próprios downloads
- Admins podem ver todos os downloads e estatísticas
- Sistema de roles com function security definer

### Triggers

- Criação automática de perfil ao registrar novo usuário
- Atribuição automática de role "user" para novos cadastros

---

## 🎯 Fluxo de Uso

### Para Usuários Normais:

1. Acessar `/auth` e criar conta
2. Fazer login
3. Usar o sistema normalmente
4. Downloads são rastreados automaticamente

### Para Administrador:

1. Fazer login com credenciais de admin
2. Ver botão "Admin" no canto superior direito
3. Acessar dashboard com estatísticas completas
4. Visualizar todos os usuários e seus downloads

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Lovable Cloud (Supabase)
- **Autenticação**: Email/Senha com auto-confirmação
- **Banco de Dados**: PostgreSQL com RLS
- **Edge Functions**: Deno (para criar admin)

---

## 📝 Notas Importantes

1. ⚠️ **ATENÇÃO**: Após criar o admin, **mude a senha** imediatamente em produção!
2. A aplicação está configurada com auto-confirmação de email para facilitar testes
3. Todos os dados são persistentes no banco de dados
4. Sistema pronto para uso imediato ("out-of-the-box")

---

## 🔄 Próximos Passos Recomendados

Se for usar em produção:

1. Desabilitar auto-confirmação de email nas configurações de autenticação
2. Mudar senha do admin padrão
3. Configurar domínio personalizado
4. Adicionar mais validações de segurança conforme necessário

---

## 📞 Suporte

Para dúvidas ou problemas, acesse o backend da aplicação e verifique os logs nas seções de Auth e Database.
