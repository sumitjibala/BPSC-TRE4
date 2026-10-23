# DEPLOY GUIDE (Roman Hindi) — TRE 4.0 CS Academy ko GitHub + Render par live karna

Bilkul wahi steps jo BatchZip ke time kiye the. Kul 10-15 minute lagenge.

## Step 1: Zip download aur extract karo
1. Chat me mili `tre4-cs-academy-deploy.zip` file download karo.
2. Zip ko extract karo — andar ye files dikhengi: `server.js`, `package.json`, `render.yaml`, `README.md`, `DEPLOY.md`, aur `public` naam ka folder.
3. Dhyaan rahe: extract kiye hue files hi upload hongi, zip seedha upload nahi hoga.

## Step 2: GitHub par naya repo banao
1. github.com kholo, login karo (wahi purana account).
2. Upar right corner me `+` par click → **New repository**.
3. Repository name: `tre4-cs-academy` rakho → **Public** rakho → **Create repository** dabao.
4. Ab repo ke page par **"uploading an existing file"** wale link par click karo.
5. Extract kiye hue saare files aur `public` folder ko select karke drag-drop karo.
   - Zaroori: `render.yaml` file repo ke sabse upar (root) me honi chahiye, kisi folder ke andar nahi. (BatchZip wali galti yahi hui thi — waisi mat karna.)
   - `node_modules` naam ka koi folder zip me hai hi nahi, to wo upload bhi nahi hoga — ye sahi hai.
6. Neeche **Commit changes** dabao. Upload complete hone do.

## Step 3: Render par deploy karo
1. render.com kholo → GitHub se login karo.
2. Dashboard me **New** → **Blueprint** chuno.
3. Apna `tre4-cs-academy` repo select karo → **Connect**.
4. Render khud `render.yaml` padh lega — Name `tre4-cs-academy` dikhega → **Apply** dabao.
5. 2-5 minute wait karo. Status **Live** ho jayega aur upar ek URL milega, jaise:
   `https://tre4-cs-academy.onrender.com`

## Step 4: Check karo
1. URL mobile aur computer dono par kholo.
2. Dashboard dikhe to deploy safal hai. Koi topic ka lesson kholo, ek practice test dekar dekho.
3. Dhyaan: Render free plan par app 15 minute na use ho to so jata hai — pehli baar khulne me 30-50 second lag sakte hain, ye normal hai.

## Keys kab lagegi?
Phase 1 ko koi key nahi chahiye. Phase 2 (AI Teacher) ke time:
- **GEMINI_API_KEY** — aistudio.google.com se free milegi (us time step-by-step bataunga).
- **YOUTUBE_API_KEY** — Google Cloud Console se free.
- Keys Render dashboard → apni service → **Environment** me daalni hain. Keys kabhi chat, GitHub ya code me mat daalna.

## Update kese hoga?
Phase 2/3 ka naya zip milega — purani files ki jagah nayi files usi GitHub repo me upload kar dena, Render khud auto-deploy kar dega. Tumhara padhai ka data browser me rehta hai, deploy se nahi udta (lekin Settings se time-time par Export backup lete rehna achha hai).
