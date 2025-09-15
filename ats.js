// ats.js - AI powered ATS + Resume Analyzer
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse"); // requires: npm install pdf-parse
const mammoth = require("mammoth");    // requires: npm install mammoth

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERROR: OPENAI_API_KEY missing! Please set it before running.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ------------------- TEXT EXTRACTION ------------------- */
async function robustExtractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === ".txt") {
      return fs.readFileSync(filePath, "utf8");
    } else if (ext === ".pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text;
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else {
      return fs.readFileSync(filePath, "utf8");
    }
  } catch (err) {
    console.error("⚠️ Text extraction failed:", err.message);
    return "";
  }
}

/* ------------------- RESUME QUALITY CHECK ------------------- */
async function checkResumeQuality(filePath, SPELL = null) {
  const text = await robustExtractText(filePath);
  if (!text) {
    return { buildQualityScore: 0, suggestions: ["Resume text could not be extracted."], pages: 0 };
  }

  const prompt = `
  You are an advanced ATS scanner. Analyze the following resume text:
  1. Give a Build Quality Score (0-100).
  2. List top suggestions to improve formatting, grammar, and ATS optimization.
  3. Highlight missing sections (summary, skills, projects, etc.).
  Resume:
  """${text.slice(0, 3000)}"""
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: "You are an expert resume evaluator." },
               { role: "user", content: prompt }],
    temperature: 0.3
  });

  const analysis = response.choices[0].message.content;
  let buildQualityScore = 70; // default fallback
  const scoreMatch = analysis.match(/(\d{1,3})/);
  if (scoreMatch) {
    buildQualityScore = Math.min(100, parseInt(scoreMatch[1]));
  }

  return {
    buildQualityScore,
    suggestions: analysis.split("\n").filter(line => line.trim().length > 5),
    sampleText: text.slice(0, 500),
    pages: Math.ceil(text.length / 2000)
  };
}

/* ------------------- RESUME VS JD ANALYSIS ------------------- */
async function analyzeResumeWithJD(resumePath, jdPath, jdText = "") {
  const resumeText = await robustExtractText(resumePath);
  let jdContent = jdText;
  if (jdPath) {
    jdContent = await robustExtractText(jdPath);
  }

  if (!resumeText || !jdContent) {
    return { matchPercent: 0, found: [], missing: [], keywords: [] };
  }

  // Embeddings similarity
  const [resumeEmbedding, jdEmbedding] = await Promise.all([
    openai.embeddings.create({ model: "text-embedding-3-small", input: resumeText }),
    openai.embeddings.create({ model: "text-embedding-3-small", input: jdContent })
  ]);

  const v1 = resumeEmbedding.data[0].embedding;
  const v2 = jdEmbedding.data[0].embedding;

  const dot = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const norm1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0));
  const similarity = dot / (norm1 * norm2 + 1e-8);

  const matchPercent = Math.round(similarity * 100);

  // Ask GPT for found/missing keywords
  const prompt = `
  Compare this resume with the job description.
  1. Extract top 10 keywords from JD.
  2. Which keywords are present in resume? Which are missing?
  Resume: """${resumeText.slice(0, 3000)}"""
  JD: """${jdContent.slice(0, 3000)}"""
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: "You are an ATS comparison engine." },
               { role: "user", content: prompt }],
    temperature: 0.3
  });

  return {
    matchPercent,
    analysis: response.choices[0].message.content
  };
}

/* ------------------- INTERVIEW QUESTIONS ------------------- */
async function generateInterviewQuestions(jdText, n = 10) {
  const prompt = `
  Based on this job description, generate ${n} relevant and challenging interview questions:
  """${jdText}"""
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: "You are an expert interviewer." },
               { role: "user", content: prompt }],
    temperature: 0.5
  });

  return response.choices[0].message.content.split("\n").filter(q => q.trim().length > 5);
}

/* ------------------- EXPORTS ------------------- */
module.exports = {
  robustExtractText,
  checkResumeQuality,
  analyzeResumeWithJD,
  generateInterviewQuestions
};
