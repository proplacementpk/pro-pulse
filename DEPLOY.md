# Propulse web portal: putting it online

The portal is the lighter companion to the desktop app. Consultants sign in from any browser to search, add one resume at a time, and work their roles. Admins also get a small Admin screen. Bulk upload, backup, logs, AI assistant links and all other settings stay in the desktop app.

Both apps use the same Supabase database and the same accounts, so nothing is copied or synced.

There are two ways to host it. Do steps 1 and 2 first, then follow either option A or option B.

| | Option A: Vercel | Option B: your own server |
|---|---|---|
| Effort | Lowest. No server to look after | You keep a machine running and updated |
| Cost | Vercel's paid Pro plan. Their free Hobby plan is for non-commercial use only, so it does not fit a recruitment firm | The cost of a small VPS, or an office PC that stays on |
| Largest resume file | 4 MB (Vercel refuses larger uploads) | Up to 9 MB |
| HTTPS | Automatic | You set it up (Caddy does it for you) |

Larger files than the limit can always be added from the desktop app.

## 1. Run the database script once

The portal's search filters need the newer database script, `schema.sql`, delivered with this project. The script inside the Propulse 1.5 installer is older.

1. Open your Supabase project, then **SQL Editor**.
2. Paste the whole of `schema.sql` and press **Run**.

It is safe to run more than once, it keeps all data, and the desktop app 1.5 keeps working afterwards. Until this is done, searching in the portal fails.

## 2. Collect the settings

These are set on the host as environment variables. They stay on the server and are never sent to anyone's browser. Do not paste them into a chat or an email.

| Name | Needed | What it is |
|---|---|---|
| `PROPULSE_SUPABASE_URL` | Yes | Your Supabase project address. Already filled in `.env.example` |
| `PROPULSE_PUBLISHABLE_KEY` | Yes | The publishable key, the same one the desktop app uses. Already filled in `.env.example` |
| `SESSION_SECRET` | Yes | A long random text of your own that protects the sign-in cookie. See below |
| `GEMINI_API_KEY` | For Add resume and meaning-based search | Your Gemini key. Use the replacement key, not the one that was exposed earlier |
| `GOOGLE_SERVICE_ACCOUNT` | For storing and opening resume files | The whole content of the service-account key file (the `.json` file the desktop app uses), pasted as one value |
| `GOOGLE_DRIVE_ID` | No | Only if the portal should use a different shared drive. Left empty, it uses the one saved in the desktop app's Settings |
| `BREVO_API_KEY` | For emailing lists | Your Brevo key. The sender name and address come from the desktop app's Settings |
| `PROPULSE_MAX_UPLOAD_MB` | No | Largest resume file in MB. Default 4. Leave it alone on Vercel; on your own server it can go up to 9 |

To make a `SESSION_SECRET`, run this on any computer with Node installed and copy the result:

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Changing `SESSION_SECRET` later signs everyone out, which is harmless.

Without the three optional keys the portal still runs: search works on words and filters, and Add resume, Open file and Email say plainly that they are not set up yet.

## Option A: Vercel

1. Create a **private** repository on GitHub and upload this project folder to it. `node_modules` and `.env.local` are not needed and must not be uploaded.
2. In Vercel, choose **Add New, Project**, and import that repository. Vercel recognises Next.js; leave the build settings as they are.
3. Before the first deploy, open **Environment Variables** and add the names from step 2 with their values.
4. Press **Deploy**. You get an address ending in `.vercel.app`.
5. To use your own address (for example `portal.yourfirm.com`), add it under **Settings, Domains** and create the DNS record Vercel shows.

Reading a resume can take up to two minutes on a slow scan. The project already asks Vercel for that much time, which the Pro plan allows.

To update later, upload the changed files to the same repository. Vercel rebuilds on its own.

## Option B: your own server

You need a machine that is always on, reachable from the internet, with Node.js 20.9 or newer (22 is what this was tested on).

1. Copy the project folder to the server.
2. In the folder, copy `.env.example` to `.env.local` and fill in the values from step 2.
3. Build and start:

```
npm ci
npm run build
npm start -- -p 3000
```

4. Keep it running after a restart with a service manager. With pm2:

```
npm install -g pm2
pm2 start npm --name propulse-web -- start -- -p 3000
pm2 save
pm2 startup
```

5. Put HTTPS in front. This is required: the sign-in cookie is only sent over HTTPS, so sign-in does not hold on a plain `http://` address. Caddy is the shortest way. With your domain pointing at the server, the whole Caddy file is:

```
portal.yourfirm.com {
    reverse_proxy 127.0.0.1:3000
}
```

Run one copy of the portal only. The limit on wrong passwords (5 tries in 10 minutes) is counted in memory, so a second copy would count separately.

To update later: replace the files, then run `npm ci`, `npm run build` and `pm2 restart propulse-web`.

## After it is online

1. Open the address and sign in with your admin account from the desktop app.
2. Open **Admin**, then press **Test** beside Gemini, Google Drive and Brevo. Each one says what it found or what is wrong.
3. Add one resume, open its file from the profile, and email yourself a short list.
4. Give consultants the address. They use the same email and password as in the desktop app.

Nothing needs changing in Supabase's sign-in settings. If **Confirm email** is switched on there, a user added from the portal gets a confirmation email first and appears in the Users list after opening it.

## What the portal does and does not do

| In the portal | Desktop app only |
|---|---|
| Search with all filters, sorting and paging | Bulk upload |
| Candidate profiles: view, edit, notes, add to role | Backup and database usage |
| Add one resume, with duplicate check | Activity log and profile history |
| Roles: create, edit, stages, notes, remove | AI assistant links |
| Export to Excel, choose columns, email a list | Keys, matching and all other settings |
| Admin: users, stages, connection tests, deletes | Dashboard |

Consultants can email a list only to their own address. Admins choose the recipients. Only admins can delete a candidate or a role. Every change made in the portal shows in the profile history as "Web portal".

There is no two-step sign-in, as agreed. People stay signed in for 7 days on a device they keep using.

## Checking a copy before it goes live

`tests/run.sh` builds the portal and runs 122 browser checks against local stand-ins for Supabase, Gemini, Google Drive and Brevo. It needs the desktop project's test tools beside it and does not touch the live database or send anything.
