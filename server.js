// TRE 4.0 Computer Science Success Academy — Phase 2 server
// Kaam: static app serve karna + document upload se text/questions extract karna
// + Gemini AI endpoints (tutor, topic explain, MCQ generator).
// Koi bhi API key client ko kabhi nahi bheji jati — keys sirf env variables me rehti hain.

const path = require('path');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'tre4-cs-academy', phase: 2, time: new Date().toISOString() });
});

// ---------- API configuration status (sirf true/false, key ki value kabhi nahi) ----------
app.get('/api/config/status', (req, res) => {
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    phase: 2,
    note: 'Phase 2: AI Tutor, AI Explain aur AI MCQ Generator ke liye GEMINI_API_KEY chahiye. YouTube verified search YOUTUBE_API_KEY se chalta hai.',
  });
});

// ---------- Document extraction ----------
// File RAM me rehta hai (disk par save nahi hota) — Render ki disk temporary hoti hai,
// isliye extracted result browser ko wapas bhej dete hain, wahi localStorage me save hota hai.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// Plain text se MCQ-pattern ke questions nikaalne ki koshish.
// Pattern: "1. question..." ya "Q1." ke baad (A)/(B)/(C)/(D) ya A. B. C. D. options.
// Jo question aadha mile ya options na milein, use 'needsReview: true' flag ke saath bhejte hain — kabhi chup-chaap guess nahi karte.
function extractQuestionsFromText(text, sourceName) {
  const questions = [];
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  // Question blocks: number se shuru hone wali lines
  const blockRegex = /(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})[\.)]\s+([\s\S]*?)(?=(?:\n\s*(?:Q\.?\s*)?\d{1,3}[\.)]\s+)|$)/g;
  let m;
  while ((m = blockRegex.exec(normalized)) !== null) {
    const number = parseInt(m[1], 10);
    let body = (m[2] || '').trim();
    if (body.length < 15) continue; // bahut chhota block question nahi ho sakta
    // Options khojo: (A) ... (B) ... ya A) ... B) ...
    const optRegex = /\(?([A-Da-d])\)?[.)]\s*/g;
    const marks = [];
    let om;
    while ((om = optRegex.exec(body)) !== null) {
      marks.push({ label: om[1].toUpperCase(), start: om.index, end: optRegex.lastIndex });
    }
    let questionText = body;
    const options = [];
    let needsReview = true;
    if (marks.length >= 4) {
      const seq = marks.slice(-4);
      const inOrder = seq.map((s) => s.label).join('') === 'ABCD';
      if (inOrder) {
        questionText = body.slice(0, seq[0].start).trim();
        for (let i = 0; i < 4; i++) {
          const from = seq[i].end;
          const to = i < 3 ? seq[i + 1].start : body.length;
          options.push(body.slice(from, to).trim().replace(/\s+/g, ' '));
        }
        needsReview = options.some((o) => !o) || questionText.length < 8;
      }
    }
    if (questionText.length > 600) questionText = questionText.slice(0, 600);
    questions.push({
      id: 'doc-' + Date.now().toString(36) + '-' + questions.length,
      question_number: number,
      question_text: questionText.replace(/\s+/g, ' '),
      options,
      correct_answer: null, // Answer key alag se mile tabhi bhara jayega — guess kabhi nahi
      explanation: '',
      primary_topic: 'Unclassified',
      difficulty: 'medium',
      source_document: sourceName,
      sourceType: 'uploaded',
      answer_key_status: 'not_available',
      needsReview,
    });
    if (questions.length >= 500) break; // ek document se max 500
  }
  return questions;
}

function findDuplicates(questions) {
  const seen = new Map();
  const dupIds = [];
  for (const q of questions) {
    const key = q.question_text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, ' ').trim().slice(0, 120);
    if (key && seen.has(key)) dupIds.push(q.id);
    else if (key) seen.set(key, q.id);
  }
  return dupIds;
}

