
const fs = require('fs');

let pdfParse = null;
try { pdfParse = require('pdf-parse'); } catch(e){ /* optional */ }

let nspell = null;
let dict = null;
try {
  nspell = require('nspell');
  // load dictionary if available
  const dictData = require('dictionary-en');
  // dictionary-en exports a function that fetches async; handle gracefully
  if(typeof dictData === 'function'){
    // will set up later in init
    dict = dictData;
  } else {
    // not expected, ignore
  }
} catch(e){
  // not available
}

async function loadDictionary(){
  if(!dict || !nspell) return null;
  // dictionary-en package returns a function that accepts a callback or returns a promise
  try{
    const d = await new Promise((res,rej)=>{
      dict((err,dic)=>{
        if(err) return rej(err);
        res(dic);
      });
    });
    const spell = nspell(d);
    return spell;
  }catch(e){
    return null;
  }
}

function simpleExtractText(filePath){
  const buf = fs.readFileSync(filePath);
  const s = buf.toString('utf8', 0, Math.min(500000, buf.length));
  return s;
}

async function robustExtractText(filePath){
  const buf = fs.readFileSync(filePath);
  // try pdf-parse for PDFs
  if(pdfParse && buf.slice(0,4).toString() === '%PDF'){
    try{
      const data = await pdfParse(buf);
      return data.text || data.numpages ? (data.text || '') : simpleExtractText(filePath);
    }catch(e){
      return simpleExtractText(filePath);
    }
  }
  // fallback to text
  return simpleExtractText(filePath);
}

function wordsFromText(txt){
  return txt.replace(/[^A-Za-z0-9\s\-]/g,' ').split(/\s+/).filter(Boolean);
}

const STOPWORDS = new Set(('the of and to a in for is on that with as are by this from at it be or have has will include using using').split(' '));

function topKeywords(text,limit=20){
  const w = wordsFromText(text.toLowerCase()).filter(x=>x.length>3 && !STOPWORDS.has(x));
  const freq = {};
  for(let i=0;i<w.length;i++){ const token=w[i]; freq[token]=(freq[token]||0)+1; }
  // bigrams
  const bigrams = {};
  for(let i=0;i<w.length-1;i++){
    const b = w[i]+' '+w[i+1];
    bigrams[b] = (bigrams[b]||0)+1;
  }
  const uni = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,Math.max(5,limit-5));
  const bi = Object.keys(bigrams).sort((a,b)=>bigrams[b]-bigrams[a]).slice(0,Math.min(5,limit-uni.length));
  const combined = uni.concat(bi).slice(0,limit);
  return combined;
}

function estimatePagesFromText(txt){
  if(txt.startsWith('%PDF')) {
    const m = (txt.match(/\/Type\s*\/Page/gi)||[]).length;
    return Math.max(1,m);
  } else {
    const lines = txt.split('\n').length;
    return Math.max(1, Math.ceil(lines/60));
  }
}

async function checkResumeQuality(filePath, spellObj){
  const txt = await robustExtractText(filePath);
  const words = wordsFromText(txt);
  const pages = estimatePagesFromText(txt);
  let score = 100;
  const improvements = [];

  if(pages>2){ score -= 20; improvements.push("Consider reducing resume to 1-2 pages unless you have extensive experience."); }
  if(!/experience/i.test(txt)) { score -= 15; improvements.push("Add an 'Experience' section with role, company and dates."); }
  if(!/education/i.test(txt)) { score -= 10; improvements.push("Add an 'Education' section."); }
  if(!/skills/i.test(txt)) { score -= 10; improvements.push("Add a 'Skills' or 'Technical Skills' section listing technologies."); }
  if(!/@[A-Za-z0-9.\-]+/.test(txt)) { score -= 10; improvements.push("Include a valid email address in contact details."); }
  if(txt.includes('\t')){ score -= 5; improvements.push("Avoid tab-delimited formatting; use consistent spacing or tables."); }
  if(/\s{3,}/.test(txt)){ score -= 5; improvements.push("Remove excessive spaces; use consistent formatting."); }

  // basic spell-check: test top frequent words that aren't proper nouns
  const freq = {};
  words.forEach(w=>{ const lw=w.toLowerCase(); freq[lw]=(freq[lw]||0)+1; });
  const common = Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,200);
  const suspect = [];
  if(spellObj){
    for(const w of common.slice(0,100)){
      if(w.length>2 && !spellObj.correct(w)){
        suspect.push(w);
      }
    }
  } else {
    // heuristic fallback: long tokens or tokens with repeated chars
    for(const w of common.slice(0,100)){
      if(w.length>18 || /(.)\1\1/.test(w)) suspect.push(w);
    }
  }
  if(suspect.length>0){ score -= Math.min(15, suspect.length); improvements.push("Run a spell-check — some words may be misspelled: "+suspect.slice(0,8).join(', ')); }

  score = Math.max(0, Math.min(100, score));
  return {buildQualityScore:score,improvements,pages, sampleText: txt.slice(0,1000)};
}

async function analyzeResumeWithJD(resumePath, jdFilePath, jdText){
  const rtxt = (await robustExtractText(resumePath)).toLowerCase();
  let jdt = jdText||'';
  if(jdFilePath) jdt = (await robustExtractText(jdFilePath)) || jdt;
  jdt = jdt.toLowerCase();
  const keywords = topKeywords(jdt, 25);
  const found = keywords.filter(k=> rtxt.includes(k));
  const missing = keywords.filter(k=> !rtxt.includes(k));
  const matchPercent = keywords.length? Math.round(found.length/keywords.length*100) : 0;
  return {keywords,found,missing,matchPercent};
}

function generateInterviewQuestions(jdText, limit=10){
  const kws = topKeywords(jdText, 20);
  const templates = [
    k => `Can you describe your experience with ${k} and how you applied it in a project?`,
    k => `What challenges have you faced while working with ${k} and how did you overcome them?`,
    k => `Explain a scenario where ${k} improved a business outcome.`,
    k => `How would you approach a task involving ${k}?`,
    k => `Which tools or libraries do you use with ${k}, and why?`,
    k => `Give an example of a measurable result you achieved using ${k}.`,
    k => `How do you keep your knowledge of ${k} up to date?`
  ];
  const qs = [];
  for(let i=0;i<limit;i++){
    const k = kws[i % kws.length] || 'the required skill';
    const t = templates[i % templates.length];
    qs.push({q: t(k), key:k});
  }
  return qs;
}

module.exports = { loadDictionary, checkResumeQuality, analyzeResumeWithJD, generateInterviewQuestions, robustExtractText };
