# FacilitaMEI

ERP financeiro simples para MEIs e autônomos brasileiros. A ideia central:
**zero fricção de entrada de dados** — o usuário manda a foto de uma nota
pelo WhatsApp (ou faz upload no painel) e o sistema categoriza tudo
automaticamente via IA.

## Módulos

- **Financeiro**: lançamentos de receita/despesa com categorização automática
  via IA (upload de foto/PDF de nota).
- **Vendas**: emissão simples de recibos e orçamentos.
- **Cobrança**: controle de recebimentos pendentes, com lembrete automático
  planejado via WhatsApp.
- **Relatório**: endpoint que consolida o mês para exportação (PDF/Excel a
  implementar na camada de apresentação).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind
- [Supabase](https://supabase.com) — Postgres, Auth e Storage, com RLS
  isolando os dados por usuário (cada MEI é seu próprio tenant)
- [Anthropic API](https://docs.claude.com) (Claude com visão) para
  extração/categorização das notas fiscais
- Deploy contínuo via Vercel a partir da branch principal

## Rodando localmente

1. Copie `.env.example` para `.env.local` e preencha as chaves.
2. Crie um projeto no [Supabase](https://supabase.com) e rode a migration em
   `supabase/migrations/0001_init.sql` (SQL Editor ou CLI).
3. Crie um bucket de Storage público chamado `comprovantes`.
4. Instale as dependências e suba o servidor:

   ```bash
   npm install
   npm run dev
   ```

## Estrutura

```
app/
  (auth)/login, /cadastro       — autenticação
  (dashboard)/dashboard         — visão geral com resumo do mês
  (dashboard)/financeiro        — lançamentos + upload de notas
  (dashboard)/vendas            — orçamentos e recibos
  (dashboard)/cobranca          — recebimentos pendentes
  api/notas/upload              — extração de nota via IA
  api/whatsapp/webhook          — recebimento de mensagens do WhatsApp
  api/relatorios/gerar          — dados consolidados do mês
lib/supabase/                   — clients (browser/server)
supabase/migrations/            — schema do banco com RLS
```

## Próximos passos

- [ ] Baixar mídia de imagem recebida no webhook do WhatsApp e reaproveitar
      a extração de `/api/notas/upload`
- [ ] Geração de PDF/Excel formatado no endpoint de relatório
- [ ] Integração de cobrança automática (lembrete + link de PIX)
- [ ] Tela de configuração do plano (free → pro)
