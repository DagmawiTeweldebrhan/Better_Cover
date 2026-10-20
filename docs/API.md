# REST API

Base URL: `/api`. Send JSON bodies with `Content-Type: application/json`. Every route except `/auth/*` requires `Authorization: Bearer <Supabase access token>`. Errors return `{ "error": "message" }`.

| Method | Path | Body / result |
| --- | --- | --- |
| POST | `/auth/signup` | `{email,password}` → `{session,confirmationRequired}` |
| POST | `/auth/login` | `{email,password}` → Supabase session with access/refresh tokens |
| POST | `/auth/refresh` | `{refreshToken}` → refreshed Supabase session |
| GET | `/users/me` | `{id,email,credits,user_type}` |
| GET | `/resumes` | All owned resumes, newest update first |
| POST | `/resumes` | `{title,content}` → saved resume (201) |
| PUT | `/resumes/:id` | `{title,content}` → updated owned resume |
| DELETE | `/resumes/:id` | Delete owned resume (204); history remains |
| GET | `/generations?offset=0` | Up to 20 completed owned letters, newest first |
| DELETE | `/generations/:id` | Delete owned completed letter (204) |
| POST | `/generate` | See example below |

```json
{
  "resumeId": "your-resume-uuid",
  "jobTitle": "Frontend Developer",
  "companyName": "Acme",
  "jobDescription": "A full job description of at least 50 characters...",
  "platform": "LinkedIn",
  "tone": "professional",
  "length": "medium",
  "customInstructions": "Focus on my accessibility experience."
}
```

Successful generation returns `{success:true,coverLetter,creditsRemaining}`. Tone is `professional`, `friendly`, or `confident`; length is `short`, `medium`, or `long`. Resume content and job descriptions are limited to 40,000 characters; custom instructions to 2,000. Passwords must be 8–128 characters. Titles and company names are limited to 200; resume names to 120. Resume IDs must be UUIDs.

Statuses: 400 invalid input; 401 missing/expired authentication; 402 no credits; 403 disallowed origin; 404 missing owned record; 413 oversized body; 429 rate limit; 502 writing-service failure; 503 storage unavailable. Authentication allows 30 requests per 15 minutes per IP. Generation allows five requests per minute per verified user. CORS permits only configured exact origins; authenticated command-line requests without an Origin header are supported.