app.post('/api/documents/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Koi file nahi mili. Pehle file choose karo.' });
    const name = req.file.originalname || 'document';
    const ext = path.extname(name).toLowerCase();
    let text = '';
    let pages = null;
    const warnings = [];

    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(req.file.buffer);
      text = data.text || '';
      pages = data.numpages || null;
      if (!text.trim()) warnings.push('PDF se text nahi nikla — ye scanned/image PDF ho sakta hai. OCR Phase 2 (Gemini) me aayega; abhi ke liye is document ko flag kiya gaya hai.');
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value || '';
    } else if (ext === '.txt' || ext === '.md') {
      text = req.file.buffer.toString('utf8');
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      warnings.push('Image upload mil gaya, lekin OCR Phase 2 me Gemini key ke saath chalega. Abhi image ko library me sirf reference ke roop me rakha gaya hai.');
      return res.json({ ok: true, name, ext, pages: null, chars: 0, textPreview: '', questions: [], duplicates: [], warnings, ocrPending: true });
    } else {
      return res.status(400).json({ ok: false, error: 'Ye file type support nahi hai. PDF, DOCX, TXT ya image bhejo.' });
    }

    const questions = extractQuestionsFromText(text, name);
    const duplicates = findDuplicates(questions);
    if (questions.length === 0 && text.trim()) {
      warnings.push('Text to nikal aaya, lekin MCQ pattern (numbering + A/B/C/D options) auto-detect nahi hua. Text preview dekh kar questions ko manual review ke liye rakha gaya hai.');
    }
    res.json({
      ok: true,
      name,
      ext,
      pages,
      chars: text.length,
      textPreview: text.slice(0, 4000),
      questions,
      duplicates,
      warnings,
    });
  } catch (err) {
    console.error('extract error:', err);
    res.status(500).json({ ok: false, error: 'Document process karne me error aaya: ' + (err.message || 'unknown') });
  }
});

// ---------- YouTube search ----------
// YOUTUBE_API_KEY ho to asli API se verified results; na ho to YouTube search page ka
// seedha link dete hain — video URL kabhi invent nahi karte.
app.get('/api/youtube/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'Search query (topic) bhejo.' });
  const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' BPSC TRE computer science');
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.json({ ok: true, mode: 'link', searchUrl, videos: [], note: 'YOUTUBE_API_KEY set nahi hai — search link diya gaya hai. Key Phase 2 setup me lagegi.' });
  try {
    const api = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=' +
      encodeURIComponent(q) + '&key=' + encodeURIComponent(key);
    const r = await fetch(api);
    if (!r.ok) throw new Error('YouTube API status ' + r.status);
    const data = await r.json();
    const videos = (data.items || []).map((it) => ({
      title: it.snippet && it.snippet.title,
      channel: it.snippet && it.snippet.channelTitle,
      url: 'https://www.youtube.com/watch?v=' + it.id.videoId,
      verified: true,
    }));
    res.json({ ok: true, mode: 'api', searchUrl, videos });
  } catch (err) {
    res.json({ ok: true, mode: 'link', searchUrl, videos: [], note: 'YouTube API se result nahi aaya (' + err.message + ') — search link diya gaya hai.' });
  }
});

/* ---------------- Phase 2: Gemini AI ---------------- */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const aiHits = new Map(); // ip -> [timestamps] (simple rate limit: 40 calls / 10 min)
function aiRateOk(ip) {
  const now = Date.now();
  const arr = (aiHits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now); aiHits.set(ip, arr);
  return arr.length <= 40;
}
async function geminiGenerate(prompt, jsonMode) {
  const key = process.env.GEMINI_API_KEY;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(GEMINI_MODEL) + ':generateContent';
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: jsonMode ? { responseMimeType: 'application/json', temperature: 0.4 } : { temperature: 0.6 },
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error('Gemini API error ' + r.status + (txt.includes('API_KEY_INVALID') ? ' (key galat hai)' : ''));
  }
  const data = await r.json();
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}
function noKey(res) {
  return res.json({ ok: true, mode: 'no-key', note: 'GEMINI_API_KEY set nahi hai. Key Google AI Studio (aistudio.google.com) se free banti hai aur Render ke Environment me daalni hai.' });
}
function aiFail(res, err) {
  return res.json({ ok: true, mode: 'error', note: 'AI se jawab nahi aaya: ' + (err.message || 'unknown') + ' — thodi der baad dobara koshish karo, ya key/quota check karo.' });
}

// AI Tutor — Hinglish teacher, syllabus + student data + uploaded doc snippets context ke roop me
app.post('/api/ai/tutor', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return noKey(res);
  if (!aiRateOk(req.ip)) return res.json({ ok: true, mode: 'error', note: 'Bahut zyada AI requests ho gayi hain — 10 minute ruk kar koshish karo.' });
  try {
    const { messages = [], context = {} } = req.body || {};
    const history = messages.slice(-8).map((m) => (m.role === 'user' ? 'Student: ' : 'Teacher: ') + String(m.text || '').slice(0, 1500)).join('\n');
    const docText = (context.docSnippets || []).slice(0, 2).map((d) => `[Document: ${d.name}]\n${String(d.text || '').slice(0, 1500)}`).join('\n---\n');
    const prompt = `Tum "TRE 4.0 CS Academy" ke AI teacher ho. Student BPSC TRE 4.0 PGT Computer Science (Class 11-12) ki taiyaari kar raha hai, beginner level, roz 2-3 ghante padhta hai.
Niyam:
- Jawab simple Hindi/Hinglish me do, technical terms English me rakho.
- Step-by-step samjhao, chhota example do, aur aakhir me 1 check question puchho (uska answer mat do).
- Exam facts ke baare me pakka na ho to saaf bolo ki official notification se confirm karna hoga — kuch invent mat karo.
- Agar document ka hissa diya gaya hai aur jawab usi par hai, to aakhir me "Source: <document name>" zaroor likho.
Student ka context: Next topic: ${context.nextTopic || 'pata nahi'}; Revision due: ${(context.dueRevisions || []).join(', ') || 'koi nahi'}; Kamzor topics: ${(context.weakTopics || []).join(', ') || 'abhi data nahi'}.
${docText ? 'Uploaded document ke hisse:\n' + docText : ''}
Baat-cheet:
${history}
Teacher:`;
    const reply = await geminiGenerate(prompt, false);
    res.json({ ok: true, mode: 'ai', reply });
  } catch (err) { aiFail(res, err); }
});

