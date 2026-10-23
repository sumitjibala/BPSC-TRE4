# TRE 4.0 Computer Science Success Academy — Phase 1

BPSC TRE 4.0 (PGT, Class 11–12) Computer Science ki taiyaari ke liye personal study platform.

## Phase 1 me kya-kya hai
- Responsive dashboard: aaj ka plan, syllabus progress, streak, due revisions, kamzor topics, recent results
- Provisional syllabus tracker: 12 units, 35 topics — status (Not Started / In Progress / Completed), accuracy ke saath (official syllabus aane tak "Not yet verified" label ke saath)
- Lesson interface: har topic me Introduction, Prerequisite, Step-by-step exam notes, Worked Example, Exam Trap, Summary, aur 3 sawal ka Understanding Check
- Watch & Learn: YouTube search (API key ho to verified list, warna seedha YouTube search link — koi link invent nahi hota)
- Document upload: PDF / DOCX / TXT se text + MCQ-pattern questions auto-extraction, manual correction interface, duplicate flag, "Review zaroori" flags. Answer kabhi guess nahi hota — answer key ho tabhi set hota hai
- MCQ Practice: 350 original practice questions (TRE pattern based, ye asli PYQ NAHI hain — asli PYQ upload ke baad alag label me aate hain), topic/difficulty/count choose karke, har sawal ke baad ya aakhir me explanation
- Mock Tests: Full Mock 150 (provisional pattern), CS/GS/Language sectional — timer, palette, mark-for-review, topic-wise result. Score ko official result nahi bataya jata
- Daily Planner: 150 minute (settings se badal sakte ho) ka auto plan — progress + revision due ke hisaab se
- Revision Center: Spaced repetition Day 1-3-7-14-30, performance par adjust hota hai
- Error Notebook: har galat jawab auto-save, galti ki category (conceptual, formula, calculation…), "sudhaar liya" tracking, sirf-galat-sawalo ki practice
- Notes: topic-linked personal notes
- Analytics: topic-wise accuracy, mistake categories, score trend
- Settings: roz ka time, dark/light theme, progress export (JSON), API status

## Data kahan rehta hai?
Phase 1 me personal data (progress, notes, errors, documents se nikle questions) user ke browser ke localStorage me rehta hai — isliye bina kisi account/API key ke app chalti hai. Cloud sync (Supabase) aur AI features (Gemini) Phase 2 me aayenge.

## Chalana (local)
```
npm install
npm start
# http://localhost:3000
```

## Deploy
`DEPLOY.md` dekho — GitHub par upload karke Render Blueprint se one-click deploy hota hai (render.yaml repo ke root me hai).

## Env variables (Phase 2 ke liye, abhi optional)
- `GEMINI_API_KEY` — AI teacher / question generation (Google AI Studio se free)
- `YOUTUBE_API_KEY` — verified YouTube video search (Google Cloud Console se free)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — cloud database (baad me)

Keys kabhi code ya chat me mat daalo — sirf Render ke Environment settings me.
