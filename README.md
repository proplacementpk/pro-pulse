# Propulse web portal

The browser companion to the Propulse desktop app: search, add one resume, roles, export and email, and a small Admin screen. Built with Next.js; it talks to the same Supabase database as the desktop app, always as the signed-in person.

- To put it online, follow `DEPLOY.md`.
- To run it on your own computer: copy `.env.example` to `.env.local`, fill in `SESSION_SECRET`, then `npm ci` and `npm run dev`, and open http://localhost:3000.
- Keys live in `.env.local` or on the host. They are never sent to the browser and must not be committed.
