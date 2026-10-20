# Better Cover

A Chrome / Edge side panel that turns a saved resume and a job description into an editable cover letter. Built from [the system architecture](system_architecture_document.md).

## Included

- React, TypeScript, Tailwind, Vite, CRXjs, and a Manifest V3 service worker.
- Job extraction for LinkedIn, Indeed, Greenhouse, Lever, and Handshake, with JSON-LD fallback and manual entry.
- Email signup/login and Google OAuth through Supabase; token refresh in the background worker.
- Multiple text/Markdown resumes, editing, deletion, and text-file import.
- Professional/friendly/confident tone, three length settings, and custom instructions.
- Server-side OpenAI Responses API generation using configurable `gpt-4o`; editable output, copy, and text download.
- Paginated generation history and deletion.
- Ten free credits per UTC calendar month; server-managed premium accounts do not consume credits.
- PostgreSQL row-level security, validated inputs, exact-origin CORS, rate limits, atomic credits, refunds, and abandoned-request recovery.
- Automated API, database, extraction, browser UI, and packaged-extension tests; GitHub Actions and a Render blueprint.

## Run locally

For an interactive UI preview without credentials or extension installation, run `npm.cmd run demo` and open `http://127.0.0.1:4174`. This clearly labeled demo uses sample data and fixed example letters; it does not authenticate real accounts, scrape your tabs, or call AI. Changes stay in the current browser tab's session. The demo adapter is served separately and is never bundled into the extension.

Use Node.js 24 and npm. In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```powershell
npm.cmd ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/extension/.env.example apps/extension/.env
```

1. Create a Supabase project. Run [the migration](supabase/migrations/202610200001_initial.sql) once in its SQL Editor (or use the Supabase CLI).
2. Fill `apps/api/.env` with the Supabase URL, publishable/anon key, **server-only service-role key**, and **server-only OpenAI API key**. Set the extension `.env` to the same Supabase URL and publishable/anon key. Keep all secrets out of `VITE_*` values.
3. Build the extension: `npm.cmd run build -w @better-cover/extension`.
4. Open `chrome://extensions` (or `edge://extensions`), enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`.
5. Copy its extension ID into `ALLOWED_ORIGINS=chrome-extension://YOUR_ACTUAL_ID` in the API `.env`. The API intentionally rejects placeholder IDs. Use comma-separated exact origins for more than one installation.
6. Start the API in one terminal: `npm.cmd run dev:api`. Click the extension action to open the side panel. Create an account, confirm the email, and sign in. Save a resume before generating a letter.

The production build works without a running Vite server. For frontend hot reload, run `npm.cmd run dev:extension`, reload the unpacked extension, and keep the Vite process running. After switching back to a production build, reload the extension again. Refresh an already-open job page if the extension was installed while the page was open.

API health is available at `http://localhost:3001/health`. It checks the process, not external provider availability.

## Google sign-in

Enable Google in Supabase Authentication → Providers and configure its OAuth client. Add `https://YOUR_EXTENSION_ID.chromiumapp.org/auth` to Supabase's redirect allowlist. Configure the Google OAuth callback using the Supabase provider dashboard's callback URL. Rebuild the extension after changing its public `.env` values. Email login works without Google configuration.

Chrome derives an unpacked extension ID from its path unless you set a public manifest key. For a stable ID across machines and store releases, set `VITE_EXTENSION_PUBLIC_KEY` to the extension's public key and rebuild; update CORS and the OAuth allowlist to that ID. Never place a private signing key in the repository.

## Verify

```powershell
npm.cmd run check
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd audit
```

`check` runs type checking, API/extractor/database tests, both production builds, and a packaged-extension entry-point check. Database tests execute the migration in an in-memory PostgreSQL instance with Supabase auth roles and RLS. Browser tests exercise the UI with controlled responses and load the actual compiled extension in Chromium. They require no paid APIs or real account credentials. Live Supabase, Google, OpenAI calls and current authenticated job-board markup must also be checked with your configured accounts before release.

With real backend credentials configured, `npm.cmd run test:live -- --skip-generation` verifies authentication and resume CRUD without AI charges. Omit `--skip-generation` only when you intend to exercise the configured generation provider. These checks use synthetic data and delete their own test account afterward. See [deployment state](docs/DEPLOYMENT.md) for the current external-service blockers.

## Deploy

For account provisioning access, copy `.env.provision.example` to `.env.provision` and fill the Supabase personal access token, Render API key, and server-only OpenAI API key locally. The filled file is ignored by Git. Run `npm.cmd run check:cloud` to verify account access without creating resources or making paid generation requests. The [store listing draft](docs/STORE_LISTING.md) includes submission text, permission justifications, and the remaining live details needed for review.

The [Render blueprint](render.yaml) builds and runs the API from this workspace. Import it in Render, review the selected service plan, and set the required environment values. Use the resulting HTTPS URL as `VITE_API_URL`, rebuild the extension, and reload it. The manifest automatically includes the API origin. Run one API instance with the current in-memory rate limiter; use a shared rate-limit store before adding instances. `TRUST_PROXY_HOPS=1` is supplied for Render; use `0` for a direct local server.

GitHub Actions verifies pushes and pull requests and uploads the built extension as an artifact. Zip the **contents** of `apps/extension/dist` for store submission. Browser icons are included; run `npm.cmd run icons` after editing `apps/extension/public/icon.svg` to regenerate them. Supply store listings, screenshots, a hosted privacy policy, and developer-account details before publishing. Neither cloud deployment nor store publication is performed by a Git push.

## Data and security

Only the background worker holds access tokens. Access tokens live in `chrome.storage.session`; refresh tokens live in `chrome.storage.local`, restricted to trusted extension contexts. Signing out clears the local session and draft. Resume text and generated letters are stored in Supabase. The API verifies the access token with Supabase, then explicitly scopes every service-role query to that verified user. Database clients can read their own rows but cannot alter credits, create history, or call privileged credit functions.

When you generate, the server sends the selected resume, job fields, and preferences to OpenAI. It sets `store: false` for Responses and does not log document contents or tokens; provider retention is governed by your OpenAI project configuration. The active job page is read only on **Use job from current tab**. The extension never submits applications.

Generation reserves a credit in a database transaction before contacting OpenAI, then saves the result. Failed requests refund once; reservations abandoned by a process crash expire after ten minutes and recover on the next profile read or generation. If the response is lost after the server saved a letter, check History before retrying. Letter edits persist in the browser session; history retains the originally generated text. Monthly renewal happens on profile reads and generation; it is not a background cron job.

Resumes and letters can be deleted from the UI. Account deletion is currently an administrator action through Supabase Auth and cascades to all associated data. Premium/student assignments are administrator-managed, never accepted from clients.

## Scope of the business section

The architecture's subscription prices, university partnerships, custom premium models, and Notion/Sheets syncing are growth proposals. This implementation includes credits and account tiers; it does not collect payments, create subscriptions, or connect to job trackers. Those integrations require separate provider and product choices.

OpenAI implementation reference: [official Responses quickstart](https://developers.openai.com/api/docs/quickstart). Authentication reference: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
