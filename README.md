# Draft.League (private development app)

This project is local-only until you deliberately deploy it. Running it on
`http://localhost:3000` makes it accessible only from this computer.

## First-time setup

1. Install Node.js LTS (version 20.9 or newer) from https://nodejs.org.
2. In this folder, run `npm install`.
3. Copy `.env.local.example` to `.env.local`.
4. In Supabase, open Project Settings > API and copy only the Project URL and
   publishable key into `.env.local`. Never put a secret/service-role key in it.
5. Run `npm run dev`, then open http://localhost:3000.

The existing prototype is in `src/components/PokemonDraftLeague.jsx`.
It still uses the prototype storage method. The next development milestone is
replacing that storage with authenticated Supabase leagues and memberships.
