# Web Push do Teenman

O código envia notificações nativas em navegadores compatíveis no Android/PWA e Windows. O Service Worker recebe push sem uma aba aberta; a entrega ainda depende da conexão, das permissões do navegador/sistema e das restrições de bateria. Fechar uma aba é compatível; forçar a parada do navegador ou desativá-lo em segundo plano pode impedir a entrega.

## 1. Variáveis na Vercel

As chaves VAPID e um segredo separado de webhook foram gerados uma única vez no `.env.local`. Preserve o mesmo par em todos os deploys: trocar o par exige reativar os dispositivos.

Em Vercel → projeto Teenman → Settings → Environment Variables, copie os valores locais de:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: chave pública; entra na build do navegador.
- `VAPID_PRIVATE_KEY`: chave privada, somente servidor.
- `PUSH_WEBHOOK_SECRET`: segredo aleatório, somente servidor e cabeçalho do webhook.
- `SUPABASE_SERVICE_ROLE_KEY`: no Supabase **covuebkkltmteqtopppa**, abra Settings → API Keys e copie a chave de servidor `service_role` (Legacy API Keys) ou uma chave secreta `sb_secret_...` para esta variável. Nunca use prefixo `NEXT_PUBLIC_` nela. Cole também no `.env.local` para testes locais.
- `VAPID_SUBJECT` opcional: URL HTTPS pública do Teenman ou `mailto:` de contato real. O padrão é `https://teenman.vercel.app`.

Não envie a chave de servidor pelo chat. Depois de salvar as variáveis, faça **Redeploy** na Vercel: a chave pública é incorporada durante o build. Para desenvolvimento local, reinicie o Next.js.

## 2. Banco no projeto correto

Abra https://supabase.com/dashboard/project/covuebkkltmteqtopppa/sql/new . Execute primeiro o arquivo completo `supabase/notifications.sql` e depois `supabase/push-subscriptions.sql`.

`push_subscriptions` mantém a inscrição por dispositivo, com SELECT/INSERT/UPDATE/DELETE limitados ao próprio usuário. Chaves e endpoints de outros usuários nunca são devolvidos ao navegador. `push_deliveries` e a função de claim só são acessíveis pelo servidor, impedindo duplicatas entre webhook e disparo do cliente. Uma entrega com falha pode ser tentada novamente após dois minutos, até três tentativas; uma entrega confirmada não é repetida. O push só cobre notificações novas (até uma hora), não dispara o histórico antigo.

## 3. Webhook obrigatório para todos os INSERTs

No Supabase, abra Database → Webhooks → Create a new hook:

1. Nome: `teenman-native-push`.
2. Tabela: `public.notifications`; evento: **INSERT** apenas.
3. Método: **POST**.
4. URL: `https://SEU-DOMINIO-DO-TEENMAN/api/push/send` (use o domínio de produção estável da Vercel).
5. Headers: `Content-Type: application/json` e `x-push-secret: VALOR_DE_PUSH_WEBHOOK_SECRET`.
6. Não coloque a chave `service_role` no webhook. Se o formulário preencher Authorization automaticamente, remova esse cabeçalho e use apenas o segredo específico acima.

O webhook consulta a notificação real pelo ID; não confia nos demais campos do evento. O cliente também solicita o disparo após salvar uma interação, como caminho complementar. A claim por notificação/dispositivo impede que os dois caminhos enviem duas vezes. O webhook é necessário para ações inseridas fora desse cliente ou quando a aba que fez a ação fecha antes da requisição complementar.

O POST autenticado aceita `targetUserId` e, opcionalmente, `type`, `postId`, `sourceId`. Para compatibilidade, `title`, `body`, `url` podem estar presentes, mas são ignorados: título e destino são derivados de uma notificação real recente cujo `actor_id` seja o usuário da sessão. Comentários identificam a resposta exata por `sourceId`. Chamadas sem sessão e sem segredo de webhook são recusadas. Falhas de envio não desfazem a ação social.

## 4. Ativar e testar

1. Abra o site publicado em HTTPS, entre e visite `/notifications`.
2. Clique **Ativar Notificações no Dispositivo** e permita o pedido do navegador. Nenhuma permissão é pedida automaticamente.
3. Feche a aba. Em outra conta, curta, responda, republique ou siga o perfil da primeira conta.
4. Confira o alerta nativo e toque para abrir o post/perfil correspondente. Se já houver uma aba aberta, a navegação é feita pelo Next.js para preservar o player global.
5. Revogue em **Desativar neste dispositivo**. Sair da conta também remove/invalida a inscrição deste navegador. Outros dispositivos permanecem ativos.

Por privacidade na tela de bloqueio, o alerta informa a ação sem expor o texto da publicação/resposta. Inscrições que retornam HTTP 404/410 são removidas automaticamente. O servidor só envia para hosts de push conhecidos (Google, Mozilla, Microsoft e Apple), com HTTPS, para impedir requisições a destinos arbitrários.

Se não chegar, confira variáveis/redeploy, execução dos dois SQLs, logs do webhook no Supabase e logs `[push]` na Vercel. Erros temporários retornam 503; após dois minutos, o webhook pode ser reenviado pelo fluxo de administração. Não há promessa de entrega exatamente uma vez em falhas de rede: o banco evita concorrência e a tag nativa agrupa a mesma notificação.

## Validação local

Os testes usam PostgreSQL isolado (PGlite), envio simulado e um Service Worker simulado: verificam RLS, claims, expiração, navegação segura e remoção de inscrições. Não geram alertas nem dados em contas reais. A entrega nativa de ponta a ponta só pode ser confirmada depois de configurar as variáveis, o banco, o webhook e um dispositivo com permissão.
