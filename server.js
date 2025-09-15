/**
 * server.js - JobFusionAI backend + frontend for Render
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

// ATS functions
const { checkResumeQuality, analyzeResumeWithJD, generateInterviewQuestions } = require("./ats");

const app = express(); // Must be defined first
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve frontend

// ---- API Routes ----

// Step 1: Upload resume & analyze quality
app.post("/uploadResume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No resume uploaded" });

    const result = await checkResumeQuality(req.file.path);
    res.json({ ...result, fileId: req.file.filename });
  } catch (err) {
    console.error("Error in /uploadResume:", err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Analyze resume vs JD
app.post("/analyze", upload.fields([{ name: "jdfile" }]), async (req, res) => {
  try {
    const jdFile = req.files?.jdfile?.[0];
    const jdText = req.body.jdText;
    const resumeFileId = req.body.resumeFileId;
    if (!resumeFileId) return res.status(400).json({ error: "Resume file ID missing" });

    const resumePath = path.join("uploads", resumeFileId);
    const result = await analyzeResumeWithJD(resumePath, jdFile?.path, jdText);
    res.json(result);
  } catch (err) {
    console.error("Error in /analyze:", err);
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Generate interview questions
app.post("/interview", async (req, res) => {
  try {
    const { jdText } = req.body;
    if (!jdText) return res.status(400).json({ error: "JD text missing" });

    const result = await generateInterviewQuestions(jdText, 5);
    res.json({ questions: result });
  } catch (err) {
    console.error("Error in /interview:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Catch-all route to serve frontend ----
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 JobFusionAI server running on port ${PORT}`);
});
