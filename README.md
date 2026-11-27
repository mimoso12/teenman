# Teenman

Rede social local em Next.js, TypeScript e Supabase, com fundo preto. O projeto usa a pasta app/ existente, sem uma segunda árvore src/app.

## Executar

Requer Node.js 20.9+ e pnpm.

```sh
pnpm install
pnpm dev
```

Abra http://127.0.0.1:3000. A rota / é pública; quem já tem sessão é redirecionado para /feed. /feed e /profile exigem login. /profile/[id] permite visualizar perfis públicos.

## Configuração

No .env.local:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
GEMINI_API_KEY=
```

Somente as duas variáveis Supabase são públicas. Os segredos Spotify/Gemini ficam no servidor. .env e .env.local são ignorados pelo Git. Reinicie o servidor após alterar variáveis.

No Supabase Authentication → URL Configuration, configure Site URL e a Redirect URL /auth/callback para a mesma origem em que abrir o site, por exemplo http://127.0.0.1:3000/auth/callback. Se também usar localhost ou o IP da rede, adicione seus callbacks. Confirme o e-mail se essa exigência estiver habilitada. A sessão usa cookies via @supabase/ssr, com validação e renovação no proxy.

## Banco e Storage

Execute no SQL Editor do Supabase:

1. supabase/schema.sql, uma vez em um projeto novo: tabela posts e suas políticas.
2. supabase/social.sql: curtidas, comentários, reposts, seguidores e chat de salas. Pode ser repetido.
3. supabase/profile-evolution.sql: perfil completo, username único, bio, categoria, banner, avatar, data de ingresso, vibe IA fixada, contadores públicos e bucket profile-media. Pode ser repetido e inclui os campos básicos de música; não é necessário executar profiles-vibe.sql separadamente para uma instalação nova.

A migração preserva perfis e músicas existentes. As regras permitem alterar apenas o próprio perfil. Fotos e capas são públicas, limitadas a 5 MB e JPG/PNG/WebP/GIF; cada usuário só pode enviar/alterar/remover arquivos na pasta com o próprio UUID. A função profile_follow_counts expõe contagens, sem liberar a lista privada de conexões. Não são publicados e-mails ou tokens.

A chave pública não permite executar SQL administrativo. Sem a atualização do banco, os dados antigos de música continuam compatíveis, mas a edição completa, os uploads, os contadores e a vibe IA pública não podem ser confirmados. A interface avisa sobre falhas e não inventa contagens.

## Navegação e música contínua

O layout raiz monta um único MusicProvider, um único widget e um único SpotifyPlayer. O grupo app/(social) mantém as laterais entre /feed, /profile e /profile/[id]. O menu usa Link do Next.js; Explorar, Salas, Filmes & Livros e Notificações usam parâmetros de /feed. Somente o conteúdo central muda. Não há widget nas páginas individuais, nem key baseada na rota no player.

A faixa ativa, o estado de reprodução, o iframe e os efeitos permanecem durante a navegação client-side. Recarregar o navegador ou abrir outra aba inicia outro documento e exige novo Play. Sair da conta interrompe a sessão e limpa a seleção. A página / deslogada não mostra o player.

O vinil flutuante abre ao clicar, pode ser arrastado e também movido pelas setas do teclado. A posição é limitada ao viewport. O iframe só é montado na primeira abertura; fechar o painel mantém uma reprodução já iniciada. Nunca há autoplay ao carregar, restaurar uma faixa, abrir um perfil ou trocar de música. No embed oficial, a disponibilidade de áudio completo/prévia depende do Spotify e da conta. Se a API de eventos falhar, o iframe simples permanece, com o disco parado para não simular reprodução.

Buscar ou escolher uma faixa salva automaticamente a música do próprio usuário. Ouvir junto em outro perfil carrega a faixa sem sobrescrever automaticamente a própria trilha; Fixar no meu perfil confirma essa escolha. Visitar um perfil enquanto uma música já toca não troca a faixa nem reinicia o iframe.

## IA automática e renderização

Não há seletores manuais de tema. A única preferência visual é Efeitos: ON/OFF, persistida localmente. Assim que uma faixa é selecionada ou restaurada, /api/music-vibe analisa título e artista. Os efeitos aparecem somente enquanto há reprodução real e a preferência está ON.

A rota POST /api/music-vibe usa Gemini gemini-2.5-flash, conforme definido no projeto, via fetch REST para generativelanguage.googleapis.com e cabeçalho x-goog-api-key. Não envia áudio nem analisa batidas. Retorna vibeName, emojis, effectType, glowColor, secondaryColor e a origem gemini/fallback. O JSON é validado antes de renderizar.

Tipos: rain, snow, fireworks, neon-aurora, siren, stars, hearts, confetti e lightning. AiStageEffects combina emojis, CSS e canvas-confetti com worker para fogos/confetes. Todas as camadas decorativas têm pointer-events:none, quantidade limitada de partículas, pausa na aba oculta e respeito a movimento reduzido. Brilhos de borda são suaves, sem flashes rápidos de tela inteira. A fluidez depende do aparelho.

O selo mostra IA Vibe e identifica modo local quando a API falha. Não há troca automática de modelo. Ausência de chave, indisponibilidade, cota ou resposta inválida usam um fallback local. A disponibilidade e os limites da conta Google continuam sujeitos ao provedor; nenhum plano ou faturamento é alterado.

Cache normalizado por título/artista: 7 dias para Gemini, 10 minutos para fallback, com deduplicação simultânea; até 256 faixas por processo no servidor e 80 no navegador. Há limite de 20 gerações/minuto/processo e até 5 simultâneas. A versão nova invalida respostas no formato antigo.

## Perfil

/profile mostra o dono na coluna central de 600 px: cabeçalho fixo, banner de 192 px, avatar de 128 px sobreposto, modal de edição, bio, categoria, ingresso, contadores, card musical e abas Posts/Respostas/Filmes & Livros/Curtidas. A versão mobile ajusta as medidas. As respostas e curtidas requerem sessão, seguindo as permissões das tabelas sociais.

O modal envia imagens ao Storage e salva apenas os dados de perfil, sem sobrescrever a música. O salvamento musical atualiza apenas os campos musicais para não desfazer uma edição de nome/bio em paralelo. A mudança de nome também atualiza os metadados do Supabase Auth para preservar a regra de autoria dos posts. Usernames aceitam 3–24 caracteres a-z, números e _. A exclusividade é validada pelo banco.

O card musical usa a faixa e IA Vibe fixadas no perfil. Só gira quando essa faixa é a reprodução ativa. O botão Ouvir junto abre a seleção no disco; o visitante dá Play no Spotify. Não existe sincronização de posição de áudio entre pessoas.

## Verificar

```sh
pnpm dlx tsx --test tests/music-vibe-service.test.ts tests/profile.test.ts
node --test tests/vibe.test.mjs
pnpm build
```

O script build também pode ser executado com npm run build. Teste com duas contas após aplicar o SQL: editar perfil e imagens, username duplicado, contadores, aba Curtidas/Respostas, edição negada a terceiros, pin de música/vibe e leitura pública. Dê Play e navegue pelo menu para confirmar continuidade; não use recarregamento completo nesse teste.

Limitações atuais: o feed busca as 100 publicações mais recentes; algumas buscas e notificações usam esse recorte. Mídias dos posts são links HTTPS de imagens/vídeos ou embeds YouTube/Vimeo, sem upload de posts. Salas têm chat por texto, sem voz/vídeo. Não há recuperação de senha nem ferramentas de moderação nesta versão.

## Catálogo TMDB e originais

Configure TMDB_API_KEY em .env.local (somente no servidor). A rota GET /api/tmdb retorna tendências semanais de filmes; query busca filmes e séries em pt-BR. O servidor mantém cache limitado por 1 hora para buscas e tendências, com timeout e erros sem credenciais.

Em Filmes & Livros, os detalhes permitem publicar título, opinião e pôster usando a tabela posts existente. A navegação continua no layout social e o MusicProvider permanece no layout raiz.

Para ativar a vitrine autoral, execute supabase/originals.sql no SQL Editor do Supabase. No fim desse arquivo há o comando para conceder a uma conta existente o papel admin ou creator usando o UUID de Authentication > Users. Apenas essas contas veem Adicionar título; as políticas RLS também validam a gravação. Cadastros aceitam título, tipo, sinopse, URL HTTPS da capa e link da obra.

O catálogo oferece filtros Todos, Filmes e Atores. Atores usam /search/person; Todos usa /search/multi e Atores sem busca lista pessoas populares. /api/tmdb/movie/[id] retorna detalhes, até 12 atores e direção (type=tv suporta séries). /api/tmdb/person/[id] retorna biografia e até 8 filmes por popularidade. Os detalhes usam cache de uma hora, timeout, deduplicação de chamadas e fallback HTTP 200 para indisponibilidade externa. A menção no feed inclui nome, link TMDB e foto, com autenticação e políticas de posts existentes.

## Músicas

/music usa o layout social e requer login. As categorias são seleções do catálogo Spotify por pesquisa, não charts oficiais. /api/spotify/trending?category=trending|brazil|cinema|pop|lofi e /api/spotify/search?q=... usam credenciais apenas no servidor. As faixas são enriquecidas por /v1/albums/{id}, com cache de buscas de 10 minutos, álbuns de 1 hora e no máximo 3 consultas simultâneas. Gravadora e popularidade ausentes são informadas como indisponíveis, sem dados inventados.

Tocar no Disco Voador solicita play no embed oficial após clique, seleciona a faixa no MusicProvider global e analisa a vibe. Nenhuma faixa começa sozinha ao carregar /music; navegador, conta e disponibilidade do Spotify podem exigir o play dentro do embed. As imagens de capa do Spotify são aceitas pelo feed com o domínio i.scdn.co explicitamente permitido.

## Radar Cívico

/civic requer login e compartilha o layout social e o player global. /api/civic?casa=todos|camara|senado&nome=...&uf=BA consulta dados públicos, sem chaves. Usa dadosabertos.camara.leg.br/api/v2/deputados com paginação e legis.senado.leg.br/dadosabertos/senador/lista/atual.json; o Senado é filtrado localmente no servidor por nome sem acentos e UF. Resultados de uma Casa são preservados quando a outra falha. Todas as consultas têm cache de uma hora, timeout e deduplicação.

/api/civic/[casa]/[id] retorna perfil oficial e até cinco proposições. Câmara usa proposicoes?idDeputadoAutor=...&itens=5&ordem=DESC&ordenarPor=id. Senado usa senador/{id}.json e senador/{id}/autorias?tramitando=S e ordena por data, ano e código. Esse serviço de autorias ainda respondeu nos testes, mas está marcado como depreciado pelo Senado; o serviço substituto indicado pela própria fonte é /dadosabertos/processo. O aplicativo sinaliza indisponibilidade caso a fonte deixe de responder. As proposições podem incluir requerimentos e coautorias; não são apresentadas como leis aprovadas.

Debater no Feed publica nome, Casa, partido/UF e, quando escolhido, título e ementa da proposição, sempre com o link oficial. Usa a tabela posts e as políticas de autenticação já existentes. Nenhuma tabela ou chave adicional é necessária.

## Games

/games requer login e mantém o layout social e o MusicProvider global. Configure RAWG_API_KEY em .env.local (apenas no servidor). Steam e CheapShark não usam chaves.

/api/games?tab=trending|steam|deals&query=...&genre=action|role-playing-games-rpg|adventure|indie usa api.rawg.io/api/games, store.steampowered.com/api/featuredcategories (ou storesearch para pesquisa Steam) e www.cheapshark.com/api/1.0/deals + stores. A aba RAWG em alta usa jogos lançados nos últimos 365 dias ordenados por adições na plataforma. A busca cobre o catálogo independentemente da data. Os filtros de gênero usam RAWG.

/api/games/details?source=rawg|steam|cheapshark&id=...&title=... consulta os detalhes e compara ofertas. source=cheapshark suporta ofertas sem Steam App ID. A identidade vem do título canônico da fonte; preços Steam e resultados CheapShark exigem correspondência de ID ou título exato para evitar confusão com sequências/edições. Ausência de preço não é interpretada como gratuidade. Os preços da Steam exigem currency=BRL, usam centavos convertidos para reais e cc=BR. CheapShark informa USD; a interface usa US$ sem converter ou apresentar como preço regional. Jogos grátis recebem o selo correspondente apenas quando a fonte retorna preço zero.

Consultas externas têm cache de uma hora, timeout e deduplicação; CheapShark recebe User-Agent descritivo Teenman/0.1. Falhas são tratadas com HTTP 200 e estado de indisponibilidade, sem retry automático ou recarregar página. O comparador preserva os resultados das fontes que responderam. Botões de console são buscas nas lojas oficiais, sem sugerir preços que não foram consultados. Comentar no Feed usa posts existente e anexa a capa; Chamar Squad abre as Salas ao Vivo via Link.

### Partidos no Radar Cívico

/api/civic?casa=partidos&nome=... lista partidos da API da Câmara com filtro por nome ou sigla. A interface carrega a lista uma vez por montagem/cache e filtra a busca digitada localmente com debounce de 500ms. Não consulta o detalhe de todos os partidos em lote: os dados completos são carregados somente ao abrir o modal, evitando sobrecarga da fonte.

/api/civic/partidos/[id] consulta /api/v2/partidos/{id} e /partidos/{id}/membros?itens=20, seguindo a paginação da bancada. A liderança vem de status.lider; o total em exercício vem de status.totalMembros, sem usar o tamanho da amostra como total. A interface informa separadamente o número de membros retornados porque o status e a lista podem ter datas diferentes. O número eleitoral aparece apenas quando informado; o ID interno da Câmara é explicitamente identificado.

Consultas de partidos e membros usam Accept: application/json, next.revalidate=86400, cache limitado em memória, deduplicação e timeout. Falhas na bancada preservam perfil e liderança; listas sem dados complementares não inventam status. Logos oficiais têm validação de domínio e fallback de sigla. Debater no Feed publica dados do partido e link da fonte usando a tabela posts existente.

### Prefeitos e vereadores

/api/civic aceita casa=prefeitos|vereadores, nome, uf, municipio e pagina. A integração usa https://maquinapublica.com.br/api/politicos com cargo=PREFEITO|VEREADOR, por_pagina=60 e os filtros documentados em https://maquinapublica.com.br/docs. Nenhuma chave é necessária. As respostas informam results, total, pagina e hasMore; a interface carrega páginas apenas quando o usuário solicita Mostrar mais. Todos reúne Câmara, Senado e páginas de ambos os cargos municipais, preservando fontes disponíveis quando outra falha. O filtro de município se aplica aos cargos municipais.

Detalhes municipais são servidos por /api/civic/prefeitos/[id] e /api/civic/vereadores/[id], consultando /politicos/{id}. A normalização retorna apenas os campos necessários à ficha e ao debate: nome, cargo, partido, município/UF, mandato e resultado eleitoral. CPF, título eleitoral, data de nascimento e demais dados pessoais adicionais do retorno original não são repassados. Fotos não informadas usam avatar; URLs fornecidas são limitadas aos domínios da fonte e TSE, com fallback.

A documentação do Políticos BR informa que os registros refletem dados eleitorais de 2024 e não capturam automaticamente trocas de partido após a posse. A interface e os posts municipais apresentam esse contexto; não tratam o resultado eleitoral como verificação de exercício atual. Consultas usam next.revalidate=3600, cache limitado, deduplicação, timeout e fallback HTTP 200 para indisponibilidade. Debater no Feed usa posts e autenticação existentes.

## Livros, Esportes e Notícias

/books, /sports e /news exigem login e usam o layout social de três colunas. O MusicProvider permanece no layout raiz. O menu lateral foi reorganizado em Início, Salas, Notícias, Filmes, Músicas, Games, Livros, Esportes, Radar Cívico e Perfil, com espaçamento compacto e rolagem interna em telas baixas. As rotas antigas de exploração e notificações continuam acessíveis por URL.

/api/books?query=... consulta www.googleapis.com/books/v1/volumes com langRestrict=pt e maxResults=18, sem chave. Consultas em cache por uma hora. Quando a Google Books nega cota ou falha, usa a Open Library com language:por e preferência de edição em português, identificando a origem e as limitações dos metadados. /api/books?id=OL...W consulta a sinopse da obra na Open Library. A vitrine autoral usa original_titles no Supabase, filtrando kind=book; a migração e as permissões de criador continuam as documentadas anteriormente.

/api/sports usa a chave pública de desenvolvimento 123 do TheSportsDB, sem nova configuração no ambiente. Sem parâmetros, consulta eventspastleague.php?id=4351 e eventsnextleague.php?id=4351. query busca clubes; teamId consulta a agenda e os resultados do time selecionado. Cache de 30 minutos, datas exibidas no horário de Brasília, placares ausentes não viram 0 a 0, e o status do jogo vem da fonte. O plano gratuito pode retornar poucos eventos e limitar resultados por time a jogos em casa. Não há atualização de placar ao vivo.

/api/news?category=main|culture|sports lê RSS no servidor. Fontes: https://g1.globo.com/rss/g1/, https://ge.globo.com/rss/ge/ e tentativa em https://www.omelete.com.br/rss. O endpoint Omelete retornou 404 nos testes; cultura pop usa https://g1.globo.com/rss/g1/pop-arte/ com aviso explícito. Cache de 15 minutos, parser XML com DTD/entidades externas recusados, limite de tamanho, resumo limpo e links de origem preservados. Não são copiados artigos completos.

Todas as fontes usam timeout, cache limitado e deduplicação de requisições; falhas retornam estado controlado sem reload/retry automático. Comentar e criar debate usam a tabela posts existente e verificam a sessão antes de gravar; os testes não publicam dados na conta. Nenhuma nova chave ou tabela é necessária para esses três catálogos.
## Cantores & Bandas

A aba /music alterna entre faixas e artistas, mantendo o MusicProvider no layout raiz. As rotas autenticadas /api/spotify/artists?query=... e /api/spotify/artists/[id] reutilizam as credenciais existentes no servidor. Cache e deduplicação duram uma hora; buscas na interface usam debounce de 500 ms e ignoram respostas antigas. A busca de artistas combina páginas de 10 e 8 itens para respeitar o limite do Spotify Dev Mode. Seguidores, gêneros e popularidade ausentes permanecem como não informados.

Os detalhes usam somente a busca oficial de faixas com artist:"Nome", seguida da busca pelo nome simples quando não houver faixas válidas. Filtram pelo ID exato do artista, deduplicam e ordenam por popularidade decrescente (valores ausentes ao final). A URL de detalhes recebe name do card; se /artists/{id} for restrito, o serviço usa o nome do catálogo, o nome recebido ou o oEmbed oficial para preservar a busca e a biografia, sem depender de top-tracks. Biografias são resumos em texto da Wikipedia pt com link e atribuição CC BY-SA; páginas de desambiguação e resultados sem contexto musical são rejeitados. Falhas de biografia ou faixas preservam os dados restantes do artista. Tocar aciona o Disco Voador global e sua análise de vibe existente; comentar pode compartilhar o artista ou abrir o compositor da faixa, sem publicar automaticamente.
## Publicações, emojis e arquivos

O botão Postar e o atalho móvel abrem um único modal dentro do layout social, sem trocar a rota nem desmontar o MusicProvider. O formulário é compartilhado com o compositor do feed e limita o texto a 500 caracteres Unicode. Emojis respeitam a seleção do cursor; frequentes ficam no localStorage. Etiquetas são opcionais. Fechar o modal preserva o rascunho.

As prévias usam URLs blob locais, revogadas ao remover ou substituir o arquivo. Imagens aceitas: JPEG/PNG/WebP/GIF/AVIF até 10 MB; vídeos MP4/WebM até 50 MB, com verificação do cabeçalho do arquivo. Ao publicar, o usuário é validado novamente, o arquivo é enviado a post-media/<auth.uid()>/<uuid> e o post recebe media_url, media_type e category. Uma tentativa mantém o mesmo UUID e reutiliza o upload confirmado em caso de falha. Falhas preservam o rascunho; a interface confirma a linha gravada antes de fechar o modal.

Para projetos novos ou cópias do banco, execute supabase/post-media.sql depois dos scripts iniciais. Ela cria/configura o bucket público e as políticas da pasta do usuário e adapta posts sem apagar conteúdo. No projeto conectado, post-media já existia público e permitia upload; as colunas category e as restrições de conteúdo/etiqueta foram aplicadas pelo SQL Editor. As permissões existentes do bucket foram mantidas.

O feed usa consulta secundária em profiles pelos IDs únicos dos autores, evitando depender de FK para auth.users. Trata full_name e display_name conforme o esquema disponível, além de avatar_url e username. Mídias com colunas próprias e posts legados com URL na última linha continuam renderizando, inclusive na página de perfil. O evento de publicação insere a nova linha imediatamente no feed e revalida os dados sem reload.
## Republicações

O feed e o perfil usam public.reposts (user_id, post_id, created_at). A interface atualiza o ícone e o contador de forma otimista, impede cliques concorrentes, desfaz a alteração quando o banco rejeita a operação e reconcilia os dados depois. As consultas de contadores percorrem páginas de 500 registros para evitar truncamento pelo limite padrão do Supabase.

Posts do perfil combina publicações próprias e republicações sem duplicar o mesmo post, ordenadas pela data da atividade mais recente. A aba Republicações busca os posts por ID, incluindo publicações antigas fora da página inicial do feed; posts excluídos não são exibidos. A autoria e a mídia continuam sendo do post original. As alterações locais e eventos Realtime atualizam as duas áreas sem navegação ou reload.

Execute supabase/reposts.sql no SQL Editor para garantir a unicidade por usuário/post, as políticas de leitura/escrita e a publicação Realtime, e copiar o histórico legado de post_reposts sem removê-lo. A tabela canônica reposts já foi confirmada pela API no projeto conectado; esta migração não foi aplicada automaticamente nesta tarefa, pois o controle do navegador foi interrompido ao não conseguir verificar a URL com segurança.
## Explorar

/explore fica no mesmo layout social e exige login, preservando o MusicProvider e o compositor globais. O menu lateral e a busca da coluna direita levam à nova página com navegação Next Link. A rota antiga /feed?view=explore permanece disponível para abrir conversas existentes.

A busca usa debounce de 500 ms, ignora respostas antigas e pagina os perfis em grupos de 18. Consulta somente campos públicos de profiles: full_name/display_name, username, bio, avatar e ID da música fixada, excluindo o usuário atual. Campos opcionais antigos têm fallback. Seguir usa follows com validação do usuário autenticado, atualização otimista, bloqueio por card e rollback em falhas; se a tabela não existir, a preferência dura apenas a sessão, com aviso explícito.

Tópicos são calculados sobre até 300 posts recentes. Hashtags e palavras contam uma vez por publicação, com normalização de caixa/acentos; palavras comuns e URLs não entram no ranking e palavras isoladas precisam aparecer em pelo menos dois posts. Categorias consideram a etiqueta e termos relacionados no conteúdo. Apenas tópicos com posts reais aparecem, e a interface informa o tamanho da amostra. O filtro de um tópico usa a mesma regra da contagem e preserva autor, avatar e mídia. A busca de texto nos posts consulta o banco e retorna até 100 resultados por busca.
## Feed recomendado

lib/feedAlgorithm.ts contém rankPostsForUser, pura e determinística: recebe o instante now junto com interactedPosts e não altera as entradas. Usa (curtidas × 3 + republicações × 5 + comentários × 4 + afinidade 25 + mídia 8) / (horas + 2)^1,35. Afinidade considera categorias, hashtags e palavras-chave dos posts que a pessoa curtiu, republicou ou comentou; o bônus é único mesmo com vários interesses coincidentes. URLs e palavras comuns não criam interesses. Uma fila de prioridade por autor intercala outra pessoa após dois posts consecutivos quando possível e aplica uma penalidade de 10% à repetição adiada, mantendo complexidade O(n log n).

O carregamento reúne até 150 publicações recentes, 100 publicações de pessoas seguidas e os originais das 100 republicações mais recentes dessas pessoas. A afinidade consulta as últimas 200 curtidas, 200 republicações e 200 respostas do próprio usuário, incluindo os posts históricos correspondentes; as interações atuais dos candidatos atualizam a preferência na sessão. Contadores de engajamento são lidos em páginas de 500 registros para evitar truncamento pelo limite padrão do Supabase. Falhas parciais são sinalizadas e preservam as publicações restantes.

Para você usa o algoritmo e selos discretos que explicam afinidade ou engajamento (15 pontos ou mais). O seletor Algoritmo/Recentes muda somente a ordenação local. Mais Recentes sempre usa a data original do post. Seguindo mostra apenas posts de autores seguidos e posts republicados por essas pessoas, ordenados pela atividade mais recente, sem duplicar o original e preservando sua autoria/mídia. O MusicProvider permanece no layout raiz; não há chamadas de IA para recomendar posts nem novas tabelas ou chaves necessárias.

### Cenários musicais cinematográficos

O player global mantém a reprodução ao navegar. Enquanto toca e `Efeitos IA` está ativo, `GlobalVibePalette` aplica as cores validadas da música ao layout; pausa/OFF restaura o tema preto com transição. `AiStageEffects` usa Canvas com texturas suaves, névoa e profundidade em onze cenas automáticas: Natal, cyberpunk, chuva, cosmos, pôr do sol tropical, fogo épico, aurora romântica, mistério, festival, country/sertanejo e urbano.

A rota `/api/music-vibe` pede JSON estruturado ao `gemini-2.5-flash`. Se esse modelo retornar 404, usa automaticamente `gemini-3.8-flash`, indicado pela API do Google para a conta atual. Falhas de rede, quota ou indisponibilidade usam a análise local por palavras-chave. A análise usa metadados, conhecimento do modelo e, quando disponível, até 1.400 caracteres da letra real obtida do LRCLIB. O áudio não é analisado e a resposta não reproduz versos. O cache do servidor e do navegador dura sete dias apenas para respostas confirmadas da IA (`fromAi: true`); fallbacks não são cacheados. O namespace é `music_vibe_v11_...` e o armazenamento é `music_vibe_v11_cache`.

Cores/alpha e emojis são validados antes de chegar ao CSS. As camadas decorativas não capturam cliques. O Canvas limita a densidade de pixels a 1,5 e a quantidade de partículas, suspende o trabalho em abas ocultas e respeita redução de movimento. O botão único `Efeitos IA: ON/OFF` controla a atmosfera, sem seleção manual de cenários.

O prompt considera título e artista em conjunto; o fallback reconhece artistas e gêneros, com presets de sertanejo/country, funk/trap, rock e MPB. Artistas com discografia variada exigem contexto da faixa (por exemplo, Taylor Swift country versus pop). A classificação local é uma heurística, não uma identificação garantida da história de qualquer música. Respostas genéricas são rejeitadas e substituídas por uma cena temática ou nome relacionado aos metadados. JSON cercado por markdown é aceito, mantendo a validação do esquema. Falhas HTTP, JSON inválido, timeout e chave ausente são registrados no servidor, com redação da credencial e sem registrar o áudio ou as letras. Erros do provedor são diagnosticados no servidor; o fallback mantém a rota disponível.

### Álbuns, playlists e descobertas pessoais

Em Músicas, o modal do artista mostra até 12 álbuns/singles (páginas de 10 + 2 para compatibilidade com Development Mode). `/api/spotify/albums/[id]?offset=0` lista faixas em ordem e permite carregar as páginas seguintes. A nova aba Playlists usa `/api/spotify/playlists?query=...` e o modal consulta `/api/spotify/playlists/[id]?offset=0`. As rotas exigem sessão do Teenman, mantêm credenciais apenas no servidor e compartilham cache e solicitações pendentes. As listas ignoram itens nulos, episódios, arquivos locais e faixas indisponíveis.

A seção Para Você combina gêneros, termos pesquisados, artistas visitados e faixas enviadas ao Disco Voador. O contexto global registra até 80 eventos recentes, por até 90 dias, no localStorage separado pelo ID do usuário; não envia o histórico ao Supabase. Buscas têm debounce de 500 ms; recomendações usam até duas consultas, intercalando sugestões de gênero e artista, sem APIs de recomendação restritas. Reproduzir uma faixa continua usando o player global e a análise de vibe existente.

Validação com a API real: 12 álbuns encontrados, primeira página com 10 faixas e paginação ativa; busca de playlists retornou 12 coleções públicas. A leitura das faixas dessas playlists retornou 401 no endpoint `/items` e 403 no legado `/tracks` com o Client Credentials atual. Nessas restrições o modal preserva capa, descrição e criador, informa a indisponibilidade e oferece o link oficial, sem inventar músicas ou trocar a lista por resultados de busca. A lista interna completa depende de o Spotify autorizar esse acesso para o aplicativo.

### Motor cinematográfico v10: atmosfera em Canvas

A direção de arte combina 23 horizontes, 14 centros de céu, 11 elementos animados, 11 filtros de iluminação, 19 efeitos de partículas e 6 movimentos para cinco emojis: 4.441.668 combinações de parâmetros, além da paleta de cores. O contrato é definido em `lib/cinematic-schema.ts`, validado antes de renderizar e enviado ao Gemini como esquema JSON. Configurações anteriores de perfis continuam compatíveis por adaptação, enquanto a rota exige o contrato completo v10 para novas respostas da IA. O cache atual do navegador é `music_vibe_v11_cache`; as chaves do cliente e servidor começam com `music_vibe_v11_`.

`lib/lyrics-service.ts` tenta `/api/get` do LRCLIB por título/artista e, se necessário, `/api/search`. O orçamento total das duas tentativas é 2,5 segundos. A correspondência confere os dois nomes, evita homônimos e distingue instrumentais; cacheia sucesso por um dia e ausência por dez minutos, deduplica solicitações e respeita Retry-After. Até 1.400 caracteres de `plainLyrics` são enviados ao Gemini apenas no servidor. A letra é tratada como contexto, nunca instruções. Versos não vão para logs, perfil, resposta HTTP ou localStorage: `lyricInspo` deve ser uma paráfrase curta e recebe indicação quando a letra não pôde ser confirmada ou a IA ficou indisponível.

O renderizador compõe os parâmetros das seis camadas em um único Canvas com texturas atmosféricas e iluminação aditiva; as antigas silhuetas SVG foram removidas. Inclui pizzaria com palco/robôs e câmera, arena gamer, torii, Natal, Halloween, rancho/rodeio, palcos rock/metal, cidades, nuvens, praia, floresta, castelo, dunas, montanhas, estádio e roda-gigante. Tudo é decorativo, aria-hidden e pointer-events:none. Canvas usa DPR limitado, menos partículas no celular, animação baseada no tempo e suspensão em aba oculta. Confete e fogos usam partículas luminosas procedurais no mesmo loop de animação. Redução de movimento é respeitada e flashes foram substituídos por luz suave.

O MusicProvider permanece no layout global com o mesmo player, sem autoplay e sem seletores de cena. Há apenas Efeitos IA: ON/OFF, o selo IA Vibe e a explicação Letra. As quatro variáveis globais de cor são restauradas ao desligar os efeitos ou remover a faixa selecionada; o fundo é tingido uma vez para não acumular opacidade nas colunas.

Validação real v9: o LRCLIB encontrou 1.400 caracteres de Join Us for a Bite em aproximadamente 640 ms. O Gemini 2.5 respondeu 404 para a conta e o modelo compatível 3.8 respondeu 429 por cota gratuita diária esgotada. A rota retornou 200 com as seis camadas FNAF e sinalizou que a direção veio dos metadados. A direção via IA voltará a ser utilizada quando a cota do provedor estiver disponível; nenhuma resposta local é apresentada como análise de letra pela IA.

### Show Ghostbusters e recursos do Canvas

Ghostbusters, Ray Parker Jr., Bustin e Caça-Fantasmas ativam `ghostbusters-show` no prompt e no fallback. Uma regra após a validação mantém esse cenário obrigatório mesmo se o modelo desviar, preservando o título criativo da IA. O show tem sirenes vermelha/azul com pulsação lenta, fantasmas compostos de nuvens ectoplásmicas verde/ciano, feixes ondulados laranja/azul e captura localizada em partículas. A composição luminosa usa screen/lighter; nenhum contorno SVG ou personagem clipart permanece na camada visual.

`lib/cinematic-canvas.ts` mantém um único requestAnimationFrame por cena. Texturas radiais, emojis desfocados e horizonte suave são pré-renderizados e reutilizados; o custo por quadro usa drawImage, sem recalcular blur de cenário em cada frame. Partículas próximas são maiores e difusas, e partículas distantes usam núcleos pequenos. O Canvas limita DPR a 1,5 no desktop e 1,15 no celular, parte de 152/72 partículas e reduz a densidade se os quadros atrasarem. A animação é baseada no tempo e acompanha a frequência do navegador; 60 FPS é o alvo, dependendo do dispositivo. A área central tem menor intensidade para preservar a leitura.

Ao mudar a direção visual, pausar, desligar efeitos, ocultar a aba ou desmontar, o loop é cancelado; callbacks atrasados não desenham nem criam novos frames. As texturas são zeradas e liberadas, o array de partículas é descartado e o listener de resize é removido. Não há timers independentes para sirenes, feixes ou captura. A saída usa uma transição de opacidade curta, retendo apenas o último quadro até o fade terminar. Redução de movimento continua respeitada. O player global e a consulta ao LRCLIB não foram alterados.

### PWA e Android

O manifesto em `/manifest.json` usa o tema preto, modo standalone e início em `/feed`. Ícones 192/512 maskable e Apple 180 acompanham o logotipo existente. O Service Worker é registrado automaticamente nas builds de produção e mantém uma tela offline, sem armazenar conteúdo privado ou interferir no Spotify. Os passos para analisar no PWABuilder, empacotar para Android e configurar os Digital Asset Links reais estão em [docs/pwa-android.md](docs/pwa-android.md).

### Notificações em tempo real

Execute o arquivo completo `supabase/notifications.sql` no SQL Editor do projeto Supabase usado pelo aplicativo (`covuebkkltmteqtopppa`). As tabelas sociais de posts, curtidas, comentários, republicações e seguidores devem existir primeiro. A migração configura índices de deduplicação, acesso restrito por usuário, disparos automáticos e a publicação Realtime; pode ser executada novamente. Duplicatas antigas precisam ser revisadas caso impeçam a criação dos índices únicos.

`/notifications` mostra curtidas, respostas, republicações e seguidores com os perfis reais. A página marca como lidas as notificações exibidas enquanto está visível; o botão de marcar todas inclui as demais. A lista carrega 40 por vez, até 400, e o contador considera todas as não lidas. Um canal global filtrado pelo usuário atualiza o sino e sincroniza novamente ao reconectar, voltar à janela ou recuperar a conexão. Ações no próprio perfil/post não geram notificações. São notificações dentro do aplicativo, sem solicitar permissão de push do sistema.

Os testes incluem uma execução isolada da migração em PostgreSQL via PGlite, verificando disparos, deduplicação e isolamento entre usuários, sem criar dados de teste no Supabase de produção.

### Push nativo no PWA

O botão de ativação em `/notifications` registra cada dispositivo com consentimento explícito. O Service Worker recebe os alertas e abre a publicação/perfil correspondente, preservando o player quando já existe uma aba do aplicativo. O envio usa `web-push`, VAPID, inscrições protegidas por RLS e claims por dispositivo para evitar duplicatas. Para ativar em produção, configure as variáveis da Vercel, execute `supabase/push-subscriptions.sql` depois de `notifications.sql` e configure o webhook INSERT. Os passos completos estão em [docs/web-push.md](docs/web-push.md).

### Voz, vídeo e tela nas salas

`/rooms` abre as salas com chat Supabase e palco LiveKit. A entrada exige sessão e uma sala acessível pela RLS; o token restringe a identidade e a sala, sem confiar em privilégios enviados pelo cliente. Microfone/câmera/tela iniciam desligados. Ao sair ou navegar, a chamada é desconectada e o player global continua montado. Configure as quatro variáveis LiveKit também na Vercel; detalhes e roteiro de teste entre dispositivos em [docs/livekit.md](docs/livekit.md).

### Efeitos v11 e A Seguir

O visual local aparece assim que uma faixa é selecionada, varia pela assinatura de música/artista e não desaparece durante buffering. A API retorna `fromAi`; somente resultados reais da IA são cacheados em `music_vibe_v11_...`. Fallbacks não ficam presos no cache. A análise tem orçamento total de cinco segundos. Em redução de movimento, o Canvas mostra uma cena estática.

`+ Fila` adiciona músicas sem iniciar a reprodução. A fila global acompanha a navegação e oferece Próxima, pular, remover e limpar. O controlador Spotify permanece montado e o avanço automático depende dos eventos de fim disponibilizados pelo player oficial. Bloqueios do Spotify/autoplay ou player simples podem exigir avanço manual. Implementação, limites e validações em [docs/music-v11-queue.md](docs/music-v11-queue.md).

### Denúncias e banimento

O menu dos posts e o cabeçalho das salas têm Denunciar, com motivo salvo em `reports` e acesso privado por denunciante. `profiles.is_banned` bloqueia publicações e participação nas salas, com verificação no cliente, na emissão do token LiveKit e por políticas restritivas no Supabase. Execute `supabase/moderation.sql` no projeto correto para ativar. Nenhuma página administrativa foi criada; detalhes em [docs/moderation.md](docs/moderation.md).
