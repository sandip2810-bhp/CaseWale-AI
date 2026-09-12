# CaseWale — Frontend

Plain HTML/CSS/JS frontend for the Precedent/CaseWale backend. No build
step, no framework.

**Design:** dark "Digital Sovereignty" theme (matte black canvas, gold/amber
accents, glassmorphic cards) built with Tailwind via CDN + Inter + Material
Symbols. A light theme is also available (see below) using the same tokens.

The "Legal Analysis Result" / deeper case-analysis dashboard (cases,
documents, calendar) from the original mockup still isn't built — there's
no backend support for it. The top-bar **search box** is still visual-only.

## Pages

- `landing.html` — marketing/landing page, links to sign in / create account
- `index.html` — login, signup, forgot password, reset password (tabs/views)
- `dashboard.html` — ask a question, see the cited answer (editable), browse
  history, write and send drafts with reminders

## Run it locally

Backend must be running first (`npm start` in the backend folder).

Then just serve this folder — don't open the HTML files with `file://`,
since `fetch` and the redirects behave better over `http://`:

```bash
npx serve .
# or
python3 -m http.server 5500
```

Open `http://localhost:5500/landing.html` (or whatever port it prints).

## Connecting to the backend

Edit `js/config.js`:

```js
const API_BASE_URL = "http://localhost:3001";
```

Change this to your deployed backend URL once it's live.

Auth token + user info are stored in `localStorage` (`cw_token`,
`cw_user`). A 401 from any request clears the session and bounces back
to the login page.

## Features

- **Ask + history** — ask a legal question (jurisdiction picker: India +
  major states, or type your own), browse/search/filter past questions,
  paginated with a "Load more" button.
- **Editable answers** — click the pencil icon on an answer to edit the
  text and citations before saving (`PUT /history/:id`).
- **PDF export** — download any answer or draft as a PDF (client-side,
  via jsPDF — no backend round trip).
- **Drafts + reminders** — write a draft, set a reminder date; the backend
  emails you when it's due (make sure `RESEND_API_KEY` is set on the
  backend, otherwise reminders just won't send).
- **Forgot / reset password** — `index.html` has a "Forgot password?" link;
  the reset link from the email opens `index.html?view=reset-password&...`
  automatically.
- **Light / dark theme** — toggle button in the dashboard header and on the
  landing page; preference is saved to `localStorage` (`cw_theme`) and
  applied on load by `js/theme.js` (included early in `<head>` on every
  page to avoid a flash of the wrong theme).

## Deploying

1. **Backend** needs to be deployed somewhere reachable (Railway, Render,
   Fly.io, etc.) — `npm start` (or `node index.js`) as the start command.
   Set the same env vars as your local `.env` in the host's dashboard,
   including `FRONTEND_URL` pointed at your deployed frontend (used to
   build links in emails).
2. Update `js/config.js` in this frontend with the deployed backend URL.
3. Push this folder to a repo and import it into Vercel/Netlify as a
   static site (no build command, no framework preset).
4. Backend already has `cors()` enabled with no origin restriction, so
   it'll accept requests from the deployed frontend's domain as-is.
