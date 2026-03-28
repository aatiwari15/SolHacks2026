#!/bin/bash
# Install deps (first time only) then start the server.
set -e

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "Starting Unidad Form Bot at http://localhost:8000"
echo ""
uvicorn main:app --reload --port 8000
