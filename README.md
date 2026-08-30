# AgilizeMei

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
- **Plano e cobrança** — consumo de notas do mês e contratação do Pro.
- **Operação** (`/admin`) — back-office do dono do SaaS: todos os tenants com
  métricas de uso, linha do tempo de acesso, contas travadas no cadastro,
  troca de plano e envio de redefinição de senha.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + TypeScript + Tailwind v4
- [Supabase](https://supabase.com) — Postgres, Auth e Storage, com RLS
  isolando os dados por usuário (cada MEI é seu próprio tenant)
- Leitura das notas por visão com **dois provedores intercambiáveis**:
  [Anthropic](https://docs.claude.com) (`claude-opus-5`) e
  [Google Gemini](https://ai.google.dev) (`gemini-2.5-flash`), ambos com
  saída estruturada validada pelo mesmo schema
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
  (admin)/admin                 — back-office: tenants, eventos, problemas
  actions/                      — Server Actions (toda mutação passa por aqui)
  api/notas/upload              — extração de nota via IA
  api/whatsapp/webhook          — recebimento de mensagens do WhatsApp
  api/relatorios/gerar          — dados do mês em JSON ou CSV
components/ui/                  — campos, botões e blocos de recibo
lib/
  formato.ts                    — moeda, datas e competência em pt-BR
  pix.ts                        — geração de BR Code (EMV) com CRC16
  whatsapp.ts                   — link wa.me com mensagem pronta
  admin.ts                      — guarda e tipos do back-office
  ocr/                          — leitura da nota por visão
    schema.ts                   — contrato Zod compartilhado pelos provedores
    claude.ts, gemini.ts        — implementações
    index.ts                    — escolha do provedor e reserva automática
  auth.ts                       — guarda de sessão das Server Actions
  supabase/                     — clients (browser/server)
supabase/migrations/            — schema do banco com RLS
tests/                          — testes das regras de dinheiro e PIX
```

## Escolhendo a IA que lê as notas

O provedor é definido por `IA_PROVEDOR` (`claude`, o padrão, ou `gemini`). Se
o preferido falhar por indisponibilidade — sem chave, fora do ar, cota
estourada — o outro assume automaticamente, desde que também tenha chave. Uma
foto ilegível, ao contrário, interrompe na hora: trocar de provedor não
melhora uma imagem borrada.

Basta uma das duas chaves para o recurso funcionar. Configurar as duas compra
tolerância a falha de um fornecedor — o que importa quando a leitura da nota é
a promessa central do produto.

Os modelos podem ser sobrescritos por `CLAUDE_MODELO` e `GEMINI_MODELO`, útil
para trocar de faixa de preço sem mexer no código.

## Back-office de operação

`/admin` é o painel de quem opera o SaaS. Duas restrições moldaram o desenho:

**Nenhuma service role key no app.** Um segredo que ignora RLS dentro do Next
é ponto único de falha. A fronteira fica no banco: funções `security definer`
que checam `eh_administrador()` na primeira linha do corpo. A autorização não
depende do código da tela — um cliente comum chamando
`/rest/v1/rpc/admin_lista_tenants` recebe "acesso restrito", não dados.

**O operador não vê o conteúdo financeiro dos clientes.** As funções devolvem
contagens, datas e estado de cadastro; descrição, valor e fornecedor de
lançamento nunca saem. A RLS das tabelas de conteúdo continua fechada até para
administradores — verificado: um admin lê zero linhas de `lancamentos`.

Reset de senha envia o link para o e-mail do próprio cliente. O operador
destrava o acesso sem nunca poder se passar pelo cliente.

Para promover a primeira pessoa (a conta precisa já existir):

```sql
insert into public.administradores (user_id, observacao)
select id, 'fundador' from auth.users where email = 'voce@exemplo.com';
```

Não há caminho pela API para virar administrador: a tabela tem policy só de
leitura do próprio registro.

## Comercial

A landing em `/` é a página de vendas: dor, como funciona, módulos, preços,
perguntas frequentes e chamada final. Os preços saem de `lib/planos.ts`, que
é a fonte única — a landing, a tela de plano dentro do app e o limite aplicado
no upload de notas leem do mesmo lugar.

A contratação usa **link estático de pagamento** (`NEXT_PUBLIC_LINK_ASSINATURA_MENSAL`
e `..._ANUAL`). Asaas, Mercado Pago e Stripe oferecem esse tipo de link, o que
permite vender sem integrar API nem tratar webhook. O cliente paga pelo link e
o plano é liberado em `/admin`. Quando o volume justificar, vale trocar por
integração com webhook para liberar sozinho.

Sem link configurado, a tela cai no contato por WhatsApp
(`NEXT_PUBLIC_WHATSAPP_CONTATO`); sem nenhum dos dois, ela diz exatamente qual
variável falta em vez de mostrar um botão quebrado.

## No celular

O acesso principal é pelo telefone, então a navegação muda de forma:

- **Celular** — barra fixa no rodapé com cinco ícones (Início, Financeiro,
  Vendas, Cobrança, Mais). Fica no rodapé porque é onde o polegar alcança com
  o aparelho numa mão só. Os alvos de toque medem 75×55px.
- **Desktop** — barra lateral com ícone e rótulo.

Os itens menos frequentes (Clientes, Relatório, Plano, Configurações, Sair)
ficam na gaveta "Mais", que abre de baixo para cima.

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
- **Os requisitos de senha aparecem enquanto a pessoa digita.** A lista vive
  em `lib/senha.ts` e precisa espelhar Authentication → Providers → Email no
  Supabase: exibir uma regra que o servidor não aplica corrói a confiança no
  aviso.
- **Um schema Zod serve os dois provedores de IA.** Vira formato estruturado
  no Claude e JSON Schema no Gemini, e valida as duas respostas — trocar de
  provedor não muda o que o resto do app recebe.

## Próximos passos

- [ ] Baixar mídia de imagem recebida no webhook do WhatsApp e reaproveitar
      `lib/ocr.ts`
- [ ] Responder saldo e lançar nota direto pela conversa do WhatsApp
- [ ] Envio automático do lembrete de cobrança (hoje o link é manual)
- [ ] Tela de upgrade de plano (free → pro) e cobrança recorrente
- [ ] Exibir o comprovante da nota lida (URL assinada a partir do caminho
      salvo em `lancamentos.url_comprovante`)
