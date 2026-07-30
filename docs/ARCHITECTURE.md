# Arquitetura do MVP

## Limites

O Correiro é um monólito modular Node.js:

- a SPA fica em `public/`;
- a API Express fica em `src/routes/`;
- o domínio operacional fica em `src/services/`;
- o MySQL é a fonte de verdade;
- arquivos ficam em storage protegido;
- o worker pode rodar embutido ou como processo separado.

Essa topologia reduz dependências no lançamento. A separação entre API e worker já permite escalar processos independentemente.

## Modelo de publicação

Uma `post` representa a intenção do usuário. Cada canal gera um `post_target`.

```text
post
├── target: Facebook
│   ├── legenda específica
│   ├── mídias específicas
│   └── job + tentativas
└── target: Instagram
    ├── legenda específica
    ├── mídias específicas
    └── job + tentativas
```

Uma falha do Instagram não bloqueia o Facebook. O estado geral é derivado:

- todos publicados → `published`;
- pelo menos um publicado e pelo menos um falhou → `partially_published`;
- todos falharam → `failed`;
- algum destino ainda está em fila/processamento → `processing`.

## Fila MySQL

`publication_jobs` é uma fila persistente. O worker:

1. recupera locks com mais de 10 minutos;
2. inicia uma transação;
3. busca um job vencido com `FOR UPDATE SKIP LOCKED`;
4. grava `locked_at` e `locked_by`;
5. cria uma `publication_attempt`;
6. chama o adaptador selecionado no canal (`composio`, `direct` ou `demo`);
7. conclui, agenda nova tentativa ou marca falha definitiva.

O backoff começa em 60 segundos e dobra até 15 minutos. O número padrão de tentativas é quatro.

## Idempotência

Cada job possui uma chave única. Além disso, o worker verifica `external_post_id` e o estado `published` antes de chamar a Meta. Um job repetido depois de uma resposta já persistida é concluído sem novo envio.

Ao repetir manualmente uma falha, um novo job recebe uma nova chave explícita e somente o destino selecionado volta para a fila.

## Falhas

O adaptador classifica:

- timeout, instabilidade e limites temporários → nova tentativa;
- token expirado → falha definitiva e canal `expired`;
- permissão revogada → falha definitiva e canal `insufficient_permission`;
- mídia/conteúdo rejeitado → falha definitiva;
- resposta inesperada → retentativa conservadora.

A tentativa grava:

- início e fim;
- número;
- resultado;
- código normalizado;
- mensagem amigável;
- erro técnico;
- resposta sanitizada.

Tokens nunca entram no payload de auditoria.

## Provedores de conexão

Cada `social_channel` registra seu `connection_provider`:

- `composio`: guarda `provider_connection_id` e executa ferramentas com versão fixada; tokens e renovação ficam no Composio;
- `direct`: guarda o token da Página cifrado em AES-256-GCM e chama o Graph API;
- `demo`: usa o mesmo worker e persistência, mas gera um resultado simulado.

O worker escolhe o adaptador a partir do canal já persistido. Isso permite que um workspace misture canais Composio e diretos sem alterar o contrato de posts, destinos, retentativas ou idempotência.

O início do Connect Link gera um estado opaco com validade curta em `provider_connection_requests`. O callback exige a mesma sessão, workspace, usuário e estado ainda não utilizado antes de aceitar a connected account. O banco nunca recebe a credencial OAuth gerenciada.

## Datas e fuso

O cliente envia data local e fuso IANA. O servidor converte para UTC antes de persistir. A interface volta a formatar em `workspace.time_zone`.

Isso permite mudar o fuso do navegador sem alterar silenciosamente os agendamentos existentes.

## Mídia

Uploads:

- recebem limite de tamanho no parser;
- são identificados por assinatura de bytes, não apenas pelo nome;
- recebem nome interno aleatório;
- ficam fora da pasta pública;
- são servidos mediante sessão;
- usam URL temporária assinada quando a Meta precisa baixar o arquivo.

Em produção, recomenda-se substituir o filesystem por storage de objetos e upload direto com URL assinada. A interface e o modelo já usam IDs de mídia, então essa troca não altera o contrato de posts.

## Segurança e privacidade

- senha com `scrypt` e salt aleatório;
- sessão opaca com somente o hash no banco;
- cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- CSRF em mutações autenticadas;
- rate limit nos fluxos de credenciais;
- AES-256-GCM para tokens da conexão direta;
- somente IDs de conexão, sem tokens sociais, para canais Composio;
- escopo por associação ao workspace;
- exportação em JSON;
- exclusão com confirmação de senha, revogação de sessões e anonimização.

## Próximos passos de escala

- mover mídia para S3, R2 ou equivalente;
- separar múltiplos workers;
- adicionar uma tabela de outbox para e-mail;
- coletar métricas em job próprio;
- criar webhooks da Meta com verificação de assinatura;
- armazenar segredos em KMS/Secrets Manager;
- adicionar réplica de leitura para analytics;
- particionar auditoria e tentativas por retenção.
