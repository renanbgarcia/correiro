# Configuração da Meta

Este documento cobre a opção avançada com aplicativo próprio. Para conectar contas reais sem `META_APP_ID` e `META_APP_SECRET`, use a [conexão gerenciada pelo Composio](COMPOSIO_SETUP.md).

O modo demo funciona sem credenciais. Para usar a integração direta, configure um aplicativo próprio no [Meta for Developers](https://developers.facebook.com/).

## Produtos e callback

No aplicativo da Meta:

1. configure Facebook Login;
2. habilite a API do Instagram com Facebook Login;
3. cadastre a URL exata configurada em `META_REDIRECT_URI`;
4. adicione os domínios da aplicação;
5. use HTTPS fora do ambiente local.

Exemplo:

```env
META_APP_ID=123456789
META_APP_SECRET=segredo-do-aplicativo
META_GRAPH_VERSION=vXX.X
META_REDIRECT_URI=https://app.exemplo.com/api/channels/meta/callback
META_DEMO_MODE=false
APP_URL=https://app.exemplo.com
```

Defina `META_GRAPH_VERSION` para a versão ativa escolhida no aplicativo. Não dependa do valor de exemplo do repositório para uma implantação futura.

## Permissões solicitadas

O fluxo atual solicita:

- `pages_show_list`;
- `pages_manage_posts`;
- `pages_read_engagement`;
- `read_insights`;
- `instagram_basic`;
- `instagram_content_publish`.

Confirme na documentação e no painel da Meta quais permissões exigem App Review e verificação empresarial para o seu caso. Permissões e formatos podem mudar entre versões do Graph API.

## Descoberta de canais

Após o OAuth, o Correiro consulta as Páginas administradas e grava:

- Página do Facebook;
- token da Página cifrado;
- tarefas/permissões;
- conta profissional do Instagram associada, quando houver;
- expiração e estado da conexão.

Perfis pessoais, grupos e contas pessoais do Instagram não entram no escopo.

## Publicação

Facebook:

- texto → `/{page-id}/feed`;
- imagem → `/{page-id}/photos`;
- vídeo → `/{page-id}/videos`.

Instagram:

1. cria container em `/{ig-user-id}/media`;
2. espera o processamento da mídia;
3. publica em `/{ig-user-id}/media_publish`;
4. consulta o permalink.

Carrosséis criam um container por item e depois um container pai.

## URL da mídia

A Meta precisa conseguir baixar o arquivo por uma URL HTTPS pública. O Correiro gera URLs temporárias assinadas em `/api/media/public/:id/:expires/:signature`, sem query string para manter compatibilidade com a publicação do Instagram.

Em desenvolvimento local, a Meta não alcança `localhost`. Para testes reais:

- use um domínio HTTPS de staging; ou
- exponha temporariamente o servidor por um túnel seguro e atualize `APP_URL`.

Nunca use links permanentes sem assinatura para conteúdo privado.

## App Review

Antes da liberação pública:

- grave o vídeo exigido para cada permissão;
- explique o uso de cada permissão;
- forneça uma conta de teste;
- conclua verificação empresarial quando aplicável;
- valide Facebook e Instagram separadamente;
- teste expiração, remoção de permissão e desconexão.

## Checklist de publicação real

- [ ] `NODE_ENV=production`
- [ ] HTTPS ativo
- [ ] `META_DEMO_MODE=false`
- [ ] segredos longos e distintos
- [ ] callback idêntico ao painel da Meta
- [ ] `APP_URL` público e HTTPS
- [ ] storage acessível pela Meta
- [ ] Página de teste conectada
- [ ] Instagram Business/Creator associado à Página
- [ ] permissões aprovadas
- [ ] formato de imagem validado
- [ ] vídeo/Reel validado
- [ ] carrossel validado
- [ ] alerta de token expirado testado
- [ ] retentativa e idempotência verificadas
