# Correiro Social

MVP web para administrar, agendar e acompanhar publicações em Páginas do Facebook e contas profissionais do Instagram.

O caminho principal já está implementado:

`conta → workspace → canal → conteúdo multicanal → agendamento → fila durável → resultado por canal → analytics`

## Rodar com Docker

Pré-requisito: Docker Desktop com Docker Compose.

```bash
docker compose up --build
```

Depois, abra [http://localhost:3000](http://localhost:3000).

Conta de demonstração:

- E-mail: `demo@correiro.local`
- Senha: `Demo@123`

O primeiro boot aplica as migrações e cria um workspace completo com canais, mídia, rascunhos, publicações agendadas, publicadas e uma publicação parcialmente concluída.

Para encerrar:

```bash
docker compose down
```

Os dados do MySQL e da biblioteca de mídia permanecem em volumes. Para apagar também esses volumes, use `docker compose down -v` somente quando quiser reiniciar todos os dados.

## Rodar sem Docker

Requisitos:

- Node.js 22 ou superior
- MySQL 8.0 ou superior
- pnpm 11.18.0

```bash
cp .env.example .env
pnpm install
pnpm migrate
pnpm seed
pnpm dev
```

O worker roda dentro do servidor quando `WORKER_INLINE=true`. Em uma implantação com mais tráfego, use:

```bash
WORKER_INLINE=false pnpm start
pnpm worker
```

## O que está incluído

- Cadastro, confirmação de e-mail, login, logout e recuperação de senha.
- Senhas derivadas com `scrypt`; sessões opacas em cookies `HttpOnly`.
- Proteção CSRF, cabeçalhos seguros, rate limit de autenticação e isolamento por workspace.
- Workspace com fuso IANA, preferências de e-mail e pausa global da fila.
- OAuth gerenciado pelo Composio sem exigir App ID ou App Secret da Meta.
- Integração direta com aplicativo próprio da Meta como opção avançada.
- Descoberta de Páginas e contas profissionais, com provedor visível por canal.
- Tokens diretos cifrados em AES-256-GCM; no Composio, o banco guarda somente o ID da conexão.
- Logs sanitizados sem credenciais completas.
- Canais de demonstração para validação sem credenciais externas.
- Compositor com texto compartilhado, versão por canal e mídia por destino.
- Imagem, vídeo/Reel e carrossel básico; validação específica por plataforma.
- Upload protegido, detecção por assinatura do arquivo, thumbnail e biblioteca reutilizável.
- Rascunho, autosave, publicação imediata, agendamento, reagendamento, duplicação e cancelamento.
- Calendários mensal e semanal com arrastar e soltar.
- Lista operacional de publicações e detalhe por destino.
- Worker com locks `FOR UPDATE SKIP LOCKED`, recuperação de locks abandonados, backoff e idempotência.
- Publicação parcial e repetição somente do destino que falhou.
- Notificações internas e e-mail para eventos críticos quando SMTP estiver configurado.
- Analytics essenciais e transparência sobre métricas indisponíveis.
- Painel administrativo para saúde da fila, usuários, publicações, tentativas e reprocessamento.
- Auditoria, exportação de dados e exclusão/anonimização de conta.

## Modo de demonstração

`META_DEMO_MODE=true` habilita canais simulados. Publicações nesses canais são processadas pelo mesmo worker e gravadas nas mesmas tabelas da integração real.

Para demonstrar publicação parcial, inclua `#simularfalha` na legenda e selecione Facebook + Instagram. O Facebook será concluído e a primeira tentativa do Instagram falhará de forma permanente. Use **Repetir** apenas no destino com falha; a repetição será concluída para comprovar a recuperação seletiva.

O modo de demonstração é recusado pela validação de configuração quando `NODE_ENV=production`.

## Integração real: Composio ou Meta direta

O caminho mais simples é o Composio. Crie uma chave de projeto e configure:

```env
COMPOSIO_API_KEY=sua-chave-do-projeto
COMPOSIO_CALLBACK_URL=http://localhost:3000/api/channels/composio/callback
```

Não é necessário preencher `META_APP_ID` nem `META_APP_SECRET`. Na tela **Canais**, escolha **Composio** e autorize Facebook e Instagram separadamente. O fluxo usa Connect Links hospedados e mantém as credenciais sociais no Composio.

Com Docker Compose, salve a chave no arquivo `.env` da raiz ou defina a variável antes do comando:

```powershell
$env:COMPOSIO_API_KEY="sua-chave-do-projeto"
docker compose up --build
```

Consulte [docs/COMPOSIO_SETUP.md](docs/COMPOSIO_SETUP.md) para configuração, segurança, versões fixadas e limitações de contas.

Se preferir usar um aplicativo próprio, consulte [docs/META_SETUP.md](docs/META_SETUP.md). Em resumo:

1. Crie um aplicativo em Meta for Developers.
2. Configure Facebook Login e o produto da API do Instagram.
3. Cadastre exatamente a `META_REDIRECT_URI`.
4. Preencha `META_APP_ID`, `META_APP_SECRET` e a versão do Graph API.
5. Use storage acessível por HTTPS para que a Meta consiga buscar imagens e vídeos.
6. Passe por verificação empresarial e App Review para as permissões públicas.

Sem App Review, contas reais fora das funções autorizadas do aplicativo próprio podem não concluir o fluxo direto. Isso não impede o modo Composio nem o modo demo.

## Arquitetura

```text
Browser / SPA
     │
     ▼
Express API ───────────────► MySQL 8
     │                         ├─ usuários e workspaces
     │                         ├─ posts e destinos
     │                         ├─ jobs e tentativas
     │                         └─ métricas e auditoria
     │
     ├─► armazenamento protegido de mídia
     │
     └─► worker durável ─────► adaptador do provedor
              │                    ├─► Composio ─► Meta
              │                    └─► Meta Graph API direta
              └─ um job independente por canal
```

Detalhes de concorrência, retentativas e status estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

| Comando | Uso |
| --- | --- |
| `pnpm dev` | Servidor com reload |
| `pnpm start` | Servidor HTTP |
| `pnpm worker` | Worker separado |
| `pnpm migrate` | Migrações MySQL |
| `pnpm seed` | Dados de demonstração |
| `pnpm test` | Testes unitários |
| `pnpm check` | Sintaxe e testes |

## Produção

Antes de expor a aplicação:

- use HTTPS no proxy reverso;
- gere segredos independentes e longos;
- desative `META_DEMO_MODE`;
- use URLs públicas HTTPS para mídia destinada à Meta;
- mantenha as versões dos toolkits do Composio fixadas e atualize-as somente após teste;
- configure SMTP;
- execute servidor e workers como processos separados;
- configure backup do MySQL e retenção da mídia;
- conecte logs JSON a um agregador e alertas à taxa de falhas;
- para integração direta, faça a verificação empresarial e a revisão das permissões da Meta;
- valide formatos reais em contas de teste do Facebook e Instagram.

O projeto comprova o fluxo funcional localmente. Publicação real em produção continua condicionada a uma conexão ativa, às permissões concedidas e às regras das contas do Facebook e Instagram.
