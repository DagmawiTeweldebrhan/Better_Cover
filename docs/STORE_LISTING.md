# Chrome Web Store submission draft

These fields describe the current implementation. Submission is pending a live backend, working authentication, account credentials for review, screenshots, and published contact/privacy URLs.

## Name

Better Cover

## Short description

Turn your resume and a job description into a tailored, editable cover letter in a browser side panel.

## Detailed description

Write a cover letter grounded in your experience and tailored to your next opportunity.

Better Cover brings your resume, the job description, and your writing preferences together in Chrome's side panel. Import job details from LinkedIn, Indeed, Greenhouse, Lever, or Handshake, or enter them yourself. Review imported details before generating.

- Save multiple resume versions as text or Markdown.
- Choose a professional, friendly, or confident tone.
- Select a brief, balanced, or detailed letter.
- Add preferences such as skills to emphasize or phrases to avoid.
- Edit the generated letter, copy it, or download it as a text file.
- Revisit generated letters in your account history.

An account is required. Standard accounts receive ten generation credits per UTC calendar month. Job-board layouts can change; manual entry is available when extraction misses information. Always review your letter before using it.

Generation sends the selected resume, job details, and writing preferences through our backend to OpenAI. Resumes and generated letters are stored in your Supabase-backed account. Better Cover does not submit applications for you.

## Single purpose

Help users create and edit cover letters using their stored resumes and job descriptions they explicitly select.

## Permissions justification

| Permission | Use |
| --- | --- |
| `activeTab` | Identify the current job tab after the user invokes the extension. |
| `storage` | Keep the authentication session and writing draft; restrict token storage to trusted extension contexts. |
| `sidePanel` | Display the resume, job, generation, editor, and history interface beside the job page. |
| `identity` | Complete the user-initiated Supabase Google OAuth redirect flow with `launchWebAuthFlow`. |
| `scripting` | Load the extractor when an already-open supported job tab does not yet have its content script. |
| Supported job-board hosts | Read job title, company, and description when the user requests an import. |
| Deployed API host | Authenticate the user and access their resumes, generation history, and cover-letter generation endpoint. |

## Data disclosures to enter accurately in the dashboard

Account email, resumes and any personal information the user puts in them, selected job details, writing preferences, authentication tokens, and generated letters are processed by this product. Do not declare that the extension collects no data. Distinguish locally stored session tokens/drafts from account records stored on the backend and document text sent to the AI provider.

The extension bundles its executable JavaScript locally. The API returns data and generated text; it does not supply remotely executed extension code.

## Reviewer setup

Supply a dedicated test account with sufficient credits through the dashboard's private reviewer instructions. Include how to open the side panel, save a sample resume, import or paste a job, generate a letter, and inspect history. Never put review-account passwords in this repository. Verify both email and Google login before claiming both work in the submitted release.

## Required live values before submission

- Production API URL and matching extension host permission.
- Chrome Web Store item ID, matching backend allowed origin, and Google OAuth redirect.
- Public privacy-policy URL describing the deployed service, processors, retention, deletion, and actual operator contact.
- Support URL/contact and applicable developer account disclosures.
- Screenshots of the configured extension using synthetic sample data.

Official references: [listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [purpose, permissions, and privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
