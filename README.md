# 📍 RotaMídia — Sistema de Gestão de Ordens de Serviço e Operações de Campo

> **Plataforma moderna, reativa e offline-first para gestão de ordens de serviço (OS) e manutenção de mobiliário urbano / publicidade out-of-home (OOH).**

---

## 🚀 Sobre o Projeto

O **RotaMídia** (Campo Digital) é uma solução integrada desenvolvida para otimizar o fluxo de ponta a ponta entre a equipe de gestão/liderança e os técnicos que atuam em campo. 

A plataforma conta com:
1. **Painel Web Administrativo**: Gestão de ordens de serviço, atribuição de rotas, acompanhamento do progresso em tempo real, importação em lote de planilhas e relatórios de execução.
2. **Aplicativo de Campo PWA (Mobile)**: Interface mobile otimizada para técnicos com operação **Offline-First**, checklist interativo de atividades, captura fotográfica com geolocalização e acesso direto via link com token criptografado (sem necessidade de login/senha para o técnico).

---

## 🛠️ Tecnologias e Stack

| Camada | Tecnologia |
|---|---|
| **Framework Web** | [Next.js 14](https://nextjs.org/) (App Router, React 18, TypeScript) |
| **Estilização & UI** | [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Backend & Realtime DB** | [Convex](https://www.convex.dev/) (Banco em tempo real com mutations/queries reativas) |
| **Autenticação & Acessos** | [Clerk](https://clerk.com/) (Autenticação corporativa com aprovação de líderes) |
| **PWA & Modo Offline** | Service Workers, Cache Storage API, IndexedDB / Sincronização em background |
| **E-mails Transacionais** | [Resend API](https://resend.com/) (Envio de links e notificações de OS) |
| **Manipulação de Dados** | [SheetJS (XLSX)](https://sheetjs.com/) (Importação/Exportação de planilhas) |

---

## ✨ Principais Funcionalidades

### 🖥️ Painel Administrativo (Gestão)
- **Dashboard com Métricas em Tempo Real**: Total de ordens, taxas de conclusão, pontos executados e status de equipe.
- **Gestão de Ordens de Serviço**:
  - Criação manual ou importação massiva via planilhas `.xlsx` / `.csv`.
  - Divisão automática de pontos de atendimento por OS.
  - Atribuição direta para técnicos com definição de prazos.
- **Gestão de Técnicos**:
  - Cadastro individual ou importação em lote via planilha Excel.
  - Histórico de atribuições e ordens concluídas por técnico.
- **Governança & Controle de Acessos**:
  - Restrição de cadastro por domínio institucional corporativo.
  - Fluxo de aprovação de novos líderes por Super Administradores.
- **Relatórios e Exportação**:
  - Exportação de dados consolidados e geração de relatórios operacionais.

### 📱 Aplicação de Campo (Técnico Mobile - PWA)
- **Acesso Descomplicado**: Acesso via token seguro gerado automaticamente e enviado por e-mail, sem atrito de senhas.
- **Operação Offline-First**: O técnico continua trabalhando e preenchendo relatórios mesmo em locais sem sinal 3G/4G/5G; os dados são sincronizados assim que a conexão for restabelecida.
- **Checklist Operacional & Registro Fotográfico**:
  - Checklist item por item das tarefas a serem realizadas no ponto.
  - Captura e upload de fotos comprobatórias do serviço executado.
- **Instalação PWA**: Pode ser instalado diretamente na tela inicial do celular como um aplicativo nativo.

---

## 📁 Estrutura do Projeto

```plaintext
├── README.md                      # Documentação principal do projeto
├── .gitignore                     # Proteção de credenciais, dados e dependências
├── tecnicos_modelo_exemplo.csv    # Modelo de exemplo para importação de técnicos
└── app/                           # Aplicação Next.js + Convex
    ├── .env.example               # Exemplo de configuração de variáveis de ambiente
    ├── package.json               # Dependências do projeto
    ├── next.config.js             # Configurações do Next.js
    ├── tailwind.config.ts         # Configuração de design system e cores
    ├── convex/                    # Backend e schema do banco de dados (Convex)
    │   ├── schema.ts              # Definição das tabelas (OS, pontos, técnicos, etc.)
    │   ├── auth.ts                # Validação de regras e controle de acesso
    │   ├── email.ts               # Integração com Resend para envio de e-mails
    │   ├── ordensServico.ts       # Queries e mutations de Ordens de Serviço
    │   ├── pontos.ts              # Gestão dos pontos de atendimento da OS
    │   ├── tecnicos.ts            # Gestão da base de técnicos
    │   └── relatorios.ts          # Consolidação de métricas e relatórios
    ├── public/                    # Ícones, manifest PWA, fontes e logos
    │   ├── manifest.json          # Manifesto PWA
    │   └── sw.js                  # Service Worker com estratégia de cache offline
    └── src/
        ├── app/                   # Rotas do Next.js App Router
        │   ├── admin/             # Módulo do Painel Administrativo
        │   ├── campo/             # Módulo Mobile PWA do Técnico (/campo/[token])
        │   ├── login/             # Página de login administrativo
        │   └── cadastro/          # Página de cadastro de novos líderes
        ├── components/            # Componentes reutilizáveis (modais, cards, tabelas)
        └── lib/                   # Utilitários, cliente Convex e lógica offline
```

---

## ⚙️ Como Executar Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- Conta no [Clerk](https://clerk.com/) e no [Convex](https://convex.dev/)

### 2. Clonar o Repositório
```bash
git clone https://github.com/OnaiZk/RotaMidia.git
cd RotaMidia/app
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Configurar as Variáveis de Ambiente
Copie o arquivo de exemplo e preencha com suas credenciais:
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local`:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/cadastro
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/admin
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/admin

# Convex Backend
CONVEX_DEPLOYMENT=dev:...
NEXT_PUBLIC_CONVEX_URL=https://<seu-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<seu-deployment>.convex.site
```

> **Configuração de Envio de E-mails (Gmail SMTP / Nodemailer)**:
> No Convex, defina o usuário e a senha de aplicativo de 16 dígitos com os comandos:
> ```bash
> npx convex env set SMTP_USER seuemail@gmail.com
> npx convex env set SMTP_PASS "gpir ruki qxjj yzoc"
> ```

### 5. Iniciar o Ambiente de Desenvolvimento
Em terminais separados (ou simultaneamente):

**Terminal 1 — Backend Convex (Sincronização em tempo real):**
```bash
npm run convex:dev
```

**Terminal 2 — Frontend Next.js:**
```bash
npm run dev
```

Acesse no navegador:
- **Painel Administrativo**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Login**: [http://localhost:3000/login](http://localhost:3000/login)

---

## 🔒 Segurança e Privacidade (LGPD)

- **Proteção de Credenciais**: Chaves de API e segredos nunca são rastreados no Git.
- **Sanitização de Dados**: O repositório não inclui planilhas ou dados reais de colaboradores/técnicos. Um modelo padrão (`tecnicos_modelo_exemplo.csv`) é disponibilizado para testes e homologação.
- **Acesso Sem Senha com Expiração**: Os links de campo utilizam tokens únicos e validados diretamente pelo backend Convex.

---

## 📄 Licença

Este projeto é desenvolvido para uso corporativo interno e gestão operacional de mídia exterior.
