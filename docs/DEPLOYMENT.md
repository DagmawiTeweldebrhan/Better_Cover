# Deployment state

Updated October 20, 2026.

## Active release: local template mode

The user's zero-budget choice is implemented as the default build. Resumes and letter history are stored in local extension storage, and templates run in the service worker. No Supabase account, OpenAI key, Render service, or backend process is required to use this version. Its manifest omits `identity` and API host permissions. Browser tests verify drafting with service-worker fetch disabled. Cloud services below are retained for optional future use and are not contacted in local mode.

## Supabase

- Project: `Better_Cover` (`iozeijrjelovwoqcrlmh`).
- API: `https://iozeijrjelovwoqcrlmh.supabase.co`.
- Applied `202610200001_initial.sql` to the previously empty public schema in a transaction.
- Verified row-level security on `users`, `resumes`, and `generations`.
- Backend credentials are configured only in ignored local environment files.
- Email authentication is enabled. Google OAuth and custom SMTP are not configured yet.

## Extension identity

The committed public key in `config/extension-identity.json` keeps unpacked installs consistent across machines. It contains no private signing key. The current development ID is `afljmjcfbmbagnjmfcgafckcbmmnfice`.

Chrome Web Store assigns the published item's identity. Once the draft item exists, use the public key from its Package tab and update backend CORS and Supabase redirects to that item ID before public release.

## Pending

- Render API credentials are verified, but automatic approval review blocked service creation with `blocked by policy`. No Render service was created.
- Live email/password sign-in, profile initialization, and resume storage have been tested using an isolated synthetic account; test records were removed afterward.
- OpenAI model access works, but generation returns HTTP 429, `credit_balance_exhausted` / `insufficient_quota`. Further paid requests are stopped under the user's zero-budget constraint.
- Local template drafting is implemented and tested as the zero-cost alternative. The original paid AI path remains unavailable until its quota is funded.
- Configure email delivery and Google OAuth for public signup.
- Finalize operator contact, privacy-policy URL, and store reviewer access.
- Public store publication still needs an authenticated developer dashboard and, if not already paid, the developer registration fee. The local build can be shared and installed unpacked without store publication.

## Live verification

`npm.cmd run test:live` verifies real account authentication and resume CRUD without making an AI request. Passing `--generate` explicitly attempts one real cloud generation; do that only after a working generation provider is configured. The script creates and deletes only its own synthetic test account. This cloud check is unnecessary for the free local extension.
