# Regras para Desenvolvimento com IA

Este documento descreve a pilha de tecnologia utilizada no projeto DeliveryFlow e as diretrizes para o uso de bibliotecas específicas. O objetivo é manter a consistência, a manutenibilidade e a performance da aplicação.

---

## 🚀 Pilha de Tecnologia

O projeto DeliveryFlow é construído com as seguintes tecnologias:

*   **Frontend Framework**: React (com TypeScript)
*   **Build Tool**: Vite
*   **Linguagem**: TypeScript
*   **Estilização**: Tailwind CSS
*   **Componentes UI**: shadcn/ui (baseado em Radix UI)
*   **Roteamento**: React Router DOM
*   **Backend as a Service (BaaS)**: Supabase (para autenticação, banco de dados e funções de borda)
*   **Gerenciamento de Estado/Dados**: Tanstack Query (para requisições assíncronas e cache de dados)
*   **Validação de Esquemas**: Zod
*   **Processamento de Arquivos**: `xlsx` (para Excel) e `papaparse` (para CSV)
*   **Ícones**: Lucide React
*   **Notificações**: Sonner (para toasts)
*   **Manipulação de Datas**: date-fns

---

## 📋 Regras de Uso de Bibliotecas

Para garantir a padronização e evitar redundâncias, siga estas regras ao desenvolver ou modificar o código:

*   **Componentes de UI**:
    *   **Prioridade**: Sempre utilize os componentes da biblioteca `shadcn/ui`.
    *   **Customização**: Se um componente `shadcn/ui` não atender às necessidades ou precisar de customização, crie um **novo componente** em `src/components/` e estilize-o com Tailwind CSS. **Nunca modifique os arquivos originais dos componentes `shadcn/ui`**.
*   **Estilização**:
    *   Utilize **exclusivamente Tailwind CSS** para toda a estilização. Evite estilos inline ou arquivos CSS separados, exceto para estilos globais definidos em `src/index.css`.
*   **Gerenciamento de Estado**:
    *   Para estado local de componentes, use `useState` e `useReducer` do React.
    *   Para gerenciamento de estado global ou de servidor (data fetching, cache, sincronização), utilize `Tanstack Query`.
*   **Roteamento**:
    *   Utilize `react-router-dom` para todas as rotas da aplicação. As rotas principais devem ser definidas em `src/App.tsx`.
*   **Backend, Autenticação e Banco de Dados**:
    *   Todas as interações com o backend (autenticação, queries de banco de dados, real-time) devem ser feitas através do cliente Supabase (`@supabase/supabase-js`).
    *   Funções auxiliares para Supabase devem ser colocadas em `src/lib/supabase-helpers.ts`.
*   **Validação de Formulários e Dados**:
    *   Utilize `Zod` para definir esquemas de validação para formulários e qualquer entrada de dados.
*   **Processamento de Arquivos**:
    *   Para leitura e escrita de arquivos Excel (`.xlsx`, `.xls`), utilize a biblioteca `xlsx`.
    *   Para leitura e escrita de arquivos CSV (`.csv`), utilize a biblioteca `papaparse`.
*   **Ícones**:
    *   Utilize `lucide-react` para todos os ícones na aplicação.
*   **Notificações**:
    *   Para exibir mensagens de feedback ao usuário (toasts), utilize a biblioteca `sonner`.
*   **Manipulação de Datas**:
    *   Para qualquer operação ou formatação de datas, utilize `date-fns`.
*   **Funções de Utilidade**:
    *   Funções utilitárias gerais e de propósito amplo devem ser colocadas em `src/lib/utils.ts`.