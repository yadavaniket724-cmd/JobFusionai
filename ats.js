// atsPro.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const OpenAI = require('openai');
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ ERROR: OPENAI_API_KEY missing!");
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------- CONFIG ----------
const ROLE_SKILLS = {
  'Frontend Engineer': { 'JavaScript': 5, 'React': 5, 'TypeScript': 4, 'CSS': 4 },
  'Backend Engineer': { 'Node.js': 5, 'Python': 5, 'AWS': 4, 'Docker': 3 }
};

const SKILL_ALIASES = {
  'JavaScript': ['JS', 'Java Script'],
  'Node.js': ['Node', 'NodeJS'],
  'React': ['React.js', 'ReactJS'],
  'AWS': ['AWS Lambda', 'Amazon Web Services']
};

const ACTION_VERBS = ['developed', 'led', 'built', 'managed', 'engineered', 'designed', 'implemented'];

const SKILL_CLUSTERS = {
  'Frontend': ['JavaScript', 'React', 'TypeScript', 'CSS'],
  'Backend': ['Node.js', 'Python', 'Docker', 'AWS']
};

// ---------- CACHE ----------
const cache = new Map();
const embeddingCacheFile = path.join(__dirname, 'embeddingCache.json');
let embeddingCache = {};
if (fs.existsSync(embeddingCacheFile)) {
  embeddingCache = JSON.parse(fs.readFileSync(embeddingCacheFile, 'utf8'));
}

// ---------- UTILITY ----------
function normalizeSkill(skill) {
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (skill.toLowerCase() === canonical.toLowerCase() || aliases.some(a => a.toLowerCase() === skill.toLowerCase())) {
      return canonical;
    }
  }
  return skill;
}

function detectExperience(text) {
  const match = text.match(/(\d+)\+?\s*(years|yrs)/i);
  return match ? parseInt(match[1], 10) : 0;
}

function hasActionVerb(text) {
  return ACTION_VERBS.some(v => text.toLowerCase().includes(v));
}

function cosineSimilarity(vecA, vecB) {
  const minLength = Math.min(vecA.length, vecB.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < minLength; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// ---------- EMBEDDINGS ----------
async function getEmbedding(text, id) {
  if (embeddingCache[id]) return embeddingCache[id];
  const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  const embedding = response.data[0].embedding;
  embeddingCache[id] = embedding;
  return embedding;
}

function saveEmbeddingCache() {
  fs.writeFileSync(embeddingCacheFile, JSON.stringify(embeddingCache), 'utf8');
}

// ---------- LINE SCORING ----------
function scanLine(line, roleSkills) {
  if (cache.has(line)) return cache.get(line);

  let skillScore = 0;
  const matchedSkills = [];

  for (const [skill, weight] of Object.entries(roleSkills)) {
    const pattern = [skill, ...(SKILL_ALIASES[skill] || [])];
    if (pattern.some(p => line.toLowerCase().includes(p.toLowerCase()))) {
      const contextMultiplier = hasActionVerb(line) ? 2 : 1;
      skillScore += weight * contextMultiplier;
      matchedSkills.push(skill);
    }
  }

  const experienceScore = detectExperience(line) * 0.5;
  const totalScore = skillScore + experienceScore;
  const result = { totalScore, skillScore, experienceScore, matchedSkills };
  cache.set(line, result);
  return result;
}

// ---------- PROCESS SINGLE RESUME ----------
async function processResume(candidate, role, jobEmbeddings) {
  let totalScore = 0;
  let matchedSkills = [];
  let resumeText = '';

  const rl = readline.createInterface({
    input: fs.createReadStream(candidate.resumeFilePath),
    crlfDelay: Infinity
  });

  const roleSkills = ROLE_SKILLS[role] || {};
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    resumeText += line + ' ';
    const { totalScore: lineScore, matchedSkills: skills, skillScore } = scanLine(line, roleSkills);
    const sectionBonus = lineNumber <= 20 ? skillScore * 0.2 : 0;
    totalScore += lineScore + sectionBonus;
    matchedSkills.push(...skills);
  }

  const resumeEmbedding = await getEmbedding(resumeText, `resume-${candidate.id}`);
  let semanticScore = 0;
  for (const jobEmbedding of jobEmbeddings) {
    semanticScore += cosineSimilarity(resumeEmbedding, jobEmbedding) * 10;
  }
  totalScore += semanticScore;

  const clusterScores = {};
  for (const [cluster, skills] of Object.entries(SKILL_CLUSTERS)) {
    clusterScores[cluster] = matchedSkills.filter(s => skills.includes(s)).length;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    totalScore,
    matchedSkills,
    clusterScores,
    resumeFilePath: candidate.resumeFilePath
  };
}

// ---------- PROCESS ALL CANDIDATES ----------
async function processAllCandidates(candidates, roles, jobDescriptions, concurrencyLimit = 5) {
  const jobEmbeddings = [];
  for (let i = 0; i < jobDescriptions.length; i++) {
    const embedding = await getEmbedding(jobDescriptions[i], `job-${i}`);
    jobEmbeddings.push(embedding);
  }

  const results = [];
  for (let i = 0; i < candidates.length; i += concurrencyLimit) {
    const batch = candidates.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(c => processResume(c, c.role, jobEmbeddings)));
    results.push(...batchResults);
  }

  saveEmbeddingCache();
  return results.sort((a, b) => b.totalScore - a.totalScore);
}

// ---------- EXPORT MODULE ----------
module.exports = {
  processResume,
  processAllCandidates
};
