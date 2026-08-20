
## Executar localmente

**Pré-requisitos:** Node.js e um projeto Supabase.

1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Execute `supabase-schema.sql` no SQL Editor do Supabase.
4. Inicie o app: `npm run dev`

O banco foi migrado para quatro áreas no mesmo projeto Supabase: `users` (perfis), `schedules` (horários), `labs`/`lab_bookings` (laboratórios) e `certificates` (certificados). O login usa Supabase Auth; a chave `service_role` é usada somente pelo servidor Express.


O Studia é uma Gestão escolar de horarios estamos desenvolvendo ele para o nosso tcc no final do ano 
ele vai ajuda a direção a gerenciar os horarios com mais rapidez reduzindo o tempo deles e deixar de fazer as grades de horarios manualmente