// Topic ko gehrai se samjhana — lesson ke points par based vistaar
app.post('/api/ai/explain', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return noKey(res);
  if (!aiRateOk(req.ip)) return res.json({ ok: true, mode: 'error', note: 'Rate limit — thodi der baad koshish karo.' });
  try {
    const { topic, unit, intro, points } = req.body || {};
    const prompt = `BPSC TRE 4.0 Computer Science ke topic "${topic}" (unit: ${unit}) ko beginner student ko gehrai se samjhao.
Basic intro: ${intro}
Key points: ${(points || []).join(' | ')}
Output SIRF JSON me do, koi extra text nahi:
{"deepExplanation":"step-by-step vistaar, simple Hinglish, kam se kam 250 words","examples":["example 1 with steps","example 2","example 3"],"misconceptions":["aam galti 1","aam galti 2"],"revisionSheet":["1-line revision point", "aur 4-5 points"]}`;
    const raw = await geminiGenerate(prompt, true);
    const data = JSON.parse(raw);
    if (!data.deepExplanation) throw new Error('AI jawab adhura aaya');
    res.json({ ok: true, mode: 'ai', data });
  } catch (err) { aiFail(res, err); }
});

// AI MCQ generator — jawab pehle validate hota hai, galat format wala sawal drop ho jata hai.
// In sawalo ko hamesha sourceType "ai-generated" milta hai — asli PYQ kabhi nahi kaha jayega.
app.post('/api/ai/generate-mcq', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return noKey(res);
  if (!aiRateOk(req.ip)) return res.json({ ok: true, mode: 'error', note: 'Rate limit — thodi der baad koshish karo.' });
  try {
    const topic = String((req.body || {}).topic || 'Computer Science').slice(0, 80);
    const difficulty = ['easy', 'medium', 'hard'].includes((req.body || {}).difficulty) ? req.body.difficulty : 'medium';
    const count = Math.min(20, Math.max(1, parseInt((req.body || {}).count, 10) || 10));
    const prompt = `BPSC TRE (PGT Computer Science) pattern par topic "${topic}" ke ${count} ORIGINAL practice MCQ banao, difficulty ${difficulty}.
Har sawal: question English me, 4 options, 1 sahi jawab, aur explanation simple Hinglish me (galat options kyun galat hain, ye bhi ek line me).
Dhyaan: ye previous-year ke asli sawal nahi hain — inhe practice sawal hi rakhna, kisi exam ka naam mat jodna.
Sawal aise banao jinka sahi jawab 100% pakka ho — jahan shak ho waisa sawal mat banao.
Output SIRF JSON array me do:
[{"q":"...","opts":["A","B","C","D"],"ans":0,"exp":"..."}]`;
    const raw = await geminiGenerate(prompt, true);
    const arr = JSON.parse(raw);
    const valid = (Array.isArray(arr) ? arr : []).filter((q) => q && typeof q.q === 'string' && Array.isArray(q.opts) && q.opts.length === 4 && Number.isInteger(q.ans) && q.ans >= 0 && q.ans <= 3 && typeof q.exp === 'string')
      .map((q, i) => ({ id: 'ai-' + Date.now().toString(36) + '-' + i, topic, section: 'CS', diff: difficulty, q: q.q, opts: q.opts, ans: q.ans, exp: q.exp, sourceType: 'ai-generated' }));
    if (!valid.length) throw new Error('AI ke sawal validate nahi hue — dobara koshish karo');
    res.json({ ok: true, mode: 'ai', questions: valid, requested: count, note: valid.length < count ? `Sirf ${valid.length} sawal hi quality-check pass kar paaye, baki hata diye gaye.` : undefined });
  } catch (err) { aiFail(res, err); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('TRE 4.0 CS Academy (Phase 1) listening on port ' + PORT);
});
