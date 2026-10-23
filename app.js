// TRE 4.0 CS Success Academy — Phase 1 app logic
// Saara personal data (progress, notes, errors, planner) browser ke localStorage me rehta hai —
// isliye refresh ke baad bhi bacha rehta hai, aur bina kisi API key ke app chalti hai.
"use strict";

/* ---------------- State ---------------- */
const LS_KEY = "tre4_state_v1";
const defaultState = () => ({
  progress: {},        // topicId -> {status, confidence, completedOn, nextRevision}
  notes: [],           // {id, topicId, title, body, updated}
  errors: [],          // {id, qid, q, myAns, correctAns, exp, topic, date, category, corrected}
  attempts: [],        // {id, mode, topic, total, correct, date, seconds}
  documents: [],       // {id, name, pages, chars, date, questions:[], warnings:[]}
  plannerDone: {},     // 'YYYY-MM-DD' -> {taskKey: true}
  studyLog: {},        // 'YYYY-MM-DD' -> minutes (approx from completed tasks)
  bookmarks: [],       // question ids
  settings: { dailyMinutes: 150, theme: "light" },
  lastStudyDate: null,
  streak: 0,
});
let state = defaultState();
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
} catch (e) { /* fresh state */ }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { toast("Storage full hai — purane documents hatao."); } }

const $ = (sel) => document.querySelector(sel);
const view = $("#view");
const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2600); }

/* Syllabus helpers */
const ALL_TOPICS = [];
window.SYLLABUS.forEach((u) => u.topics.forEach((t) => ALL_TOPICS.push({ ...t, unit: u.unit, section: u.section })));
const topicById = (id) => ALL_TOPICS.find((t) => t.id === id);
const questionsForTopic = (topic) => window.QUESTIONS.filter((q) => q.topic === topic.qTopic);
function topicStatus(id) { return (state.progress[id] && state.progress[id].status) || "not-started"; }
function accuracyFor(topicName) {
  let tot = 0, cor = 0;
  state.attempts.forEach(() => {});
  // attempts are aggregate; errors hold per-question mistakes — accuracy per topic approximated from error book + attempts on that topic
  const topicAttempts = state.attempts.filter((a) => a.topic === topicName);
  topicAttempts.forEach((a) => { tot += a.total; cor += a.correct; });
  return tot ? Math.round((cor / tot) * 100) : null;
}
function syllabusPercent() {
  const done = ALL_TOPICS.filter((t) => topicStatus(t.id) === "completed").length;
  return { done, total: ALL_TOPICS.length, pct: Math.round((done / ALL_TOPICS.length) * 100) };
}
function dueRevisions() {
  const today = todayStr();
  return ALL_TOPICS.filter((t) => {
    const p = state.progress[t.id];
    return p && p.nextRevision && p.nextRevision <= today && p.status === "completed";
  });
}
function nextTopic() {
  const due = dueRevisions();
  if (due.length) return due[0];
  return ALL_TOPICS.find((t) => topicStatus(t.id) === "in-progress") || ALL_TOPICS.find((t) => topicStatus(t.id) === "not-started") || null;
}
function bumpStreak() {
  const today = todayStr();
  if (state.lastStudyDate === today) return;
  const yesterday = todayStr(new Date(Date.now() - 864e5));
  state.streak = state.lastStudyDate === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastStudyDate = today;
  $("#streakChip").textContent = "🔥 Streak: " + state.streak + " din";
  save();
}

/* ---------------- Navigation ---------------- */
let currentView = "dashboard";
document.querySelectorAll(".nav-btn").forEach((b) => b.addEventListener("click", () => { go(b.dataset.view); $("#sidebar").classList.remove("open"); }));
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
function go(v, arg) {
  currentView = v;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  ({ dashboard: renderDashboard, syllabus: renderSyllabus, learn: renderLearn, documents: renderDocuments, practice: renderPracticeHome, mock: renderMockHome, planner: renderPlanner, revision: renderRevision, errors: renderErrors, notes: renderNotes, analytics: renderAnalytics, settings: renderSettings }[v] || renderDashboard)(arg);
  window.scrollTo({ top: 0 });
}
$("#banner").innerHTML = "⚠️ <b>" + esc(window.SYLLABUS_META.label) + "</b> — " + esc(window.SYLLABUS_META.examPatternNote);

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  const sp = syllabusPercent();
  const due = dueRevisions();
  const nx = nextTopic();
  const lastAttempts = state.attempts.slice(-3).reverse();
  const weak = weakestTopics(3);
  view.innerHTML = `
    <h1>Namaste! Aaj ki padhai shuru karte hain 🙏</h1>
    <p class="muted">Target: BPSC TRE 4.0 — PGT Computer Science (Class 11–12) • Roz ka target: ${state.settings.dailyMinutes} minute</p>
    <div class="grid cols-4">
      <div class="card"><div class="stat-num">${sp.pct}%</div><div class="stat-label">Syllabus complete (${sp.done}/${sp.total} topics)</div><div class="progress" style="margin-top:8px"><div style="width:${sp.pct}%"></div></div></div>
      <div class="card"><div class="stat-num">${state.streak || 0} din</div><div class="stat-label">Learning streak</div></div>
      <div class="card"><div class="stat-num">${due.length}</div><div class="stat-label">Aaj ke revision due</div></div>
      <div class="card"><div class="stat-num">${state.attempts.reduce((s, a) => s + a.total, 0)}</div><div class="stat-label">Kul practice questions solve</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card">
        <h3 style="margin-top:0">📌 Aaj ka plan (auto)</h3>
        <div id="dashPlan"></div>
        <button onclick="go('planner')" style="margin-top:10px">Poora Planner Kholo</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0">➡️ Recommended Next Topic</h3>
        ${nx ? `<p><b>${esc(nx.name)}</b> <span class="muted">(${esc(nx.unit)})</span></p>
        <p class="small muted">⏱ ~${nx.mins} min • Difficulty: ${nx.diff} • Importance: ${nx.imp}</p>
        <button onclick="openLesson('${nx.id}')">Lesson Shuru Karo</button>` : "<p>Saare topics complete! Ab revision aur mock par dhyaan do. 🎉</p>"}
        <h3>📉 Kamzor Topics</h3>
        ${weak.length ? weak.map((w) => `<div class="bar-row"><span class="bar-label">${esc(w.name)}</span><div class="progress"><div style="width:${w.acc}%;background:var(--bad)"></div></div><b>${w.acc}%</b></div>`).join("") : '<p class="muted small">Abhi data nahi — pehle kuch practice karo, fir yahan kamzor topics dikhenge.</p>'}
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <h3 style="margin-top:0">🕘 Recent Test Results</h3>
      ${lastAttempts.length ? `<table><tr><th>Mode</th><th>Topic</th><th>Score</th><th>Date</th></tr>${lastAttempts.map((a) => `<tr><td>${esc(a.mode)}</td><td>${esc(a.topic)}</td><td><b>${a.correct}/${a.total}</b></td><td>${esc(a.date)}</td></tr>`).join("")}</table>` : '<p class="muted">Abhi koi test nahi diya. MCQ Practice se shuru karo.</p>'}
    </div>`;
  renderTodayTasks($("#dashPlan"), true);
}
function weakestTopics(n) {
  const rows = [];
  const seen = new Set();
  state.attempts.forEach((a) => {
    if (a.topic === "Mixed / Full Mock") return;
    const acc = accuracyFor(a.topic);
    if (acc !== null && !seen.has(a.topic)) { seen.add(a.topic); rows.push({ name: a.topic, acc }); }
  });
  return rows.sort((x, y) => x.acc - y.acc).slice(0, n);
}

