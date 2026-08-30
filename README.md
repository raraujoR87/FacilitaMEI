# FacilitaMEI

ERP financeiro simples para MEIs e autônomos brasileiros. A ideia central:
**zero fricção de entrada de dados** — o usuário manda a foto de uma nota
pelo WhatsApp (ou faz upload no painel) e o sistema categoriza tudo
automaticamente via IA.

## Módulos

- **Financeiro** — lançamento manual em poucos segundos ou por foto da nota,
  com categorização automática. Filtro por mês e saldo do período.
- **Vendas** — emissão de recibos e orçamentos numerados, vinculados a
  clientes e com data de vencimento.
- **Cobrança** — pendências ordenadas por vencimento, com código PIX
  copia-e-cola gerado na hora e link de cobrança pelo WhatsApp. Dar baixa
  numa cobrança lança a receita no financeiro automaticamente.
- **Clientes** — cadastro simples com o total já faturado por pessoa.
- **Relatório** — consolidação mensal por categoria, pronta para imprimir
  em PDF ou baixar em planilha para o contador.
- **Configurações** — dados do negócio, chave PIX e WhatsApp.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + TypeScript + Tailwind v4
- [Supabase](https://supabase.com) — Postgres, Auth e Storage, com RLS
  isolando os dados por usuário (cada MEI é seu próprio tenant)
- [API da Anthropic](https://docs.claude.com) (`claude-opus-5`, com visão e
  saída estruturada validada por schema) para leitura das notas
- PIX gerado localmente no padrão BR Code do Banco Central — sem
  intermediário financeiro; o dinheiro cai direto na conta do MEI
- Deploy contínuo via Vercel a partir da branch principal

## Rodando localmente

1. Copie `.env.example` para `.env.local` e preencha as chaves.
2. Crie um projeto no [Supabase](https://supabase.com) e rode as migrations
   de `supabase/migrations/` **na ordem** (SQL Editor ou CLI):
   `0001_init.sql` e depois `0002_nucleo.sql`.
   A `0002` cria o bucket `comprovantes` como privado — não é preciso
   criá-lo à mão.
3. Instale as dependências e suba o servidor:

   ```bash
   npm install
   npm run dev
   ```

O build de produção não exige nenhuma variável de ambiente; as chaves só
são lidas em tempo de requisição.

## Comandos

```bash
npm run dev     # servidor de desenvolvimento
npm run build   # build de produção
npm test        # testes de dinheiro, datas e geração de PIX
npm run lint    # eslint
```

## Estrutura

```
app/
  (auth)/login, /cadastro       — autenticação
  (dashboard)/dashboard         — resumo do mês e pendências
  (dashboard)/financeiro        — lançamentos manuais + leitura de notas
  (dashboard)/vendas            — recibos e orçamentos
  (dashboard)/cobranca          — pendências, PIX e cobrança por WhatsApp
  (dashboard)/clientes          — cadastro de clientes
  (dashboard)/relatorio         — consolidação mensal, impressão e planilha
  (dashboard)/configuracoes     — perfil do negócio e chave PIX
  actions/                      — Server Actions (toda mutação passa por aqui)
  api/notas/upload              — extração de nota via IA
  api/whatsapp/webhook          — recebimento de mensagens do WhatsApp
  api/relatorios/gerar          — dados do mês em JSON ou CSV
components/ui/                  — campos, botões e blocos de recibo
lib/
  formato.ts                    — moeda, datas e competência em pt-BR
  pix.ts                        — geração de BR Code (EMV) com CRC16
  whatsapp.ts                   — link wa.me com mensagem pronta
  ocr.ts                        — leitura da nota por visão
  auth.ts                       — guarda de sessão das Server Actions
  supabase/                     — clients (browser/server)
supabase/migrations/            — schema do banco com RLS
tests/                          — testes das regras de dinheiro e PIX
```

## Decisões que valem registro

- **Server Actions revalidam a sessão.** O `proxy.ts` protege a navegação,
  não os endpoints — toda action passa por `exigirUsuario()`.
- **Datas nunca passam pelo construtor `Date`.** `new Date("2026-08-01")` é
  meia-noite UTC, que no Brasil ainda é 31/07. Há teste cobrindo isso.
- **Valores são digitados em centavos, com máscara.** Em pt-BR, "1.500"
  é ambíguo; a máscara elimina a ambiguidade na origem.
- **Comprovantes ficam num bucket privado.** São documentos financeiros; o
  acesso é isolado por pasta de usuário nas policies do Storage.
- **A numeração de recibos é por usuário.** A `serial` global do schema
  inicial vazava o volume da plataforma entre contas.

## Próximos passos

- [ ] Baixar mídia de imagem recebida no webhook do WhatsApp e reaproveitar
      `lib/ocr.ts`
- [ ] Responder saldo e lançar nota direto pela conversa do WhatsApp
- [ ] Envio automático do lembrete de cobrança (hoje o link é manual)
- [ ] Tela de upgrade de plano (free → pro) e cobrança recorrente
- [ ] Exibir o comprovante da nota lida (URL assinada a partir do caminho
      salvo em `lancamentos.url_comprovante`)
