# JobFusion.AI — Resume Analyzer (Enhanced)

## Features added in this build
- Resume upload, ATS-style scanning, build-quality scoring
- Server-side persistence (uploads stored in `uploads/` and recorded in SQLite DB `jobfusion.db`)
- JD analysis with keyword extraction and match percentage
- Interview question generation from JD
- Optional grammar/spell checks using LanguageTool (configure via env vars)
- Dockerfile and `start.sh` provided for easy deployment

## Quick start (local)
1. Install:
   ```bash
   npm install
   ```
2. Start:
   ```bash
   node server.js
   ```
3. Open: `http://localhost:3000`

## Docker
Build and run:
```bash
docker build -t jobfusionai .
docker run -p 3000:3000 --env LANGUAGETOOL_URL="https://api.languagetoolplus.com/v2/check" jobfusionai
```

## Optional: LanguageTool grammar API
- Set `LANGUAGETOOL_URL` (and optionally `LANGUAGETOOL_API_KEY`) in the environment to enable grammar/suggestions.
- The server will call the API on resume sample text and include `grammarHints` in the upload response (if available).

## Notes
- Install `pdf-parse`, `nspell`, `dictionary-en` for improved PDF parsing and spell-checks.
- The app uses SQLite (`jobfusion.db`) to store uploads and analyses — no external DB required.


## Demo automation

Run `demo/record_demo.sh` to capture screenshots and produce `demo/demo.gif` (requires ffmpeg and a running server at http://localhost:3000).

## CI/CD

A GitHub Actions workflow has been added at `.github/workflows/docker-image.yml`. Configure `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and `DOCKER_REPO` in repo secrets to enable pushing images.
