/**
 * ats.js - Professional ATS + AI engine (Render-safe)
 * Lazy loads OpenAI and defers heavy work until requests
 */

const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

let OpenAI, openai;

// Lazy-load OpenAI client
function getOpenAI() {
  if (!openai) {
    OpenAI = require("openai").OpenAI;
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// --------- Helpers ---------
async function robustExtractText(filePath) {
  if (filePath.endsWith(".pdf")) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } else if (filePath.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } else {
    return fs.readFileSync(filePath, "utf8");
  }
}

async function computeEmbedding(text) {
  const client = getOpenAI();
  const res = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text
  });
  return res.data[0].embedding;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --------- Core ATS Functions ---------
async function parseResumeToJSON(resumeText) {
  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extract resume into structured JSON with fields: contact, skills[], education[], experience[]." },
      { role: "user", content: resumeText }
    ],
    temperature: 0
  });
  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return { contact: {}, skills: [], education: [], experience: [] };
  }
}

function ruleBasedScore(parsed) {
  let score = 0;
  if (parsed.skills.length > 5) score += 20;
  if (parsed.education.length > 0) score += 20;
  if (parsed.experience.length > 0) score += 30;
  if (parsed.contact && parsed.contact.email) score += 10;
  return score; // out of 80
}

async function gptQualityScore(resumeText) {
  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an ATS resume analyzer. Give ATS score (0-100) and improvement suggestions." },
      { role: "user", content: resumeText }
    ]
  });
  return completion.choices[0].message.content;
}

async function checkResumeQuality(filePath) {
  const resumeText = await robustExtractText(filePath);
  const parsed = await parseResumeToJSON(resumeText);

  const rbScore = ruleBasedScore(parsed);
  const gptResp = await gptQualityScore(resumeText);

  let aiScore = 60;
  let suggestions = [];
  try {
    const match = gptResp.match(/(\d{1,3})/);
    if (match) aiScore = Math.min(100, parseInt(match[1]));
    suggestions = gptResp.split("\n").slice(1);
  } catch { suggestions = [gptResp]; }

  const finalScore = Math.round((rbScore * 0.4) + (aiScore * 0.6));
  return { buildQualityScore: finalScore, suggestions, parsedResume: parsed };
}

async function analyzeResumeWithJD(resumePath, jdPath, jdText) {
  const resumeText = await robustExtractText(resumePath);
  const jobText = jdText || (jdPath ? await robustExtractText(jdPath) : "");

  const resumeEmbedding = await computeEmbedding(resumeText);
  const jdEmbedding = await computeEmbedding(jobText);

  const similarity = cosineSimilarity(resumeEmbedding, jdEmbedding);
  const matchPercent = Math.round(similarity * 100);

  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Compare resume and JD. List keywords/skills found and missing." },
      { role: "user", content: `Resume:\n${resumeText}\n\nJD:\n${jobText}` }
    ]
  });

  return { matchPercent, keywords: completion.choices[0].message.content };
}

async function generateInterviewQuestions(jdText, n = 5) {
  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Generate interview questions based on the job description." },
      { role: "user", content: jdText }
    ],
    temperature: 0.7
  });

  return completion.choices[0].message.content.split("\n").slice(0, n);
}

module.exports = {
  robustExtractText,
  checkResumeQuality,
  analyzeResumeWithJD,
  generateInterviewQuestions
};
