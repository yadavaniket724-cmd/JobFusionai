/**
 * server.js - Express backend for JobFusionAI
 */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { checkResumeQuality, analyzeResumeWithJD, generateInterviewQuestions } = require("./ats");

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ---- Routes ----

// Step 1: Upload resume & analyze quality
app.post("/uploadResume", upload.single("resume"), async (req, res) => {
  try {
    const result = await checkResumeQuality(req.file.path);
    res.json({ ...result, fileId: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Analyze resume vs JD
app.post("/analyze", upload.fields([{ name: "jdfile" }]), async (req, res) => {
  try {
    const jdFile = req.files?.jdfile?.[0];
    const jdText = req.body.jdText;
    const resumeFileId = req.body.resumeFileId;
    const resumePath = path.join("uploads", resumeFileId);

    const result = await analyzeResumeWithJD(resumePath, jdFile?.path, jdText);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Generate interview questions
app.post("/interview", async (req, res) => {
  try {
    const { jdText } = req.body;
    const result = await generateInterviewQuestions(jdText, 5);
    res.json({ questions: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
