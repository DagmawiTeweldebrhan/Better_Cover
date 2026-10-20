# Chrome Web Store submission draft

These fields describe the default free local template build. Submission is pending screenshots, published contact/privacy URLs, and access to the Chrome Web Store developer dashboard. The optional cloud AI build needs different disclosures and is not this release.

## Name

Better Cover

## Short description

Create editable cover-letter drafts from resume templates and matching job details, privately in your browser.

## Detailed description

Create a cover-letter draft grounded in your resume and matching job details, with no account or AI subscription.

Better Cover brings your resume, the job description, and template preferences together in Chrome's side panel. Import job details from LinkedIn, Indeed, Greenhouse, Lever, or Handshake, or enter them yourself. Review imported details before drafting.

- Save multiple resume versions as text or Markdown.
- Choose a professional, friendly, or confident tone.
- Select brief, balanced, or detailed templates with different numbers of matched resume excerpts.
- Keep editing notes to apply when reviewing your draft.
- Edit the drafted letter, copy it, or download it as a text file.
- Revisit drafted letters in local browser history.

No account, backend, AI service, or generation credits are needed. Templates use matched skills and resume excerpts rather than a language model. Editing notes are not interpreted automatically. Review your letter, add your signature, and check the facts before using it. Job-board layouts can change; manual entry is available when extraction misses information.

Resumes and original drafted letters are stored in this browser profile. No document text is sent to OpenAI, Supabase, or another drafting server in this version. Removing the extension or clearing its storage deletes local data. Download letters you want to keep. Better Cover does not submit applications for you.

## Single purpose

Help users create and edit cover letters using their stored resumes and job descriptions they explicitly select.

## Permissions justification

| Permission | Use |
| --- | --- |
| `activeTab` | Identify the current job tab after the user invokes the extension. |
| `storage` | Keep resumes and original letter history locally, plus the current browser-session editor draft and editing notes. |
| `sidePanel` | Display the resume, job, generation, editor, and history interface beside the job page. |
| `scripting` | Load the extractor when an already-open supported job tab does not yet have its content script. |
| Supported job-board hosts | Read job title, company, and description when the user requests an import. |

## Data disclosures to enter accurately in the dashboard

The extension processes resume text, selected job details, preferences, and drafted letters locally. It does not transmit this information to the developer or an AI service. The user may explicitly copy or download it. Describe this local processing accurately in the privacy policy and answer dashboard questions according to Google's current definition of collection. There is no account login or developer-operated data collection in the local build.

The extension bundles its executable JavaScript and templates locally and does not load remotely executed code.

## Reviewer setup

No test account is needed. Open the side panel, save a synthetic sample resume, import or paste a matching job, choose **Create my template draft**, edit/download it, and inspect history. State clearly that this package uses templates and has no AI or sign-in requirement.

## Required live values before submission

- Chrome Web Store item ID and package public key for a consistent development identity; no backend CORS or OAuth configuration is required for local mode.
- Public privacy-policy URL describing local storage, deletion, and the actual operator contact.
- Support URL/contact and applicable developer account disclosures.
- Screenshots of the configured extension using synthetic sample data.

Official references: [listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [purpose, permissions, and privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
