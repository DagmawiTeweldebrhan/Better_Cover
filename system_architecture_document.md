# Cover Letter Generator Extension - System Architecture

## 1. Project Overview

A browser extension (Chrome/Edge) that extracts job descriptions from job boards (LinkedIn, Indeed, Handshake, etc.), combines them with a user's stored resume, and uses an LLM (Large Language Model) to generate a highly tailored, ATS-friendly cover letter.

## 2. High-Level Architecture

The system consists of two main parts: a **Manifest V3 Browser Extension** (Frontend) and a **Cloud Backend / API Gateway** (Backend).

```
graph TD
    subgraph Browser Extension
        CS[Content Script: Scrapes Job Data]
        POP[Popup/SidePanel UI: React App]
        BG[Background Service Worker: State & Auth]
        CS <-->|Message Passing| BG
        POP <-->|Message Passing| BG
    end

    subgraph Backend API
        API[Node.js / Express API]
        AUTH[Auth Service: Supabase/Firebase]
        DB[(PostgreSQL Database)]
        LLM[LLM Service: OpenAI/Claude API]
    end

    BG <-->|HTTPS REST| API
    API <--> AUTH
    API <--> DB
    API <--> LLM


```

## 3. Technology Stack

* **Extension Frontend:** React.js, TypeScript, Tailwind CSS, Vite (with `@crxjs/vite-plugin` for Manifest V3).

* **Backend Server:** Node.js, Express, TypeScript, Zod (for validation).

* **Database & Auth:** Supabase (PostgreSQL + GoTrue Auth).

* **AI Integration:** OpenAI API (GPT-4o or GPT-3.5-turbo).

* **Deployment:** Vercel/Render (Backend API), Chrome Web Store (Extension).

## 4. Component Breakdown: Browser Extension

### 4.1. Manifest V3 Configuration (`manifest.json`)

* **Permissions:** `activeTab`, `storage`, `sidePanel`, `identity`, `scripting`.

* **Host Permissions:** `*://*.linkedin.com/*`, `*://*.indeed.com/*`, `*://*.greenhouse.io/*`, `*://*.lever.co/*`, `*://*.joinhandshake.com/*`, plus the Backend API URL.

* **Action:** Triggers the Side Panel or Popup.

### 4.2. Modules

1. **Content Script (`content/index.ts` & Extractors):**

   * Listens for messages from the Background Script.

   * Uses domain-specific extractors to parse the DOM.

   * *Example Extractor Strategy:*

     * `linkedin.ts`: Targets `.jobs-description__content`

     * `handshake.ts`: Targets Handshake-specific job classes.

       ```
       export const extractHandshakeJob = () => ({
         title: document.querySelector('.style__job-title__...')?.innerText || '',
         company: document.querySelector('.style__company-name__...')?.innerText || '',
         description: document.querySelector('.style__description__...')?.innerText || '',
         platform: 'Handshake'
       });
       
       
       ```

   * Returns extracted `{ jobTitle, companyName, jobDescription, platform }`.

2. **Background Service Worker (`background/index.ts`):**

   * Handles OAuth login via `chrome.identity`.

   * Manages API key security (if users provide their own) via `chrome.storage.local`.

   * Acts as a message router between Content Script, UI, and external Backend API.

3. **User Interface (`src/App.tsx`):**

   * **Views:** Login/Signup, Resume Manager (supports multiple versions), Job Details (auto-filled from scraper), Generation Settings (Tone, Length, Special Rules), Editor/Result View.

## 5. Component Breakdown: Backend API

### 5.1. Rationale

A backend is required to securely store the OpenAI API key, manage user subscriptions/credits, securely store user resumes, and log generation history.

### 5.2. Folder Structure

```
/src
  /controllers    # Route logic (auth, resume, generate)
  /middlewares    # Auth validation, Rate limiting
  /models         # Database schemas/types
  /routes         # Express route definitions
  /services       # LLM calling logic, DOM parsing fallback
  server.ts       # Entry point


```

## 6. Database Schema (PostgreSQL via Supabase)

### Table: `users`

* `id` (UUID, PK)

* `email` (String, Unique)

* `credits` (Integer, default: 10)

* `user_type` (Enum: 'standard', 'student', 'premium')

* `created_at` (Timestamp)