/* ---------------- Syllabus ---------------- */
function renderSyllabus() {
  const sp = syllabusPercent();
  const filter = renderSyllabus._filter || "all";
  let html = `<h1>Official Syllabus (Provisional)</h1>
    <p class="muted">${esc(window.SYLLABUS_META.label)}. Official PDF aane par Documents page se upload karke is list ko update kiya jayega.</p>
    <div class="card"><div class="bar-row"><span class="bar-label"><b>Coverage: ${sp.done}/${sp.total}</b></span><div class="progress"><div style="width:${sp.pct}%"></div></div><b>${sp.pct}%</b></div>
    <div style="margin:10px 0">
      <button class="ghost-btn" onclick="syllFilter('all')">Sab</button>
      <button class="ghost-btn" onclick="syllFilter('completed')">Completed</button>
      <button class="ghost-btn" onclick="syllFilter('in-progress')">In Progress</button>
      <button class="ghost-btn" onclick="syllFilter('not-started')">Not Started</button>
    </div></div>`;
  window.SYLLABUS.forEach((u) => {
    const topics = u.topics.filter((t) => filter === "all" || topicStatus(t.id) === filter);
    if (!topics.length) return;
    const udone = u.topics.filter((t) => topicStatus(t.id) === "completed").length;
    html += `<details class="unit" open><summary>${esc(u.unit)} <span class="tag">${esc(u.section)}</span> <span class="muted small">${udone}/${u.topics.length} complete</span></summary>`;
    topics.forEach((t) => {
      const acc = accuracyFor(t.qTopic);
      html += `<div class="topic-row">
        <div><div class="t-name">${esc(t.name)}</div>
        <div class="small muted">⏱ ${t.mins} min • ${t.diff} • Importance: ${t.imp} • Practice accuracy: ${acc === null ? "—" : acc + "%"}</div></div>
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
          <span class="pill-status ${topicStatus(t.id) === "completed" ? "done" : topicStatus(t.id) === "in-progress" ? "doing" : ""}">${topicStatus(t.id)}</span>
          <select onchange="setStatus('${t.id}', this.value)">
            <option value="not-started" ${topicStatus(t.id) === "not-started" ? "selected" : ""}>Not Started</option>
            <option value="in-progress" ${topicStatus(t.id) === "in-progress" ? "selected" : ""}>In Progress</option>
            <option value="completed" ${topicStatus(t.id) === "completed" ? "selected" : ""}>Completed</option>
          </select>
          <button onclick="openLesson('${t.id}')">Learn</button>
        </div></div>`;
    });
    html += `</details>`;
  });
  view.innerHTML = html;
}
function syllFilter(f) { renderSyllabus._filter = f; renderSyllabus(); }
function setStatus(id, status) {
  const p = state.progress[id] || {};
  p.status = status;
  if (status === "completed") {
    p.completedOn = todayStr();
    p.nextRevision = addDays(1);
    toast("Topic complete! Revision schedule ban gaya: Day 1, 3, 7, 14, 30.");
  }
  state.progress[id] = p; save(); bumpStreak();
  if (currentView === "syllabus") renderSyllabus();
}
function addDays(n, from) { const d = from ? new Date(from) : new Date(); d.setDate(d.getDate() + n); return todayStr(d); }

/* ---------------- Learn / Lesson ---------------- */
function renderLearn() {
  let html = `<h1>Learn Computer Science</h1><p class="muted">Ek topic chuno — har lesson me intro, stepwise samjhaya hua content, worked example, exam trap aur akhir me samajh-check quiz hai.</p>`;
  window.SYLLABUS.forEach((u) => {
    html += `<h2>${esc(u.unit)}</h2><div class="grid cols-3">`;
    u.topics.forEach((t) => {
      const qs = questionsForTopic(t).length;
      html += `<div class="card"><b>${esc(t.name)}</b>
        <div class="small muted" style="margin:5px 0">⏱ ${t.mins} min • ${t.diff} • ${qs} practice sawal</div>
        <span class="pill-status ${topicStatus(t.id) === "completed" ? "done" : topicStatus(t.id) === "in-progress" ? "doing" : ""}">${topicStatus(t.id)}</span>
        <div style="margin-top:10px"><button onclick="openLesson('${t.id}')">Lesson Kholo</button></div></div>`;
    });
    html += `</div>`;
  });
  view.innerHTML = html;
}
let lessonCheck = null; // {topicId, questions, answers}
function openLesson(id) {
  const t = topicById(id); if (!t) return;
  if (topicStatus(id) === "not-started") setStatusSilent(id, "in-progress");
  const qs = questionsForTopic(t).slice(0, 3);
  lessonCheck = { topicId: id, questions: qs, answers: {} };
  const ytQuery = encodeURIComponent(t.name + " " + t.unit + " hindi explanation");
  view.innerHTML = `
    <button class="ghost-btn" onclick="go('learn')">← Saare Topics</button>
    <h1>${esc(t.name)}</h1>
    <p class="muted">${esc(t.unit)} • ⏱ ~${t.mins} min • Difficulty: ${t.diff} • Importance: ${t.imp}</p>
    <div class="card">
      <h3 style="margin-top:0">A. Introduction</h3><p>${esc(t.intro)}</p>
      <h3>B. Prerequisite</h3><p>Pehle ye aana chahiye: <b>${esc(t.prereq)}</b>${t.prereq !== "Koi nahi" && !t.prereq.startsWith("Koi") ? ' — agar ye kamzor hai to pehle uska lesson kar lo.' : ""}</p>
      <h3>C + D. Step-by-Step Explanation & Exam Notes</h3>
      <ol>${t.points.map((p) => `<li style="margin:6px 0">${esc(p)}</li>`).join("")}</ol>
      <h3>E. Worked Example</h3><div class="explain">${esc(t.example)}</div>
      <h3>⚠️ Common Exam Trap</h3><div class="explain" style="border-color:var(--bad)">${esc(t.trap)}</div>
      <h3>F. Summary — Key Takeaways</h3>
      <ul>${t.points.slice(0, 5).map((p) => `<li>${esc(p.split(":")[0])}</li>`).join("")}<li>Trap yaad rakho: ${esc(t.trap.split("—")[0])}</li></ul>
      <h3>📺 Watch & Learn (YouTube)</h3>
      <div id="ytBox"><button class="ghost-btn" onclick="loadVideos('${esc(t.name)}')">Is topic ke videos khojo</button>
      <a class="btn ghost-btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${ytQuery}">YouTube par search kholo ↗</a>
      <p class="small muted">Video links server se aate hain — API key ho to verified list, warna seedha YouTube search khulta hai. Koi link invent nahi hota.</p></div>
    </div>
    <div class="card" style="margin-top:14px">
      <h3 style="margin-top:0">G. Understanding Check (3 sawal)</h3>
      ${qs.length ? qs.map((q, i) => quizBlock(q, i, "lesson")).join("") : '<p class="muted">Is topic ke practice sawal abhi bank me nahi hain.</p>'}
      ${qs.length ? `<button onclick="submitLessonCheck()">Check Karo</button> <span id="lessonCheckResult" style="margin-left:8px;font-weight:700"></span>` : ""}
    </div>
    <div class="card" style="margin-top:14px">
      <h3 style="margin-top:0">✅ Lesson Khatm?</h3>
      <label>Apni samajh rate karo:</label>
      <select id="confidenceSel"><option value="not-understood">Not Understood</option><option value="partial">Partially Understood</option><option value="understood" selected>Understood</option><option value="confident">Confident</option></select>
      <div style="margin-top:10px"><button class="ok-btn" onclick="completeLesson('${t.id}')">Complete Mark Karo + Revision Schedule Karo</button>
      <button class="ghost-btn" onclick="startPractice({topic:'${esc(t.qTopic)}', count:10})">Is topic ke 10 sawal practice karo</button></div>
    </div>`;
  bumpStreak();
}
function setStatusSilent(id, status) { const p = state.progress[id] || {}; p.status = status; state.progress[id] = p; save(); }
function quizBlock(q, i, prefix) {
  return `<div style="margin:13px 0"><b>Q${i + 1}.</b> ${esc(q.q)}
    ${q.opts.map((o, oi) => `<button class="opt" id="${prefix}-opt-${q.id}-${oi}" onclick="pickOption('${prefix}','${q.id}',${oi})">${"ABCD"[oi]}. ${esc(o)}</button>`).join("")}
    <div id="${prefix}-exp-${q.id}"></div></div>`;
}
const picked = {}; // prefix|qid -> oi
function pickOption(prefix, qid, oi) { picked[prefix + "|" + qid] = oi; document.querySelectorAll(`[id^="${prefix}-opt-${qid}-"]`).forEach((b) => b.classList.remove("selected")); const el = document.getElementById(`${prefix}-opt-${qid}-${oi}`); if (el) el.classList.add("selected"); }
function submitLessonCheck() {
  if (!lessonCheck) return;
  let cor = 0;
  lessonCheck.questions.forEach((q) => {
    const my = picked["lesson|" + q.id];
    const exp = document.getElementById("lesson-exp-" + q.id);
    q.opts.forEach((o, oi) => { const b = document.getElementById(`lesson-opt-${q.id}-${oi}`); if (!b) return; b.disabled = true; if (oi === q.ans) b.classList.add("correct"); else if (oi === my) b.classList.add("wrong"); });
    if (my === q.ans) cor++; else logError(q, my, "conceptual");
    if (exp) exp.innerHTML = `<div class="explain"><b>Samjhaya:</b> ${esc(q.exp)}</div>`;
  });
  const total = lessonCheck.questions.length;
  const r = document.getElementById("lessonCheckResult");
  r.textContent = `Score: ${cor}/${total}` + (cor < total ? " — galat wale sawal Error Notebook me chale gaye, upar explanation padhkar dobara samjho." : " — badhiya! Ab Complete mark karo.");
  save();
}
function completeLesson(id) {
  const conf = (document.getElementById("confidenceSel") || {}).value || "understood";
  const p = state.progress[id] || {};
  p.status = "completed"; p.confidence = conf; p.completedOn = todayStr();
  p.nextRevision = conf === "confident" ? addDays(3) : addDays(1);
  p.revisionStage = 0;
  state.progress[id] = p; save(); bumpStreak();
  toast("Lesson complete! Revision schedule: Day 1, 3, 7, 14, 30 (performance ke hisaab se badlega).");
  go("revision");
}
async function loadVideos(topicName) {
  const box = document.getElementById("ytBox");
  box.innerHTML = '<p class="muted">Videos khoj rahe hain…</p>';
  try {
    const r = await fetch("/api/youtube/search?q=" + encodeURIComponent(topicName));
    const d = await r.json();
    if (d.mode === "api" && d.videos.length) {
      box.innerHTML = d.videos.map((v) => `<div class="task-row"><div>🎬 <a href="${esc(v.url)}" target="_blank" rel="noopener"><b>${esc(v.title)}</b></a><div class="small muted">${esc(v.channel)} • Verified by YouTube API</div></div></div>`).join("");
    } else {
      box.innerHTML = `<p>${esc(d.note || "")}</p><a class="btn" target="_blank" rel="noopener" href="${esc(d.searchUrl)}">YouTube Search Kholo ↗</a>`;
    }
  } catch (e) { box.innerHTML = '<p class="muted">Server se sampark nahi hua — YouTube par khud search karo.</p>'; }
}

