# Arquitetura e Regras do Projeto

## Visão Geral
Plataforma social híbrida (Feed estilo X + Salas de chat em tempo real estilo Discord + Perfil/Portfólio profissional estilo LinkedIn) voltada para adolecentes,cinefolos,politicos e entre outros

## Stack Tecnológica
- **Framework:** Next.js (App Router) com TypeScript
- **Estilização:** Tailwind CSS
- **Banco de Dados & Auth:** Prisma ORM (SQLite para desenvolvimento local fácil, pronto para migrar para PostgreSQL/Supabase) + NextAuth.js
- **Ícones:** Lucide React

## Regras de Código
1. Sempre use TypeScript estrito (evite `any`).
2. Crie componentes pequenos e reutilizáveis na pasta `src/components/`.
3. Mantenha o visual moderno em Dark Mode por padrão (inspirado no Discord/X).
4. Garanta que `npm run build` e `npm run lint` passem sem erros antes de finalizar qualquer tarefa.
