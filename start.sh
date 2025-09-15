#!/bin/sh
# Simple start script: install if node_modules missing, then start
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting server..."
node server.js
