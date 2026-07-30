# Conexão gerenciada pelo Composio

Esta é a opção recomendada para conectar Facebook e Instagram sem criar um aplicativo próprio na Meta. O Correiro usa os Connect Links hospedados do Composio e precisa somente da chave do projeto.

## 1. Criar a chave

1. crie ou abra um projeto no Composio;
2. copie a API key do projeto;
3. não envie essa chave ao navegador nem a inclua em commits;
4. configure a variável no ambiente do servidor.

```env
COMPOSIO_API_KEY=sua-chave-do-projeto
COMPOSIO_CALLBACK_URL=http://localhost:3000/api/channels/composio/callback
COMPOSIO_FACEBOOK_VERSION=20260721_00
COMPOSIO_INSTAGRAM_VERSION=20260721_00
```

`COMPOSIO_BASE_URL` normalmente deve ficar vazio. Ele existe somente para ambientes que usam um endpoint compatível diferente.

As versões dos toolkits ficam fixadas para evitar mudanças silenciosas de contrato. Antes de atualizar, valide novamente descoberta, foto, vídeo/Reel e carrossel.

## 2. Iniciar a aplicação

Sem Docker:

```bash
pnpm install
pnpm migrate
pnpm seed
pnpm dev
```

Com Docker Compose, coloque `COMPOSIO_API_KEY` no arquivo `.env` da raiz ou defina a variável no shell antes de construir:

```powershell
$env:COMPOSIO_API_KEY="sua-chave-do-projeto"
docker compose up --build
```

Abra **Canais → Conectar canais → Composio**.

Facebook e Instagram aparecem como botões separados porque são toolkits e autorizações independentes no Composio.

## 3. O que é conectado

Facebook:

- somente Páginas administradas pela conta autorizada;
- publicação de texto, imagem e vídeo.

Instagram:

- somente contas Business ou Creator;
- publicação de imagem, vídeo/Reel e carrossel.

Perfis pessoais do Facebook, grupos e contas pessoais do Instagram não fazem parte deste fluxo.

## 4. Credenciais e privacidade

No modo Composio:

- o consentimento OAuth acontece em um Connect Link hospedado;
- os tokens da Meta ficam armazenados e são renovados pelo Composio;
- o MySQL do Correiro armazena o ID da connected account e os IDs públicos dos canais;
- a execução de cada ferramenta fixa explicitamente a connected account e a versão do toolkit;
- logs e tentativas guardam somente respostas sanitizadas e o `logId`, nunca tokens.

Ao desconectar o último canal local associado a uma connected account, o Correiro também solicita a exclusão dessa conexão no Composio. Uma falha externa de revogação não reativa o canal local e fica registrada apenas como aviso sanitizado.

## 5. Callback e mídia

O callback é enviado dinamicamente ao Connect Link. Em produção, use:

```env
APP_URL=https://app.exemplo.com
COMPOSIO_CALLBACK_URL=https://app.exemplo.com/api/channels/composio/callback
```

Para publicar imagens e vídeos, `APP_URL` também precisa ser uma origem HTTPS pública. A Meta, mesmo quando chamada por meio do Composio, precisa baixar a URL temporária assinada gerada pelo Correiro. `localhost` serve para desenvolver a interface e o OAuth no navegador, mas não é alcançável pelos servidores da Meta.

## 6. Diagnóstico

**A opção Composio aparece desabilitada**

Confirme que o processo recebeu `COMPOSIO_API_KEY` e reinicie a aplicação. O endpoint de provedores informa apenas se a chave está presente; ele nunca devolve o segredo.

**Nenhuma Página foi encontrada**

Confirme que a pessoa autorizada administra pelo menos uma Página do Facebook e concedeu as permissões solicitadas.

**Nenhuma conta do Instagram foi encontrada**

Use uma conta Business ou Creator. Contas pessoais não são aceitas pelo toolkit.

**A publicação não consegue acessar a mídia**

Configure `APP_URL` com HTTPS público e verifique se a URL assinada de `/api/media/public/:id/:expires/:signature` pode ser baixada externamente. A assinatura fica no caminho, sem query string, porque o Instagram recusa URLs de mídia com parâmetros de consulta.

**A conexão expirou ou foi revogada**

O worker marca o canal como expirado e a tela oferece **Reconectar**, abrindo um novo Connect Link.

## Referências oficiais

- [Connected Accounts e Connect Links](https://docs.composio.dev/reference/v3/api-reference/connected-accounts)
- [Autenticação e Connected Accounts](https://docs.composio.dev/docs/auth-configuration/connected-accounts)
- [Migração de initiate para link](https://docs.composio.dev/docs/auth-configuration/migrating-initiate-to-link)
- [Toolkit do Facebook](https://docs.composio.dev/toolkits/facebook)
- [Toolkit do Instagram](https://docs.composio.dev/toolkits/instagram)
- [Execução direta de ferramentas](https://docs.composio.dev/docs/tools-direct/executing-tools)
