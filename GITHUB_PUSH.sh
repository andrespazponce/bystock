#!/bin/bash

# BYSTOCK - GitHub Push Script
# Execute this script on your machine to push to GitHub

set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                   BYSTOCK - GITHUB SETUP & PUSH"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Initialize git
echo "1️⃣  Initializing Git repository..."
git init
git config user.email "andrespazponce@gmail.com"
git config user.name "Andres Paz"

# Add all files
echo "2️⃣  Adding files to git..."
git add .

# Create initial commit
echo "3️⃣  Creating initial commit..."
git commit -m "Initial commit: Bystock project" || true

# Rename master to main
echo "4️⃣  Renaming branch to 'main'..."
git branch -M main

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "NEXT STEPS:"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Option A: Using GitHub CLI (gh)"
echo "─────────────────────────────────"
echo "If you have GitHub CLI installed:"
echo ""
echo "  gh repo create bystock --public --source=. --remote=origin --push"
echo ""
echo ""
echo "Option B: Manual GitHub Setup"
echo "─────────────────────────────────"
echo "1. Go to https://github.com/new"
echo "2. Create repository named: bystock"
echo "3. Make it PUBLIC"
echo "4. Do NOT initialize with README/gitignore"
echo ""
echo "5. Then run:"
echo ""
echo "  git remote add origin https://github.com/YOUR_USERNAME/bystock.git"
echo "  git push -u origin main"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Current Git Status:"
echo "═══════════════════════════════════════════════════════════════════════════════"
git log --oneline -1
git status

echo ""
echo "✅ Git repository initialized successfully!"
