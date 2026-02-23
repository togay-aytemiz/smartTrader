#!/bin/bash
# SmartTrader — Start Backend
set -e
cd "$(dirname "$0")/backend"
source venv/bin/activate
echo "✅ Starting SmartTrader backend on http://localhost:8000"
uvicorn main:app --reload --port 8000
