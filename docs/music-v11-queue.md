# Efeitos v11 e fila global

O fallback é calculado no primeiro render da faixa, sem aguardar a rede. A camada permanece visível enquanto existe uma faixa selecionada e Efeitos IA está ON, inclusive durante pausa/buffering. Desligar Efeitos IA restaura o fundo padrão. A aba oculta suspende o Canvas e, ao voltar, o motor redesenha imediatamente. Em redução de movimento há uma cena estática, em vez de sumir com todos os efeitos. O Canvas tem tamanho inicial de viewport, adapta a densidade de pixels, redesenha no resize e limpa RAF/listeners/texturas ao trocar a composição.

O namespace é `music_vibe_v11_...`; a leitura remove os namespaces antigos do navegador. Só respostas validadas com `fromAi: true` são guardadas no cache em memória/localStorage por sete dias. O servidor também só cacheia respostas reais do Gemini. Erro de rede, timeout ou JSON inválido deixam `fromAi: false` e não gravam o fallback. O orçamento total de análise é cinco segundos, incluindo letras. Recuperação de rede/foco permite nova tentativa sem loop de renderização; respostas 429 e falhas definitivas do provedor mantêm o cooldown global para não esgotar a API.

`buildRichFallbackVibe` combina a classificação cultural existente com assinatura de título+artista. Preserva universos reconhecidos, como Natal, FNAF, Ghostbusters e sertanejo, variando camadas compatíveis, movimento, paleta e distribuição das partículas. Para faixas desconhecidas, explora os horizontes e efeitos do contrato. A assinatura é determinística: a mesma faixa mantém sua composição, e outras faixas recebem variações. Um hash e um conjunto finito de efeitos não oferecem garantia matemática de ausência de colisões para toda música possível; a regressão cobre mil faixas distintas sem composição repetida.

## A seguir

O MusicProvider mantém `queue`, `addToQueue`, `playNext`, `removeFromQueue` e `clearQueue` fora das páginas. `+ Fila` aparece no catálogo, destaque, sugestões, faixas do artista, álbuns, playlists e busca do Disco. Adicionar uma faixa não começa a reprodução; duplicatas intencionais são permitidas. O painel mostra quantidade, Próxima, tocar um item, remover e limpar. Tocar um item pula os anteriores da fila. Trocar de página mantém a fila; recarregar ou sair da conta limpa a fila. Nada é publicado ou fixado no perfil ao apenas adicionar à fila.

O Spotify usa um controlador persistente e `loadUri`, sem recriar o iframe quando mudam callbacks ou a página. Buffering não é tratado como pausa. O avanço usa posição/duração do evento `playback_update`, exige reprodução anterior da faixa e deduplica o término, ignorando eventos de outra faixa. Repetir a mesma faixa na fila volta para o início.

O avanço automático depende de o Spotify disponibilizar duração e eventos de término para aquela reprodução. O player simples, bloqueios de autoplay, previews e restrições do Spotify podem exigir um toque manual em Próxima/Play. Não usamos temporizadores para adivinhar o fim nem tentamos contornar essas restrições. A reprodução nunca inicia sozinha ao carregar a página.

## Verificação

Os testes cobrem recuperação após timeout da mesma música, cache somente de IA, variação determinística, universos preservados, Canvas imediato/estático/resize e limpeza, fila e detecção de término sem avançar em pausa/buffering. Para conferir no navegador: adicionar duas faixas, abrir Fila, navegar para outra aba, remover/pular itens e testar OFF/ON. Depois simular rede offline: a cena deve aparecer imediatamente com modo local, sem gravar um fallback permanente.
