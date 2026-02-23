#!/bin/bash
# SmartTrader — Start Frontend (React / Vite)
set -e
cd "$(dirname "$0")/frontend"
echo "✅ Starting SmartTrader frontend on http://localhost:5173"
npm run dev
