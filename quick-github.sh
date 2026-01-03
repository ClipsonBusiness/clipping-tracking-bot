#!/bin/bash

echo "🚀 Quick GitHub Setup"
echo "===================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git..."
    git init
fi

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found!"
    echo ""
    echo "Option 1: Create repo with GitHub CLI (Easiest!)"
    echo "Run: gh repo create clipping-tracking-bot --public --source=. --remote=origin --push"
    echo ""
    read -p "Do you want to create the repo now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh repo create clipping-tracking-bot --public --source=. --remote=origin --push
        echo "✅ Done! Your code is on GitHub!"
        exit 0
    fi
fi

# Fallback to manual setup
echo "📝 Manual setup:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create repo: clipping-tracking-bot"
echo "3. Then run:"
echo ""
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/YOUR_USERNAME/clipping-tracking-bot.git"
echo "   git push -u origin main"
echo ""
