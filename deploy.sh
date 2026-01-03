#!/bin/bash

echo "🚀 Quick Deploy Script"
echo "===================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel..."
    vercel login
fi

echo "📤 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Set environment variables in Vercel dashboard"
echo "   2. Deploy workers separately (Railway/Render)"
echo ""

