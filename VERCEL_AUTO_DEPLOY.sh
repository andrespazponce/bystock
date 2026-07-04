#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
#                    BYSTOCK - VERCEL AUTO DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════
#
# Este script automatiza COMPLETAMENTE el deployment a Vercel
# Solo necesitas GitHub y Vercel CLI instalados
#
# Instalación previa:
#   - GitHub CLI: https://cli.github.com/
#   - Vercel CLI: npm install -g vercel
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                    🚀 BYSTOCK - AUTO DEPLOYMENT TO VERCEL"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo "${BLUE}Checking prerequisites...${NC}"
echo ""

if ! command -v git &> /dev/null; then
    echo "${RED}❌ Git is not installed${NC}"
    exit 1
fi
echo "${GREEN}✅ Git${NC}"

if ! command -v gh &> /dev/null; then
    echo "${YELLOW}⚠️  GitHub CLI not found${NC}"
    echo "   Install from: https://cli.github.com/"
    echo "   Or use manual GitHub setup (Option B below)"
else
    echo "${GREEN}✅ GitHub CLI${NC}"
fi

if ! command -v vercel &> /dev/null; then
    echo "${YELLOW}⚠️  Vercel CLI not installed${NC}"
    echo "   Installing: npm install -g vercel"
    npm install -g vercel
fi
echo "${GREEN}✅ Vercel CLI${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "STEP 1: Initialize Git Repository"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git..."
    git init
    git config user.email "andrespazponce@gmail.com"
    git config user.name "Andres Paz"
    git add .
    git commit -m "Initial commit: Bystock project setup" || true
    git branch -M main
    echo "${GREEN}✅ Git initialized${NC}"
else
    echo "${GREEN}✅ Git already initialized${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "STEP 2: Create GitHub Repository"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if command -v gh &> /dev/null; then
    echo "Creating GitHub repository with gh CLI..."
    
    if gh repo view bystock &> /dev/null; then
        echo "${YELLOW}⚠️  Repository 'bystock' already exists${NC}"
        read -p "Do you want to use the existing repo? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git remote remove origin 2>/dev/null || true
            git remote add origin "https://github.com/$(gh api user -q .login)/bystock.git" || true
        fi
    else
        echo "Creating new repository..."
        gh repo create bystock --public --source=. --remote=origin --push
        echo "${GREEN}✅ Repository created and code pushed${NC}"
    fi
else
    echo "${YELLOW}GitHub CLI not available. Using manual method...${NC}"
    echo ""
    echo "1. Go to: https://github.com/new"
    echo "2. Create repository named: bystock"
    echo "3. Make it PUBLIC"
    echo "4. Do NOT initialize with README/gitignore"
    echo "5. Then run:"
    echo ""
    echo "   git remote add origin https://github.com/YOUR_USERNAME/bystock.git"
    echo "   git push -u origin main"
    echo ""
    read -p "Press Enter when you've created the repo and pushed the code..."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "STEP 3: Deploy to Vercel"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Logging into Vercel..."
vercel login || true

echo ""
echo "Deploying project..."
vercel --prod

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "STEP 4: Configure Environment Variables (MANUAL)"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

echo "Your project is deployed! Now configure environment variables:"
echo ""
echo "1. Go to: https://vercel.com/dashboard"
echo "2. Select 'bystock' project"
echo "3. Go to: Settings → Environment Variables"
echo "4. Add:"
echo ""
echo "   Name:  VITE_API_URL"
echo "   Value: https://your-backend.railway.app/api"
echo "   (or your actual backend URL)"
echo ""
echo "5. Click 'Save' → Vercel will automatically redeploy"
echo ""

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Your frontend is now live! 🎉"
echo ""
echo "Next steps:"
echo "1. Configure backend environment variables (see above)"
echo "2. Deploy backend to Railway/Render/Heroku"
echo "3. Update VITE_API_URL in Vercel with backend URL"
echo ""
