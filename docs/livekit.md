# Palco ao vivo nas salas

`/rooms` usa o layout social de três colunas e o mesmo chat Supabase de antes. Ao abrir uma sala, o botão **Entrar na Transmissão / Palco Ao Vivo** solicita um token à API e conecta ao LiveKit. Microfone, câmera e compartilhamento começam desligados; cada botão solicita a permissão correspondente apenas quando utilizado. A grade inclui participantes só de voz com avatar/inicial e indicador de fala, câmeras e telas compartilhadas. O áudio remoto tem botão de liberação quando o navegador bloquear a reprodução.

## Configuração

No `.env.local` e em Vercel → Settings → Environment Variables, configure:

```env
LIVEKIT_URL=wss://SEU-PROJETO.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://SEU-PROJETO.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

URL é pública; API Key e Secret ficam apenas no servidor. As variáveis locais não são enviadas pelo Git. Depois de configurar a Vercel, faça Redeploy; localmente, reinicie o Next.js. A resposta autenticada também inclui a URL pública configurada no servidor, permitindo conectar sem depender de uma chave pública incorporada em uma build antiga.

As tabelas `rooms` e `room_messages` e suas políticas vêm de `supabase/social.sql`; não há nova migração para usar o LiveKit. Falta de configuração ou falha no palco exibe mensagem e preserva o chat.

## Autenticação e ciclo da chamada

GET/POST `/api/livekit/token` recebe `roomId`; `participantName` e `isHost`, caso enviados, são ignorados. A API exige sessão Supabase válida, valida UUID e consulta a sala usando as permissões RLS do usuário. Nome e avatar vêm do perfil, com fallback para os metadados da sessão. A identidade é o ID do usuário, o host é calculado por `rooms.created_by`, e nenhum participante recebe privilégio de administração. O JWT dura 15 minutos para ingresso e permite publicar mídia/dados e assinar apenas `teenman-{roomId}`. O LiveKit gerencia a renovação durante a conexão. Tokens não são cacheados nem salvos no navegador.

Sair do palco, voltar ao diretório, mudar de sala ou navegar para outra aba desmonta a chamada e desliga a captura. O Disco de Vinil global permanece montado durante a navegação. Uma conta entra com identidade estável: abrir a mesma sala em outra aba/dispositivo pode substituir a conexão anterior, conforme a regra do LiveKit. Reconexão automática e avisos de falha são tratados pelo SDK.

## Teste entre dois dispositivos

1. Entre em duas contas do Teenman, em navegadores/dispositivos diferentes, usando HTTPS ou localhost.
2. Abra a mesma sala e entre no palco nos dois dispositivos.
3. Ative o microfone em um e confirme áudio no outro. Ative as câmeras e depois compartilhe uma janela no computador.
4. Encerre o compartilhamento pelo navegador e confirme que a tela desaparece. Teste também negar câmera/microfone e continue usando o chat.
5. Saia da transmissão e confirme que os indicadores de captura do navegador apagam. Navegue para Músicas e confira a continuidade do Disco Voador.

Compartilhamento de tela depende do suporte do navegador/sistema; dispositivos sem `getDisplayMedia` recebem uma indicação no palco. Os testes automatizados verificam assinatura/claims do JWT, identidade, autorização por sala e tratamento de configuração/falhas; não ativam câmera/microfone nem simulam uma conversa real.