### Table: `resumes`

* `id` (UUID, PK)

* `user_id` (UUID, FK -> users.id)

* `title` (String) - e.g., "Frontend Resume", "PM Master Profile"

* `content` (Text) - Extracted text or Markdown of the resume

* `created_at` (Timestamp)

* `updated_at` (Timestamp)

### Table: `generations` (History/Logs)

* `id` (UUID, PK)

* `user_id` (UUID, FK -> users.id)

* `resume_id` (UUID, FK -> resumes.id)

* `job_title` (String)

* `company_name` (String)

* `platform` (String) - e.g., 'LinkedIn', 'Handshake'

* `cover_letter_output` (Text)

* `created_at` (Timestamp)

## 7. API Specification (REST)

### Auth & Users

* `POST /api/auth/login`: Handles Supabase token exchange.

* `GET /api/users/me`: Returns user profile and remaining credits.

### Resumes

* `GET /api/resumes`: Fetch all resumes for the authenticated user.

* `POST /api/resumes`: Upload a new resume text.

* `PUT /api/resumes/:id`: Update an existing resume.

* `DELETE /api/resumes/:id`: Delete a resume.

### AI Generation

* `POST /api/generate`

  * **Headers:** `Authorization: Bearer <token>`

  * **Body:**

    ```
    {
      "resumeId": "uuid",
      "jobTitle": "Frontend Developer",
      "companyName": "TechCorp",
      "jobDescription": "Must know React and TypeScript...",
      "tone": "professional",
      "length": "short",
      "customInstructions": "Do not use the word 'passionate'"
    }
    
    
    ```

  * **Response:**

    ```
    {
      "success": true,
      "coverLetter": "Dear Hiring Manager...",
      "creditsRemaining": 9
    }
    
    
    ```

## 8. LLM Pipeline & Prompt Engineering

The backend service (`services/llm.ts`) will construct the system prompt.
**System Prompt Structure:**

> You are an expert career coach and cover letter writer. Your task is to write a cover letter based on the provided Resume and Job Description.
> Rules:
>
> 1. Tone: {userTone}
>
> 2. Length: {userLength}
>
> 3. Custom Instructions: {customInstructions}
>
> 4. Do not invent experiences not found in the resume.
>
> 5. Highlight specific connections between the resume and the job requirements (Proof-Point Matching).
>
> 6. Output ONLY the cover letter text, no preamble.

## 9. Monetization, B2B & Growth Strategies

* **Freemium Tier:** 5 to 10 free cover letters per month.

* **Pro Tier (\$5–$12/month):** Unlimited generations, custom LLM models, auto-syncing to job trackers (Notion/Google Sheets), and multi-resume management.

* **University/B2B Partnerships:** Because the extension natively supports Handshake extraction, it can be licensed directly to university career centers or coding bootcamps to assist graduating students at scale.

## 10. Security & Performance

1. **CORS:** Backend must restrict CORS to the extension's Chrome ID (e.g., `chrome-extension://<id>`).

2. **Rate Limiting:** Implement `express-rate-limit` on the `/api/generate` endpoint to prevent API abuse.

3. **Token Management:** Store JWTs securely in the extension using `chrome.storage.session` or `chrome.storage.local`.

## 11. Implementation Steps for AI Coding Assistants (Codex/Cursor)

1. **Initialize Workspace:** Create a Vite React TS project with CRXjs for the frontend, and a Node/Express project for the backend.

2. **Extension Setup:** Configure Manifest V3 and build the basic UI layout in the Side Panel using Tailwind CSS.

3. **Scraping Modules:** Implement Content Scripts for DOM text extraction. *Crucial: Create modular extractor files for LinkedIn, Indeed, Greenhouse, Lever, and Handshake.*

4. **Backend Setup:** Initialize Backend Express app, connect Supabase, and configure Zod validation.

5. **Database CRUD:** Create DB Tables (Users, Resumes, Generations) and implement REST routes.

6. **LLM Integration:** Implement OpenAI API integration in the Backend using the structured prompt pipeline.

7. **Client-Server Wiring:** Connect Extension UI to Backend API via authenticated `fetch` requests.

8. **Polish:** Implement UI state (loading spinners, error handling, copy-to-clipboard functionality, and tone/length sliders).