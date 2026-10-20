# Deployment state

Updated October 20, 2026.

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
- Choose and implement a zero-cost generation option before completing the generation flow.
- Configure email delivery and Google OAuth for public signup.
- Finalize operator contact, privacy-policy URL, and store reviewer access.
- Upload a draft item to the Chrome Web Store, configure its identity, and submit the tested package.

## Live verification

`npm.cmd run test:live -- --skip-generation` verifies real account authentication and resume CRUD without making an AI request. Running `node scripts/smoke-live.mjs` without `--skip-generation` attempts one real generation; do that only after a working generation provider is configured. The script creates and deletes only its own synthetic test account.