/* ---------------- Error logging ---------------- */
function logError(q, myAns, category) {
  if (myAns === q.ans) return;
  const existing = state.errors.find((e) => e.qid === q.id && !e.corrected);
  if (existing) { existing.attempts = (existing.attempts || 1) + 1; existing.date = todayStr(); return; }
  state.errors.unshift({ id: "err-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), qid: q.id, q: q.q, myAns: myAns === undefined ? -1 : myAns, correctAns: q.ans, opts: q.opts, exp: q.exp, topic: q.topic, date: todayStr(), category: category || "conceptual", attempts: 1, corrected: false });
}

/* ---------------- Documents & PYQ ---------------- */
function renderDocuments() {
  const docs = state.documents;
  view.innerHTML = `
    <h1>Documents & Previous-Year Questions</h1>
    <p class="muted">Official syllabus, TRE 1/2/3 ke question papers aur answer keys yahan upload karo. PDF/DOCX/TXT se text aur MCQ-pattern questions auto-niklenge; jo clear nahi hoga use <b>Review</b> flag ke saath rakha jayega — kabhi guess nahi hoga.</p>
    <div class="card">
      <h3 style="margin-top:0">📤 Document Upload Karo</h3>
      <div class="field"><label>Document ka type</label>
        <select id="docType"><option>Syllabus / Notification</option><option>TRE 1 Question Paper</option><option>TRE 2 Question Paper</option><option>TRE 3 Question Paper</option><option>Answer Key</option><option>Notes / Book</option><option>Other</option></select></div>
      <div class="field"><label>File (PDF, DOCX, TXT, Image — max 15 MB)</label>
        <input type="file" id="docFile" accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp" /></div>
      <button id="uploadBtn" onclick="uploadDocument()">Upload & Process Karo</button>
      <span id="uploadStatus" style="margin-left:8px" class="muted"></span>
    </div>
    <h2>📁 Meri Library (${docs.length})</h2>
    ${docs.length ? docs.map((d) => `
      <div class="card" style="margin-bottom:12px">
        <b>${esc(d.name)}</b> <span class="tag">${esc(d.type)}</span>
        <div class="small muted">${d.pages ? d.pages + " pages • " : ""}${d.chars} characters text • Upload: ${esc(d.date)} • Extracted questions: ${d.questions.length}</div>
        ${(d.warnings || []).map((w) => `<div class="explain" style="border-color:var(--warn)">⚠️ ${esc(w)}</div>`).join("")}
        <div style="margin-top:9px;display:flex;gap:7px;flex-wrap:wrap">
          <button class="ghost-btn" onclick="toggleDocText('${d.id}')">Text Preview</button>
          <button class="ghost-btn" onclick="toggleDocQs('${d.id}')">Questions (${d.questions.length}) Review Karo</button>
          ${d.questions.length ? `<button onclick="practiceUploaded('${d.id}')">In Questions ko Practice Karo</button>` : ""}
          <button class="danger-btn" onclick="deleteDocument('${d.id}')">Delete</button>
        </div>
        <div id="doctext-${d.id}" style="display:none"><pre class="code" style="white-space:pre-wrap;max-height:280px;overflow:auto">${esc(d.textPreview || "")}</pre></div>
        <div id="docqs-${d.id}" style="display:none"></div>
      </div>`).join("") : '<p class="muted">Abhi koi document nahi hai. Pehla document upload karke dekho — bina document ke bhi baki app chalti hai.</p>'}`;
}
async function uploadDocument() {
  const f = document.getElementById("docFile").files[0];
  const status = document.getElementById("uploadStatus");
  if (!f) { toast("Pehle file choose karo."); return; }
  const btn = document.getElementById("uploadBtn"); btn.disabled = true; status.textContent = "Process ho raha hai…";
  try {
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/documents/extract", { method: "POST", body: fd });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "fail");
    state.documents.unshift({ id: "doc-" + Date.now().toString(36), name: d.name, type: document.getElementById("docType").value, pages: d.pages, chars: d.chars, date: todayStr(), textPreview: d.textPreview, questions: d.questions || [], warnings: d.warnings || [], duplicates: d.duplicates || [] });
    save();
    toast(`Document jud gaya: ${d.questions.length} questions nikle.`);
    renderDocuments();
  } catch (e) { status.textContent = "Error: " + e.message; btn.disabled = false; }
}
function toggleDocText(id) { const el = document.getElementById("doctext-" + id); el.style.display = el.style.display === "none" ? "block" : "none"; }
function toggleDocQs(id) {
  const box = document.getElementById("docqs-" + id);
  if (box.style.display !== "none") { box.style.display = "none"; return; }
  const d = state.documents.find((x) => x.id === id); if (!d) return;
  box.style.display = "block";
  box.innerHTML = d.questions.length ? d.questions.map((q, i) => `
    <div class="explain" style="margin-top:9px">
      <b>Q${q.question_number || i + 1}.</b> ${q.needsReview ? '<span class="tag warn">REVIEW ZAROORI</span>' : ""} ${q.answer_key_status === "not_available" ? '<span class="tag">Answer key nahi mili</span>' : ""}
      <textarea id="dq-${d.id}-${i}" style="margin-top:6px">${esc(q.question_text)}</textarea>
      <div class="small muted">${(q.options || []).map((o, oi) => `${"ABCD"[oi]}. ${esc(o)}`).join(" &nbsp; ") || "Options auto-detect nahi hue"}</div>
      <div style="margin-top:6px"><label>Sahi answer (answer key se ho to select karo)</label>
      <select id="da-${d.id}-${i}"><option value="">— pata nahi —</option>${["A", "B", "C", "D"].map((L, oi) => `<option value="${oi}" ${q.correct_answer === oi ? "selected" : ""}>${L}</option>`).join("")}</select>
      <button class="ghost-btn" onclick="saveDocQuestion('${d.id}',${i})">Save Correction</button></div>
    </div>`).join("") : '<p class="muted">Is document se questions auto-detect nahi hue.</p>';
}
function saveDocQuestion(docId, i) {
  const d = state.documents.find((x) => x.id === docId); if (!d) return;
  d.questions[i].question_text = document.getElementById(`dq-${docId}-${i}`).value;
  const a = document.getElementById(`da-${docId}-${i}`).value;
  d.questions[i].correct_answer = a === "" ? null : parseInt(a, 10);
  if (a !== "") { d.questions[i].answer_key_status = "user_verified"; d.questions[i].needsReview = false; }
  save(); toast("Correction save ho gaya."); toggleDocQs(docId); toggleDocQs(docId);
}
function deleteDocument(id) { state.documents = state.documents.filter((x) => x.id !== id); save(); renderDocuments(); toast("Document hata diya."); }
function practiceUploaded(docId) {
  const d = state.documents.find((x) => x.id === docId); if (!d) return;
  const usable = d.questions.filter((q) => q.correct_answer !== null && (q.options || []).length === 4);
  if (!usable.length) { toast("Practice ke liye pehle kam se kam kuch questions ke sahi answer (answer key) review me set karo."); return; }
  const mapped = usable.map((q) => ({ id: q.id, topic: q.primary_topic || "Uploaded PYQ", section: "CS", diff: q.difficulty || "medium", q: q.question_text, opts: q.options, ans: q.correct_answer, exp: q.explanation || "Uploaded document se liya gaya sawal — " + d.name, sourceType: "uploaded" }));
  startQuiz({ title: "Uploaded PYQ Practice — " + d.name, mode: "Uploaded PYQ", topicLabel: "Uploaded PYQ", questions: mapped, reviewEach: true });
}

/* ---------------- Practice & Quiz Engine ---------------- */
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function renderPracticeHome() {
  const topics = [...new Set(window.QUESTIONS.map((q) => q.topic))];
  view.innerHTML = `
    <h1>MCQ Practice</h1>
    <p class="muted">Ye saare sawal TRE pattern par bane <b>original practice questions</b> hain — asli PYQ nahi (asli PYQ Documents page se upload honge aur alag label ke saath aayenge).</p>
    <div class="card">
      <div class="grid cols-3">
        <div class="field"><label>Topic</label><select id="pTopic"><option value="__all">Mixed (Sab Topics)</option>${topics.map((t) => `<option>${esc(t)}</option>`).join("")}</select></div>
        <div class="field"><label>Kitne sawal</label><select id="pCount"><option>10</option><option selected>20</option><option>30</option><option>50</option><option>100</option></select></div>
        <div class="field"><label>Difficulty</label><select id="pDiff"><option value="all">Sab</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
      </div>
      <div class="field"><label>Mode</label><select id="pMode"><option value="each">Har sawal ke baad answer + explanation</option><option value="end">Aakhir me result (exam jaisa)</option></select></div>
      <button onclick="startPracticeFromForm()">Practice Shuru Karo</button>
    </div>
    <h2>Topic-wise Bank</h2>
    <div class="grid cols-3">${topics.map((t) => { const c = window.QUESTIONS.filter((q) => q.topic === t).length; const acc = accuracyFor(t); return `<div class="card"><b>${esc(t)}</b><div class="small muted">${c} sawal • Accuracy: ${acc === null ? "—" : acc + "%"}</div><div style="margin-top:8px"><button class="ghost-btn" onclick="startPractice({topic:'${esc(t)}', count:10})">10 Sawal Practice</button></div></div>`; }).join("")}</div>`;
}
function startPracticeFromForm() {
  startPractice({ topic: document.getElementById("pTopic").value, count: parseInt(document.getElementById("pCount").value, 10), diff: document.getElementById("pDiff").value, reviewEach: document.getElementById("pMode").value === "each" });
}
function startPractice(opts) {
  let pool = window.QUESTIONS;
  if (opts.topic && opts.topic !== "__all") pool = pool.filter((q) => q.topic === opts.topic);
  if (opts.diff && opts.diff !== "all") pool = pool.filter((q) => q.diff === opts.diff);
  pool = shuffle(pool).slice(0, opts.count || 10);
  if (!pool.length) { toast("Is selection me sawal nahi mile."); return; }
  startQuiz({ title: "Practice — " + (opts.topic === "__all" ? "Mixed" : opts.topic), mode: "Practice", topicLabel: opts.topic === "__all" ? "Mixed" : opts.topic, questions: pool, reviewEach: opts.reviewEach !== false, timedSeconds: null });
}

let quiz = null;
function startQuiz(cfg) {
  quiz = { ...cfg, idx: 0, answers: {}, marked: {}, checked: {}, startedAt: Date.now(), submitted: false, remaining: cfg.timedSeconds || null };
  renderQuiz();
  if (cfg.timedSeconds) {
    quiz.timerId = setInterval(() => {
      quiz.remaining--;
      const el = document.getElementById("timerBox");
      if (el) el.textContent = "⏱ " + fmtTime(quiz.remaining);
      if (quiz.remaining <= 0) { clearInterval(quiz.timerId); submitQuiz(true); }
    }, 1000);
  }
}
function fmtTime(s) { s = Math.max(0, s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function renderQuiz() {
  const q = quiz.questions[quiz.idx];
  const total = quiz.questions.length;
  const my = quiz.answers[q.id];
  const isChecked = quiz.checked[q.id];
  view.innerHTML = `
    <h1>${esc(quiz.title)}</h1>
    <div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <span class="chip">Question ${quiz.idx + 1} / ${total}</span>
      ${quiz.timedSeconds ? `<span class="chip" id="timerBox">⏱ ${fmtTime(quiz.remaining)}</span>` : ""}
      <span class="tag">${esc(q.topic)}</span><span class="tag">${esc(q.diff)}</span>
      <span class="tag">${q.sourceType === "uploaded" ? "Uploaded PYQ" : "Practice Question"}</span>
      <button class="ghost-btn" onclick="toggleBookmark('${q.id}')">${state.bookmarks.includes(q.id) ? "★ Bookmarked" : "☆ Bookmark"}</button>
    </div>
    <div class="grid cols-2" style="grid-template-columns:1fr 300px;align-items:start">
      <div class="card">
        <p style="font-size:17px"><b>Q${quiz.idx + 1}.</b> ${esc(q.q)}</p>
        ${q.opts.map((o, oi) => {
          let cls = "opt";
          if (isChecked) { if (oi === q.ans) cls += " correct"; else if (oi === my) cls += " wrong"; }
          else if (oi === my) cls += " selected";
          return `<button class="${cls}" ${isChecked ? "disabled" : ""} onclick="answerCurrent(${oi})">${"ABCD"[oi]}. ${esc(o)}</button>`;
        }).join("")}
        <div id="qExp">${isChecked ? `<div class="explain"><b>${my === q.ans ? "✅ Sahi!" : "❌ Galat."}</b> ${esc(q.exp || "")}</div>` : ""}</div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="ghost-btn" ${quiz.idx === 0 ? "disabled" : ""} onclick="moveQ(-1)">← Pichhla</button>
          ${quiz.reviewEach && !isChecked ? `<button onclick="checkCurrent()">Answer Check Karo</button>` : ""}
          <button class="ghost-btn" onclick="markCurrent()">${quiz.marked[q.id] ? "★ Review Marked" : "Mark for Review"}</button>
          <button ${quiz.idx === total - 1 ? "disabled" : ""} onclick="moveQ(1)">Agla →</button>
          <button class="danger-btn" onclick="submitQuiz(false)">Submit Karo</button>
        </div>
      </div>
      <div class="card"><h3 style="margin-top:0">Question Palette</h3><div class="palette">
        ${quiz.questions.map((qq, i) => `<button class="qp ${quiz.answers[qq.id] !== undefined ? "answered" : ""} ${quiz.marked[qq.id] ? "review" : ""} ${i === quiz.idx ? "current" : ""}" onclick="jumpQ(${i})">${i + 1}</button>`).join("")}
      </div><p class="small muted" style="margin-top:9px">Hara = answer diya • Narangi = review ke liye • Border = current</p></div>
    </div>`;
}
function answerCurrent(oi) { const q = quiz.questions[quiz.idx]; quiz.answers[q.id] = oi; if (quiz.reviewEach) checkCurrent(); else renderQuiz(); }
function checkCurrent() {
  const q = quiz.questions[quiz.idx];
  if (quiz.answers[q.id] === undefined) { toast("Pehle ek option chuno."); return; }
  quiz.checked[q.id] = true;
  if (quiz.answers[q.id] !== q.ans) logError(q, quiz.answers[q.id], "conceptual");
  save(); renderQuiz();
}
function markCurrent() { const q = quiz.questions[quiz.idx]; quiz.marked[q.id] = !quiz.marked[q.id]; renderQuiz(); }
function moveQ(d) { quiz.idx = Math.min(quiz.questions.length - 1, Math.max(0, quiz.idx + d)); renderQuiz(); }
function jumpQ(i) { quiz.idx = i; renderQuiz(); }
function toggleBookmark(qid) { const i = state.bookmarks.indexOf(qid); if (i >= 0) state.bookmarks.splice(i, 1); else state.bookmarks.push(qid); save(); renderQuiz(); }
function submitQuiz(auto) {
  if (!quiz || quiz.submitted) return;
  if (!auto && !confirm("Submit karna hai? Iske baad answer badal nahi sakte.")) return;
  if (quiz.timerId) clearInterval(quiz.timerId);
  quiz.submitted = true;
  let correct = 0;
  const byTopic = {};
  quiz.questions.forEach((q) => {
    const my = quiz.answers[q.id];
    byTopic[q.topic] = byTopic[q.topic] || { t: 0, c: 0 };
    byTopic[q.topic].t++;
    if (my === q.ans) { correct++; byTopic[q.topic].c++; }
    else if (!quiz.checked[q.id]) logError(q, my, "conceptual");
  });
  const seconds = Math.round((Date.now() - quiz.startedAt) / 1000);
  state.attempts.push({ id: "att-" + Date.now().toString(36), mode: quiz.mode, topic: quiz.topicLabel, total: quiz.questions.length, correct, date: todayStr(), seconds });
  save(); bumpStreak();
  const qs = quiz.questions; const cfg = quiz;
  let mockNote = "";
  if (cfg.mockMeta) {
    const langQs = qs.slice(0, cfg.mockMeta.langCount);
    const langScore = langQs.filter((q) => cfg.answers[q.id] === q.ans).length;
    const merit = correct - langScore;
    mockNote = `<div class="card" style="margin-top:13px"><h3 style="margin-top:0">Provisional Pattern ke Hisaab Se (Official Result Nahi)</h3>
      <p>🔤 <b>Language: ${langScore}/${langQs.length}</b> — Practice benchmark 9/30 (30%): <b>${langScore >= 9 ? "✅ PASS (practice)" : "❌ FAIL (practice) — Language par dhyaan do"}</b></p>
      <p>🏆 <b>Merit Score (GS + CS): ${merit}/120</b> — Language qualifying hai, merit me nahi judta (provisional pattern ke anusaar).</p></div>`;
  }
  view.innerHTML = `
    <h1>Result — ${esc(cfg.title)}</h1>
    <div class="grid cols-4">
      <div class="card"><div class="stat-num">${correct}/${qs.length}</div><div class="stat-label">Score</div></div>
      <div class="card"><div class="stat-num">${Math.round((correct / qs.length) * 100)}%</div><div class="stat-label">Accuracy</div></div>
      <div class="card"><div class="stat-num">${fmtTime(seconds)}</div><div class="stat-label">Kul samay</div></div>
      <div class="card"><div class="stat-num">${(seconds / qs.length).toFixed(0)}s</div><div class="stat-label">Per question samay</div></div>
    </div>
    ${mockNote}
    <h2>Topic-wise Performance</h2>
    <div class="card">${Object.entries(byTopic).map(([t, v]) => `<div class="bar-row"><span class="bar-label">${esc(t)}</span><div class="progress"><div style="width:${Math.round((v.c / v.t) * 100)}%"></div></div><b>${v.c}/${v.t}</b></div>`).join("")}</div>
    <h2>Har Sawal ki Review</h2>
    ${qs.map((q, i) => { const my = cfg.answers[q.id]; const right = my === q.ans; return `<div class="card" style="margin-bottom:10px"><b>Q${i + 1}.</b> ${esc(q.q)}<div class="small" style="margin-top:5px">Tumhara jawab: <b style="color:${right ? "var(--ok)" : "var(--bad)"}">${my === undefined ? "— nahi diya —" : "ABCD"[my] + ". " + esc(q.opts[my])}</b> • Sahi jawab: <b>${"ABCD"[q.ans]}. ${esc(q.opts[q.ans])}</b></div><div class="explain">${esc(q.exp || "")}</div></div>`; }).join("")}
    <button onclick="go('dashboard')">Dashboard par Wapas</button> <button class="ghost-btn" onclick="go('errors')">Error Notebook Dekho</button>`;
  quiz = null;
}

/* ---------------- Mock Tests ---------------- */
function renderMockHome() {
  view.innerHTML = `
    <h1>Mock Tests</h1>
    <div class="banner" style="margin-bottom:13px">ℹ️ Neeche ka pattern <b>provisional</b> hai (purane TRE pattern par based) — TRE 4.0 ka official notification aane tak koi bhi score "official qualifying result" nahi hai, ye sirf practice simulation hai. Koi cutoff invent nahi kiya gaya hai.</div>
    <div class="grid cols-3">
      <div class="card"><h3 style="margin-top:0">📝 Full Mock (150 Sawal)</h3><p class="small muted">Language 30 + GS 40 + CS 80 • Samay 150 minute • Language me 30% (9/30) = practice-qualifying benchmark (provisional)</p><button onclick="startFullMock()">Full Mock Shuru Karo</button></div>
      <div class="card"><h3 style="margin-top:0">💻 CS Sectional (80 Sawal)</h3><p class="small muted">Sirf Computer Science • Samay 80 minute</p><button onclick="startSectional('CS')">Shuru Karo</button></div>
      <div class="card"><h3 style="margin-top:0">🌏 GS Sectional (40 Sawal)</h3><p class="small muted">General Studies • Samay 40 minute</p><button onclick="startSectional('GS')">Shuru Karo</button></div>
      <div class="card"><h3 style="margin-top:0">🔤 Language Sectional (30 Sawal)</h3><p class="small muted">Hindi + English • Samay 30 minute</p><button onclick="startSectional('LANG')">Shuru Karo</button></div>
      <div class="card"><h3 style="margin-top:0">📜 PYQ Simulation</h3><p class="small muted">TRE 1/2/3 papers Documents page se upload karne ke baad wahan se unhi questions ka test banega. Abhi bank me asli PYQ nahi hain — isliye yahan nakli PYQ nahi dikhaya gaya.</p><button class="ghost-btn" onclick="go('documents')">Documents Kholo</button></div>
    </div>
    <h2>Test History</h2>
    <div class="card">${state.attempts.length ? `<table><tr><th>Mode</th><th>Topic</th><th>Score</th><th>Accuracy</th><th>Date</th></tr>${[...state.attempts].reverse().map((a) => `<tr><td>${esc(a.mode)}</td><td>${esc(a.topic)}</td><td>${a.correct}/${a.total}</td><td>${Math.round((a.correct / a.total) * 100)}%</td><td>${esc(a.date)}</td></tr>`).join("")}</table>` : '<p class="muted">Abhi history khaali hai.</p>'}</div>`;
}
function startFullMock() {
  const lang = shuffle(window.QUESTIONS.filter((q) => q.section === "LANG")).slice(0, 30);
  const gs = shuffle(window.QUESTIONS.filter((q) => q.section === "GS")).slice(0, 40);
  const cs = shuffle(window.QUESTIONS.filter((q) => q.section === "CS")).slice(0, 80);
  const qs = [...lang, ...gs, ...cs];
  startQuiz({ title: "Full Mock Test (Provisional Pattern)", mode: "Full Mock", topicLabel: "Mixed / Full Mock", questions: qs, reviewEach: false, timedSeconds: 150 * 60 });
  quiz.mockMeta = { langCount: 30 };
}
function quizAnswerOf(q) { return quiz ? quiz.answers[q.id] : undefined; }
function startSectional(sec) {
  const map = { CS: ["Computer Science Sectional", 80, 80], GS: ["GS Sectional", 40, 40], LANG: ["Language Sectional", 30, 30] };
  const [title, n, mins] = map[sec];
  const qs = shuffle(window.QUESTIONS.filter((q) => q.section === sec)).slice(0, n);
  startQuiz({ title, mode: "Sectional", topicLabel: title, questions: qs, reviewEach: false, timedSeconds: mins * 60 });
}

/* ---------------- Planner ---------------- */
function todayTasks() {
  // 150-minute default din: 60 seekhna, 30 example/reinforce, 30 MCQ, 20 GS/Lang, 10 revision
  const total = state.settings.dailyMinutes || 150;
  const learnMin = Math.round(total * 0.4), exMin = Math.round(total * 0.2), mcqMin = Math.round(total * 0.2), gsMin = Math.round(total * 0.13), revMin = total - learnMin - exMin - mcqMin - gsMin;
  const nx = ALL_TOPICS.find((t) => topicStatus(t.id) === "in-progress") || ALL_TOPICS.find((t) => topicStatus(t.id) === "not-started");
  const due = dueRevisions();
  const gsTopic = (window.SYLLABUS.find((u) => u.section === "GS") || {}).topics || [];
  const tasks = [];
  if (due.length) tasks.push({ key: "rev", label: `🔁 Revision: ${due[0].name} (${due.length} topics due)`, mins: revMin, action: "go('revision')" });
  else tasks.push({ key: "rev", label: "🔁 Revision: purane notes / flashcards revise karo", mins: revMin, action: "go('revision')" });
  if (nx) {
    tasks.push({ key: "learn", label: `🎓 Naya topic seekho: ${nx.name}`, mins: learnMin, action: `openLesson('${nx.id}')` });
    tasks.push({ key: "example", label: `🧮 Worked examples dobara banao: ${nx.name}`, mins: exMin, action: `openLesson('${nx.id}')` });
    tasks.push({ key: "mcq", label: `✍️ MCQ practice: ${nx.name} (10-20 sawal)`, mins: mcqMin, action: `startPractice({topic:'${esc(nx.qTopic)}', count:10})` });
  }
  if (gsTopic.length) tasks.push({ key: "gs", label: `🌏 GS / Language: ${gsTopic[0].name} ya Language topic`, mins: gsMin, action: "go('learn')" });
  return tasks;
}
function taskDoneToday(key) { return (state.plannerDone[todayStr()] || {})[key] === true; }
function renderTodayTasks(el, compact) {
  if (!el) return;
  const tasks = todayTasks();
  el.innerHTML = tasks.map((t) => `
    <div class="task-row"><input type="checkbox" ${taskDoneToday(t.key) ? "checked" : ""} onchange="toggleTask('${t.key}')" style="margin-top:4px" />
    <div style="flex:1"><button class="ghost-btn" style="text-align:left;width:100%" onclick="${t.action}">${esc(t.label)}</button>
    <div class="small muted">${t.mins} minute</div></div></div>`).join("") +
    `<p class="small muted" style="margin-top:7px">Din kharab gaya to ghabrao mat — incomplete kaam kal ke plan me khud aa jayega, koi backlog ka pahad nahi banega.</p>`;
}
function toggleTask(key) {
  const day = todayStr();
  state.plannerDone[day] = state.plannerDone[day] || {};
  state.plannerDone[day][key] = !state.plannerDone[day][key];
  state.studyLog[day] = Object.values(state.plannerDone[day]).filter(Boolean).length * 25;
  save(); bumpStreak();
  if (currentView === "planner") renderPlanner(); else if (currentView === "dashboard") renderDashboard();
}
function renderPlanner() {
  const total = state.settings.dailyMinutes || 150;
  let weekHtml = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = todayStr(d);
    const doneCount = Object.values(state.plannerDone[ds] || {}).filter(Boolean).length;
    weekHtml += `<tr><td>${ds}${i === 0 ? " (Aaj)" : ""}</td><td>${i === 0 ? "Aaj ke tasks neeche hain" : i === 6 ? "🌟 Weekly Review + Ek Sectional/Full Mock" : "Naya topic + Practice + Revision (auto — progress dekh kar badlega)"}</td><td>${doneCount ? doneCount + " tasks done" : "—"}</td></tr>`;
  }
  view.innerHTML = `
    <h1>Study Planner</h1>
    <p class="muted">Roz ka kul samay: <b>${total} minute</b> (Settings se badal sakte ho). Plan tumhari progress dekh kar khud banta hai — jo topic chal raha hai wahi aage rehta hai, revision due ho to woh sabse pehle aata hai.</p>
    <div class="card"><h3 style="margin-top:0">📌 Aaj ke Tasks</h3><div id="planTasks"></div></div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">🗓️ Agle 7 Din (Overview)</h3>
    <table><tr><th>Date</th><th>Focus</th><th>Status</th></tr>${weekHtml}</table>
    <p class="small muted">Sunday ko weekly review + mock test ka din rakha hai (purani 12-week yojna ke anusaar).</p></div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">⏱️ Study Time Log</h3>
    ${Object.keys(state.studyLog).length ? Object.entries(state.studyLog).slice(-7).map(([d, m]) => `<div class="bar-row"><span class="bar-label">${esc(d)}</span><div class="progress"><div style="width:${Math.min(100, (m / total) * 100)}%"></div></div><b>~${m} min</b></div>`).join("") : '<p class="muted">Tasks complete mark karne par yahan samay dikhega.</p>'}</div>`;
  renderTodayTasks(document.getElementById("planTasks"));
}

/* ---------------- Revision ---------------- */
const REVISION_STAGES = [1, 3, 7, 14, 30];
function renderRevision() {
  const due = dueRevisions();
  const upcoming = ALL_TOPICS.filter((t) => { const p = state.progress[t.id]; return p && p.nextRevision && p.nextRevision > todayStr() && p.status === "completed"; })
    .sort((a, b) => state.progress[a.id].nextRevision.localeCompare(state.progress[b.id].nextRevision));
  view.innerHTML = `
    <h1>Revision Center</h1>
    <p class="muted">Spaced repetition: topic complete hone ke baad Day 1 → 3 → 7 → 14 → 30 par revision aata hai. Galti zyada ho to schedule khud paas aa jata hai.</p>
    <h2>🔁 Aaj Due (${due.length})</h2>
    ${due.length ? due.map((t) => `<div class="topic-row"><div><div class="t-name">${esc(t.name)}</div><div class="small muted">${esc(t.unit)} • Complete hua: ${esc(state.progress[t.id].completedOn || "")}</div></div>
      <div style="display:flex;gap:7px"><button class="ghost-btn" onclick="openLesson('${t.id}')">Dobara Padho</button>
      <button onclick="startPractice({topic:'${esc(t.qTopic)}', count:10})">10 Sawal ka Rapid Test</button>
      <button class="ok-btn" onclick="markRevised('${t.id}', true)">Yaad Hai ✓</button>
      <button class="danger-btn" onclick="markRevised('${t.id}', false)">Bhool Gaya ✗</button></div></div>`).join("") : '<p class="muted">Aaj koi revision due nahi hai. 🎉</p>'}
    <h2>📅 Aane Wale Revision</h2>
    ${upcoming.length ? upcoming.map((t) => `<div class="topic-row"><div class="t-name">${esc(t.name)}</div><span class="tag">${esc(state.progress[t.id].nextRevision)}</span></div>`).join("") : '<p class="muted">Abhi koi upcoming revision schedule nahi hai — pehle ek topic complete karo.</p>'}
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">⚡ Rapid Revision — Kamzor Topics</h3>
    ${weakestTopics(5).length ? weakestTopics(5).map((w) => `<div class="bar-row"><span class="bar-label">${esc(w.name)} (${w.acc}%)</span><button class="ghost-btn" onclick="startPractice({topic:'${esc(w.name)}', count:20})">20 Sawal Practice</button></div>`).join("") : '<p class="muted">Data abhi nahi hai.</p>'}</div>`;
}
function markRevised(id, remembered) {
  const p = state.progress[id]; if (!p) return;
  if (remembered) {
    p.revisionStage = (p.revisionStage || 0) + 1;
    const next = REVISION_STAGES[Math.min(p.revisionStage, REVISION_STAGES.length - 1)];
    p.nextRevision = addDays(next);
    if (p.revisionStage >= REVISION_STAGES.length) { p.nextRevision = addDays(30); }
  } else {
    p.revisionStage = 0;
    p.nextRevision = addDays(1);
  }
  save(); bumpStreak(); toast(remembered ? "Badhiha! Agla revision aur aage rakha." : "Koi baat nahi — ye topic kal fir revision me aayega.");
  renderRevision();
}

/* ---------------- Error Notebook ---------------- */
const ERROR_CATEGORIES = { conceptual: "Conceptual misunderstanding", formula: "Formula error", calculation: "Calculation mistake", confusion: "Similar concepts me confusion", code: "Code tracing galti", misread: "Sawal galat padha", guess: "Guess kiya tha" };
function renderErrors() {
  const errs = state.errors;
  const wrongQs = [...new Set(errs.filter((e) => !e.corrected).map((e) => e.topic))];
  view.innerHTML = `
    <h1>Error Notebook</h1>
    <p class="muted">Har galat jawab yahan khud save hota hai. Jab wahi sawal baad me sahi kar lo, to use "Sudhaar liya" mark kar do.</p>
    <div class="grid cols-3">
      <div class="card"><div class="stat-num">${errs.filter((e) => !e.corrected).length}</div><div class="stat-label">Baki galtiyan (sudhaar baki)</div></div>
      <div class="card"><div class="stat-num">${errs.filter((e) => e.corrected).length}</div><div class="stat-label">Sudhaari hui galtiyan</div></div>
      <div class="card"><div class="stat-num">${wrongQs.length}</div><div class="stat-label">Topics jinme galtiyan hain</div></div>
    </div>
    <div style="margin:14px 0"><button onclick="practiceWrongOnly()">Sirf Galat Sawalo ki Practice Karo</button></div>
    ${errs.length ? errs.map((e) => `
      <div class="card" style="margin-bottom:11px;${e.corrected ? "opacity:.65" : ""}">
        <b>${esc(e.q)}</b> <span class="tag">${esc(e.topic)}</span> ${e.corrected ? '<span class="tag ok">✓ Sudhaar liya</span>' : ""}
        <div class="small" style="margin-top:4px">Tumhara jawab: <b style="color:var(--bad)">${e.myAns >= 0 ? "ABCD"[e.myAns] + ". " + esc((e.opts || [])[e.myAns] || "") : "— nahi diya —"}</b> • Sahi: <b style="color:var(--ok)">${"ABCD"[e.correctAns]}. ${esc((e.opts || [])[e.correctAns] || "")}</b></div>
        <div class="explain">${esc(e.exp || "")}</div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
          <span class="small muted">${esc(e.date)} • ${e.attempts || 1}x galat</span>
          <select onchange="setErrorCategory('${e.id}', this.value)">${Object.entries(ERROR_CATEGORIES).map(([k, v]) => `<option value="${k}" ${e.category === k ? "selected" : ""}>${v}</option>`).join("")}</select>
          ${e.corrected ? `<button class="ghost-btn" onclick="toggleCorrected('${e.id}')">Wapas Baki me Rakkho</button>` : `<button class="ok-btn" onclick="toggleCorrected('${e.id}')">✓ Sudhaar Liya</button>`}
        </div>
      </div>`).join("") : '<p class="muted">Abhi error notebook khaali hai — practice me galti hogi to yahan aayegi.</p>'}`;
}
function setErrorCategory(id, cat) { const e = state.errors.find((x) => x.id === id); if (e) { e.category = cat; save(); } }
function toggleCorrected(id) { const e = state.errors.find((x) => x.id === id); if (e) { e.corrected = !e.corrected; save(); renderErrors(); } }
function practiceWrongOnly() {
  const ids = [...new Set(state.errors.filter((e) => !e.corrected).map((e) => e.qid))];
  const qs = window.QUESTIONS.filter((q) => ids.includes(q.id));
  if (!qs.length) { toast("Abhi practice ke liye galat sawal nahi hain."); return; }
  startQuiz({ title: "Error Notebook Practice", mode: "Error Review", topicLabel: "Galat Sawal", questions: shuffle(qs), reviewEach: true });
}

/* ---------------- Notes ---------------- */
function renderNotes() {
  view.innerHTML = `
    <h1>My Notes</h1>
    <div class="card">
      <h3 style="margin-top:0">✏️ Naya Note</h3>
      <div class="field"><label>Topic (optional)</label><select id="noteTopic"><option value="">— General —</option>${ALL_TOPICS.map((t) => `<option value="${t.id}">${esc(t.unit)}: ${esc(t.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Title</label><input id="noteTitle" style="width:100%" placeholder="Note ka title" /></div>
      <div class="field"><label>Note</label><textarea id="noteBody" placeholder="Apne shabdo me likho — wahi sabse zyada yaad rehta hai…"></textarea></div>
      <button onclick="addNote()">Note Save Karo</button>
    </div>
    <h2>Save Kiye Notes (${state.notes.length})</h2>
    ${state.notes.length ? state.notes.map((n) => { const t = n.topicId ? topicById(n.topicId) : null; return `<div class="card" style="margin-bottom:11px"><b>${esc(n.title)}</b> ${t ? `<span class="tag">${esc(t.name)}</span>` : ""}<div class="small muted">Last update: ${esc(n.updated)}</div><p style="white-space:pre-wrap">${esc(n.body)}</p><button class="danger-btn" onclick="deleteNote('${n.id}')">Delete</button></div>`; }).join("") : '<p class="muted">Abhi koi note nahi hai.</p>'}`;
}
function addNote() {
  const title = document.getElementById("noteTitle").value.trim();
  const body = document.getElementById("noteBody").value.trim();
  if (!title || !body) { toast("Title aur note dono likho."); return; }
  state.notes.unshift({ id: "note-" + Date.now().toString(36), topicId: document.getElementById("noteTopic").value, title, body, updated: todayStr() });
  save(); toast("Note save ho gaya."); renderNotes();
}
function deleteNote(id) { state.notes = state.notes.filter((n) => n.id !== id); save(); renderNotes(); }

/* ---------------- Analytics ---------------- */
function renderAnalytics() {
  const totalQ = state.attempts.reduce((s, a) => s + a.total, 0);
  const totalC = state.attempts.reduce((s, a) => s + a.correct, 0);
  const topicNames = [...new Set(window.QUESTIONS.map((q) => q.topic))];
  const catErr = {};
  state.errors.forEach((e) => { if (!e.corrected) catErr[e.category] = (catErr[e.category] || 0) + 1; });
  view.innerHTML = `
    <h1>Performance Analytics</h1>
    <p class="muted">Ye sirf tumhare asal attempt data par hai — koi prediction ya selection ki guarantee nahi.</p>
    <div class="grid cols-4">
      <div class="card"><div class="stat-num">${totalQ}</div><div class="stat-label">Kul sawal solve</div></div>
      <div class="card"><div class="stat-num">${totalQ ? Math.round((totalC / totalQ) * 100) : 0}%</div><div class="stat-label">Overall accuracy</div></div>
      <div class="card"><div class="stat-num">${state.attempts.length}</div><div class="stat-label">Kul tests/practice sessions</div></div>
      <div class="card"><div class="stat-num">${syllabusPercent().pct}%</div><div class="stat-label">Syllabus coverage</div></div>
    </div>
    <h2>Topic-wise Accuracy</h2>
    <div class="card">${topicNames.map((t) => { const acc = accuracyFor(t); return `<div class="bar-row"><span class="bar-label">${esc(t)}</span><div class="progress"><div style="width:${acc || 0}%"></div></div><b>${acc === null ? "—" : acc + "%"}</b></div>`; }).join("")}</div>
    <h2>Galtiyon ki Kismein (Mistake Categories)</h2>
    <div class="card">${Object.keys(catErr).length ? Object.entries(catErr).map(([k, v]) => `<div class="bar-row"><span class="bar-label">${esc(ERROR_CATEGORIES[k] || k)}</span><b>${v} galtiyan</b></div>`).join("") : '<p class="muted">Abhi koi unsudhaari galti nahi hai.</p>'}
    <p class="small muted">Repeated galti ka pattern yahi dikhta hai — jaise zyada "Formula error" ho to pehle formula sheet revise karo, zyada "Conceptual" ho to lesson dobara padho.</p></div>
    <h2>Score Trend (Pichhle Attempts)</h2>
    <div class="card">${state.attempts.length ? state.attempts.slice(-10).map((a) => `<div class="bar-row"><span class="bar-label">${esc(a.date)} • ${esc(a.mode)}</span><div class="progress"><div style="width:${Math.round((a.correct / a.total) * 100)}%"></div></div><b>${a.correct}/${a.total}</b></div>`).join("") : '<p class="muted">Abhi attempts nahi hain.</p>'}</div>`;
}

/* ---------------- Settings ---------------- */
async function renderSettings() {
  view.innerHTML = `
    <h1>Settings</h1>
    <div class="card">
      <h3 style="margin-top:0">🕐 Roz ka Study Time</h3>
      <div class="field"><label>Minutes per day (default 150 = 2.5 ghante)</label>
      <input type="number" id="setMinutes" value="${state.settings.dailyMinutes}" min="30" max="600" step="10" /> </div>
      <button onclick="saveMinutes()">Save</button>
      <h3>🎨 Theme</h3>
      <button class="ghost-btn" onclick="setTheme('light')">Light</button> <button class="ghost-btn" onclick="setTheme('dark')">Dark</button>
      <h3>🔑 API Status (Phase 2 ke liye)</h3>
      <div id="apiStatus" class="small muted">Check ho raha hai…</div>
      <p class="small muted">Keys kabhi browser/app me nahi daalte — woh Render ke Environment Variables me rehti hain. AI Tutor (Gemini) aur verified YouTube list Phase 2 me inhee keys se chalegi.</p>
      <h3>💾 Mera Data</h3>
      <button class="ghost-btn" onclick="exportData()">Progress Export Karo (JSON download)</button>
      <button class="danger-btn" onclick="resetData()">Saara Data Reset Karo</button>
      <p class="small muted">Data sirf is browser ke localStorage me hai — dusre device/browser me nahi dikhega. Cloud sync (Supabase) Phase 2/4 me aayega.</p>
    </div>`;
  try { const r = await fetch("/api/config/status"); const d = await r.json(); document.getElementById("apiStatus").innerHTML = `Gemini API: <b>${d.geminiConfigured ? "✅ Set hai" : "❌ Set nahi (Phase 2 me lagegi)"}</b> • YouTube API: <b>${d.youtubeConfigured ? "✅ Set hai" : "❌ Set nahi"}</b> • Supabase: <b>${d.supabaseConfigured ? "✅ Set hai" : "❌ Set nahi"}</b>`; } catch (e) { document.getElementById("apiStatus").textContent = "Server status nahi mila."; }
}
function saveMinutes() { const v = parseInt(document.getElementById("setMinutes").value, 10); if (v >= 30 && v <= 600) { state.settings.dailyMinutes = v; save(); toast("Roz ka target " + v + " minute set ho gaya."); } }
function setTheme(t) { state.settings.theme = t; document.documentElement.dataset.theme = t; $("#themeToggle").textContent = t === "dark" ? "☀️ Light Theme" : "🌙 Dark Theme"; save(); }
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tre4-progress-" + todayStr() + ".json"; a.click();
}
function resetData() { if (confirm("Pakka? Progress, notes, errors — sab delete ho jayega.")) { state = defaultState(); save(); toast("Data reset ho gaya."); go("dashboard"); } }
$("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

/* ---------------- Search ---------------- */
$("#globalSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (q.length < 2) return;
  const tHits = ALL_TOPICS.filter((t) => (t.name + " " + t.unit).toLowerCase().includes(q)).slice(0, 6);
  const qHits = window.QUESTIONS.filter((x) => x.q.toLowerCase().includes(q)).slice(0, 6);
  view.innerHTML = `<h1>Search: "${esc(e.target.value)}"</h1>
    <h2>Topics</h2>${tHits.length ? tHits.map((t) => `<div class="search-hit"><b>${esc(t.name)}</b> <span class="muted">(${esc(t.unit)})</span> <button class="ghost-btn" onclick="openLesson('${t.id}')">Kholo</button></div>`).join("") : '<p class="muted">Koi topic nahi mila.</p>'}
    <h2>Questions</h2>${qHits.length ? qHits.map((x) => `<div class="search-hit"><b>${esc(x.q)}</b><div class="small muted">${esc(x.topic)} • Sahi jawab: ${"ABCD"[x.ans]}. ${esc(x.opts[x.ans])}</div></div>`).join("") : '<p class="muted">Koi question nahi mila.</p>'}`;
});

/* ---------------- Init ---------------- */
document.documentElement.dataset.theme = state.settings.theme || "light";
$("#themeToggle").textContent = (state.settings.theme === "dark") ? "☀️ Light Theme" : "🌙 Dark Theme";
$("#streakChip").textContent = "🔥 Streak: " + (state.streak || 0) + " din";
renderDashboard();
