# Teenman como PWA e pacote Android

A base web está preparada para instalação e para análise no PWABuilder:

- Manifesto: `https://teenman.vercel.app/manifest.json`, com início em `/feed`, escopo `/`, modo standalone e tema preto.
- Ícones PNG opacos 192/512 e Apple 180, com o T da plataforma dentro da área segura para recortes maskable. Regenerar com `node scripts/generate-pwa-icons.mjs`.
- Service Worker `/sw.js`, registrado após o carregamento nas builds de produção, via HTTPS ou localhost seguro. Testar com `npm run build` e `npm run start`.
- Navegações usam a rede. Sem conexão, mostram `/offline.html`. Só manifesto, ícones e tela offline são armazenados; posts, perfis, tokens, respostas RSC, APIs e mídia nunca entram no cache do worker. A instalação não torna o feed ou o Spotify disponíveis offline.
- Atualizações do worker não recarregam a página, preservando a reprodução e a sessão. O arquivo do worker é servido sem cache HTTP; assets públicos são atualizados pela rede e usados do cache em falhas de conexão.

## Empacotar no PWABuilder / TWA

O manifesto inclui quatro atalhos do ícone instalado: Novo Post, Explorar & Em Alta, Músicas & Disco IA e Salas ao Vivo, com ícones 192×192. `/feed?compose=1` abre automaticamente o modal para usuários autenticados; `/rooms` abre o diretório e o palco ao vivo no layout social. Deslogados continuam passando pela autenticação do feed. A exibição e a quantidade de atalhos dependem do navegador/sistema; uma instalação antiga pode precisar atualizar seus dados do manifesto.

1. No [PWABuilder](https://www.pwabuilder.com/), analisar o endereço HTTPS de produção e conferir o manifesto, os ícones e a instalação no Android. Deslogado, o início `/feed` redireciona normalmente para o login público.
2. Gerar o pacote Android e escolher o application ID, versões e dados de assinatura. Guardar a chave de assinatura fora do repositório.
3. Usar o application ID real e as impressões SHA-256 de assinatura para publicar o `assetlinks.json` fornecido pelo empacotador em `public/.well-known/assetlinks.json`. Após ativar Play App Signing, incluir a impressão da chave de assinatura do aplicativo exibida pelo Google Play, além da chave necessária aos testes locais.
4. Fazer novo deploy e validar o vínculo digital. Sem esse vínculo, o Android pode abrir uma Custom Tab com barra do navegador em vez da TWA verificada.
5. Testar login, navegação, reprodução e retorno do aplicativo em um aparelho Android. Enviar o AAB e preencher os dados exigidos no Play Console.

O pacote Android, a assinatura e a publicação na loja são etapas posteriores à preparação web. Não há `assetlinks.json` fictício no site: os identificadores e certificados reais só ficam disponíveis ao configurar o pacote.

Referências: [Android — Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2), [PWABuilder — Android](https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md).
