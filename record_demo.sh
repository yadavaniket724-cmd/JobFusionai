#!/bin/sh
set -e
# Usage: ./record_demo.sh
# Ensure server is running: node server.js
# Install puppeteer if not present
if [ ! -d "node_modules/puppeteer" ]; then
  echo "Installing puppeteer..."
  npm install puppeteer --no-audit --no-fund
fi
# Create frames dir
cd demo
rm -rf frames
mkdir -p frames
# Run the puppeteer script to capture frames
node record_demo.js
# Convert PNG frames to GIF (requires ffmpeg)
if command -v ffmpeg >/dev/null 2>&1; then
  echo "Creating demo.gif from frames..."
  ffmpeg -y -framerate 1 -i frames/frame_%03d.png -vf "scale=800:-1:flags=lanczos" -loop 0 demo.gif
  echo "demo/demo.gif created."
else
  echo "ffmpeg not found; install ffmpeg to create GIF from frames."
fi
