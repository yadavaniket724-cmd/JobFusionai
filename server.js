// server.js - replacement for JobFusionAI
created_at: new Date().toISOString()
};
history.unshift(rec);
// return fields expected by index.html
res.json({
fileId: rec.id,
fileName: rec.filename,
buildQualityScore: rec.buildQualityScore,
improvements: rec.suggestions,
sampleText: (result.parsedResume && result.parsedResume.summary) || '',
pages: result.pages || 1
});
} catch (err) {
console.error('uploadResume error', err);
res.status(500).json({ error: err.message });
}
});


// Analyze (resume + JD)
app.post('/analyze', upload.single('jdfile'), async (req, res) => {
try {
const { jdText, resumeFileId } = req.body;
// find resume path by id
const rec = history.find(h => h.id === resumeFileId) || history[0];
if (!rec) return res.status(400).json({ error: 'No resume available. Please upload first.' });
const jdPath = req.file ? path.resolve(req.file.path) : null;


const analysis = await analyzeResumeWithJD(rec.filepath, jdPath, jdText);
// expected return: { matchPercent, keywords }
res.json({ matchPercent: analysis.matchPercent || 0, keywords: analysis.keywords || '' });
} catch (err) {
console.error('analyze error', err);
res.status(500).json({ error: err.message });
}
});


// Generate interview questions
app.post('/generateInterview', express.json(), async (req, res) => {
try {
const { jdText, resumeFileId, count } = req.body;
const rec = history.find(h => h.id === resumeFileId) || history[0];
if (!rec) return res.status(400).json({ error: 'No resume available.' });
// prefer jdText; fallback to parsed resume + jd
const sourceText = jdText || (rec.parsedResume && JSON.stringify(rec.parsedResume)) || '';
const questions = await generateInterviewQuestions(sourceText, count || 8);
res.json({ questions });
} catch (err) {
console.error('generateInterview error', err);
res.status(500).json({ error: err.message });
}
});


// history endpoint
app.get('/api/history', (req, res) => {
res.json(history.map(h => ({ id: h.id, filename: h.filename, buildScore: h.buildQualityScore, created_at: h.created_at })));
});


// download report: minimal HTML report (client can print or convert to PDF)
app.get('/downloadReport/:id', (req, res) => {
const id = req.params.id;
const rec = history.find(h => h.id === id);
if (!rec) return res.status(404).send('Report not found');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Report - ${rec.filename}</title></head><body><h1>Resume Report</h1><p><b>File:</b> ${rec.filename}</p><p><b>Score:</b> ${rec.buildQualityScore}</p><pre>${JSON.stringify(rec.parsedResume||{},null,2)}</pre></body></html>`;
res.setHeader('Content-Type', 'text/html');
res.send(html);
});


// Serve frontend
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JobFusionAI running on ${PORT}`));
