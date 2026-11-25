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
