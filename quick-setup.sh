#!/bin/bash
# ComplianceAI Pro - Quick Setup Script (You already have Supabase!)

echo "🚀 Quick Setup for ComplianceAI Pro"
echo "===================================="
echo ""

# 1. Clean up old Python backend
echo "1️⃣ Cleaning up unused files..."
rm -rf backend/
echo "   ✅ Removed Python backend"

# 2. Clean frontend duplicates
cd frontend/src
rm -f App.tsx.broken App.tsx.tmp App.tsx.backup ScreeningPage.tsx.backup 2>/dev/null
cd ../..
echo "   ✅ Cleaned frontend duplicates"

# 3. Create necessary directories
echo ""
echo "2️⃣ Creating missing directories..."
mkdir -p server/middleware
mkdir -p server/models
mkdir -p docs
echo "   ✅ Directories created"

# 4. Install missing server dependencies
echo ""
echo "3️⃣ Installing server dependencies..."
cd server
npm install helmet compression express-rate-limit --save
echo "   ✅ Server dependencies installed"
cd ..

# 5. Create .env files from examples
echo ""
echo "4️⃣ Creating environment files..."

# Server .env
cat > server/.env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=5000

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=http://localhost:5173

# Supabase Configuration (FILL THESE IN!)
SUPABASE_URL=YOUR_SUPABASE_URL_HERE
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

# Gemini AI Configuration (FILL THIS IN!)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
EOF

# Frontend .env
cat > frontend/.env << 'EOF'
# Backend API URL (update after Render deployment)
VITE_API_URL=http://localhost:5000/api

# Supabase Configuration (FILL THESE IN!)
VITE_SUPABASE_URL=YOUR_SUPABASE_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
EOF

echo "   ✅ Environment files created"

echo ""
echo "════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1. Edit server/.env and add your credentials:"
echo "   nano server/.env"
echo ""
echo "2. Edit frontend/.env and add your credentials:"
echo "   nano frontend/.env"
echo ""
echo "3. Test locally:"
echo "   Terminal 1: cd server && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "4. Then deploy to Render + Vercel (see DEPLOY.md)"
echo ""