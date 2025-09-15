const express=require('express');
const multer=require('multer');
const cors=require('cors');
const path=require('path');
const fs=require('fs');
const fetch = require('node-fetch');
const { loadDictionary, checkResumeQuality, analyzeResumeWithJD, generateInterviewQuestions, robustExtractText } = require('./ats');
const sqlite3 = require('sqlite3').verbose();

const app=express(); const port=process.env.PORT||3000;
app.use(cors()); app.use(express.json()); app.use(express.urlencoded({extended:true}));

const DB_PATH = path.join(__dirname,'jobfusion.db');
const UPLOAD_DIR=path.join(__dirname,'uploads'); if(!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,UPLOAD_DIR),filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname)});
const upload=multer({storage});

// init sqlite db
const db = new sqlite3.Database(DB_PATH);
db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, filename TEXT, path TEXT, buildScore INTEGER, pages INTEGER, created_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, upload_id TEXT, matchPercent INTEGER, keywords TEXT, found TEXT, missing TEXT, created_at TEXT
  )`);
});

let SPELL = null;
(async ()=>{ try{ SPELL = await loadDictionary(); console.log("Spell loaded:",!!SPELL);}catch(e){console.log("Spell load failed",e);} })();

app.use(express.static(path.join(__dirname)));

// helper to call LanguageTool (optional). Configure via env LANGUAGETOOL_URL and LANGUAGETOOL_API_KEY (if required)
async function languageToolCheck(text){
  const url = process.env.LANGUAGETOOL_URL || 'https://api.languagetoolplus.com/v2/check';
  try{
    const body = new URLSearchParams();
    body.append('text', text);
    body.append('language', 'en-US');
    const headers = {};
    if(process.env.LANGUAGETOOL_API_KEY) headers['Authorization'] = 'Bearer '+process.env.LANGUAGETOOL_API_KEY;
    const resp = await fetch(url, {method:'POST', body, headers});
    if(!resp.ok) return null;
    const j = await resp.json();
    return j; // contains matches with suggestions
  }catch(e){
    return null;
  }
}

// upload resume and persist with an id
app.post('/uploadResume', upload.single('resume'), async (req,res)=>{
  try{
    const fp = req.file.path;
    const id = path.basename(fp);
    const result = await checkResumeQuality(fp, SPELL);
    result.fileId = id;
    // attempt grammar check asynchronously (non-blocking) but include summary if available
    let lt = null;
    try{ lt = await languageToolCheck(result.sampleText || ''); }catch(e){ lt = null; }
    if(lt && lt.matches && lt.matches.length>0){
      result.grammarHints = lt.matches.slice(0,8).map(m=>({message:m.message, offset:m.offset, length:m.length, replacements: m.replacements&&m.replacements.slice(0,3).map(r=>r.value)}));
    }
    // save to DB
    db.run(`INSERT OR REPLACE INTO uploads (id, filename, path, buildScore, pages, created_at) VALUES (?,?,?,?,?,?)`,
      [id, req.file.originalname, fp, result.buildQualityScore, result.pages, new Date().toISOString()]);
    res.json(result);
  }catch(e){
    console.error(e);
    res.status(500).json({error: e.message});
  }
});

// analyze: can accept resume file upload OR resumeFileId from earlier; optional jdfile or jdText
app.post('/analyze', upload.fields([{name:'resume'},{name:'jdfile'}]), async (req,res)=>{
  try{
    let resumePath = null;
    if(req.body.resumeFileId) {
      const maybe = path.join(UPLOAD_DIR, req.body.resumeFileId);
      if(fs.existsSync(maybe)) resumePath = maybe;
    }
    if(req.files && req.files['resume'] && req.files['resume'][0]) resumePath = req.files['resume'][0].path;
    if(!resumePath) return res.status(400).json({error:'Resume not provided. Upload resume or pass resumeFileId.'});
    let jdPath = null;
    if(req.files && req.files['jdfile'] && req.files['jdfile'][0]) jdPath = req.files['jdfile'][0].path;
    const jdText = req.body.jdText || '';
    const out = await analyzeResumeWithJD(resumePath, jdPath, jdText);
    // persist analysis
    const uploadId = path.basename(resumePath);
    db.run(`INSERT INTO analyses (upload_id, matchPercent, keywords, found, missing, created_at) VALUES (?,?,?,?,?,?)`,
      [uploadId, out.matchPercent, JSON.stringify(out.keywords), JSON.stringify(out.found), JSON.stringify(out.missing), new Date().toISOString()]);
    // update uploads table with latest match percent (store in analyses table primarily)
    res.json(out);
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
});

app.post('/interview', express.json(), (req,res)=>{
  try{
    const jdText = req.body.jdText||'';
    const qs = generateInterviewQuestions(jdText, 10);
    res.json({questions:qs});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

// provide history endpoints
app.get('/api/history', (req,res)=>{
  db.all(`SELECT u.id,u.filename,u.buildScore,u.pages,u.created_at, a.matchPercent, a.created_at as analyzed_at
          FROM uploads u LEFT JOIN analyses a ON a.upload_id = u.id
          ORDER BY u.created_at DESC LIMIT 50`, [], (err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows||[]);
  });
});

app.get('/file/:id', (req,res)=>{
  const id = req.params.id;
  const fp = path.join(UPLOAD_DIR, id);
  if(fs.existsSync(fp)) res.sendFile(fp);
  else res.status(404).send('Not found');
});

app.listen(port,()=>console.log("Server listening on",port));
