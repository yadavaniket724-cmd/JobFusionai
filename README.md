# JobFusionAI – Resume & JD Analyzer

An AI-powered web app to analyze resumes against job descriptions (JD), provide ATS scanning, skill gap analysis, improvement suggestions, and generate interview questions.

---

## 🚀 Features
- **Navigation**: Home, Resume, JD, History
- **Step 1 – Resume Upload**
  - ATS scanning: formatting, spelling, structure, page count
  - Resume build quality score (0–100)
  - Suggestions if quality < 80%
- **Step 2 – Job Description Upload**
  - JD text upload/update
  - ATS matching percentage
- **Step 3 – Skills & Requirements**
  - Extracts key JD skills (not just all words)
  - Shows missing keywords and probability of selection
  - Suggestions if match < 80%
- **Step 4 – Interview Questions**
  - Generates 10 tailored interview questions from JD

---

## 📦 Project Structure
```
.
├── server.js              # Express backend
├── ats.js                 # ATS scanning and NLP logic
├── index.html             # Frontend
├── package.json
├── Dockerfile             # For container deployment
├── start.sh
├── .gitignore
├── demo/                  # Sample resume, JD, and automation scripts
└── .github/workflows/     # CI/CD workflow
```

---

## 🛠️ Run Locally
1. Clone the repo:
   ```bash
   git clone https://github.com/<your-username>/<repo-name>.git
   cd <repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node server.js
   ```
   Visit: [http://localhost:3000](http://localhost:3000)

---

## ☁️ One-Click Deploy to Render
Click the button below to deploy your own instance on **Render**:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Render will:
- Clone this repo
- Install dependencies (`npm install`)
- Run `npm start`
- Expose a public URL (e.g. `https://your-app.onrender.com`)

---

## 🐳 Docker Support
Build and run using Docker:
```bash
docker build -t jobfusionai .
docker run -p 3000:3000 jobfusionai
```
App will be available at: [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment Variables (Optional)
If you want grammar/spell-check with LanguageTool, set:

```bash
LANGUAGETOOL_URL=https://api.languagetoolplus.com/v2/check
LANGUAGETOOL_API_KEY=<your_api_key>
```

---

## 📊 Demo
- Sample resume: `demo/sample_resume.txt`
- Sample JD: `demo/sample_jd.txt`
- Run automated demo:
  ```bash
  ./demo/record_demo.sh
  ```
  Creates screenshots in `demo/frames/` and `demo/demo.gif` (if ffmpeg installed).

---

## 🤝 Contributing
PRs welcome! Please fork the repo and submit pull requests.

---

## 📄 License
MIT License
