#!/bin/bash
# Quick setup script for complianceai-pro project

echo "🚀 Setting up complianceai-pro project..."

# 1. Create root .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔧 Creating root .env file..."
    cat > .env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3001

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=https://dvtxfftauzoedgpdgbfe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dHhmZnRhdXpvZWRncGRnYmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NzQwMTIsImV4cCI6MjA3OTA1MDAxMn0.5MTjvNOq4-zr_CIu-IwDziGYRGPcw9b-t4D8TjFeQWc
SUPABASE_SERVICE_KEY=your_actual_service_key_here # GET THIS FROM SUPABASE DASHBOARD

# Gemini AI Configuration
GEMINI_API_KEY=AIzaSyC8iQQKWFmuid6tr97Ae0VGSwQnEsdnkCg

# Python Environment
PYTHONPATH=/workspaces/complianceai-pro
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# 2. Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# 3. Install Python dependencies
echo "🔧 Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt
echo "✅ Python dependencies installed"

# 4. Install Node.js dependencies for server
echo "🔧 Installing server dependencies..."
cd server
npm install
cd ..

# 5. Install Node.js dependencies for frontend
echo "🔧 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# 6. Create .env.example files for documentation
echo "🔧 Creating .env.example files..."

# Server .env.example
cat > server/.env.example << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
EOF

# Frontend .env.example
cat > frontend/.env.example << 'EOF'
# Frontend Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
EOF

echo "✅ Environment setup complete!"

echo ""
echo "🚀 NEXT STEPS:"
echo "1. Fill in your actual API keys in the .env files"
echo "2. Run the server: cd server && npm start"
echo "3. Run the frontend: cd frontend && npm run dev"
echo "4. Test the API: curl -X POST http://localhost:3001/api/screen -H 'Content-Type: application/json' -d '{\"name\":\"John Doe\"}'"
echo "5. For sanctions data import (TEST MODE first): python3 scripts/import_all_sanctions.py"
echo ""
echo "⚠️  IMPORTANT: Set TEST_MODE = False in import_all_sanctions.py for full import."
echo ""
echo "🎉 Project is ready to run!"