#!/bin/bash

echo "🚀 Obsidian Sync Server - Quick Setup"
echo "======================================"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file already exists"
    echo ""
    echo "Current configuration:"
    cat .env | grep -v "^#" | grep -v "^$"
    echo ""
    read -p "Do you want to reconfigure? (y/N): " reconfigure
    if [ "$reconfigure" != "y" ] && [ "$reconfigure" != "Y" ]; then
        echo "Keeping existing configuration."
        exit 0
    fi
fi

# Copy example file
cp .env.example .env
echo "📝 Created .env file from .env.example"
echo ""

# Ask for drive type
echo "Choose storage backend:"
echo "  1) Local storage (default, works immediately)"
echo "  2) Google Drive (requires OAuth2 setup)"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" == "2" ]; then
    # Google Drive setup
    echo ""
    echo "📱 Google Drive OAuth2 Setup"
    echo "----------------------------"
    echo ""
    echo "You'll need OAuth2 credentials from Google Cloud Console."
    echo "Follow the guide in OAUTH_SETUP.md or:"
    echo ""
    echo "Quick steps:"
    echo "  1. Visit: https://console.cloud.google.com"
    echo "  2. Create project → Enable Drive API"
    echo "  3. Create OAuth Client ID (Web application)"
    echo "  4. Add redirect URI: http://localhost:3000/auth/google/callback"
    echo ""
    read -p "Press Enter when you have your Client ID and Secret..."
    echo ""
    
    read -p "Enter Google Client ID: " client_id
    read -p "Enter Google Client Secret: " client_secret
    
    # Update .env file
    sed -i.bak "s|DRIVE_TYPE=local|DRIVE_TYPE=google|g" .env
    sed -i.bak "s|GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$client_id|g" .env
    sed -i.bak "s|GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$client_secret|g" .env
    rm .env.bak
    
    echo ""
    echo "✅ Google Drive configured!"
    echo ""
    echo "Next steps:"
    echo "  1. Start server: bun run src/index.ts"
    echo "  2. Open browser: http://localhost:3000/auth/google"
    echo "  3. Authenticate with your Google account"
    
else
    # Local storage setup (default)
    echo ""
    echo "💾 Local Storage Setup"
    echo "---------------------"
    echo ""
    read -p "Enter storage path (default: ./local-storage): " storage_path
    storage_path=${storage_path:-./local-storage}
    
    # Update .env file
    sed -i.bak "s|LOCAL_STORAGE_PATH=.*|LOCAL_STORAGE_PATH=$storage_path|g" .env
    rm .env.bak
    
    echo ""
    echo "✅ Local storage configured!"
    echo ""
    echo "Next steps:"
    echo "  1. Start server: bun run src/index.ts"
    echo "  2. Files will be stored in: $storage_path"
fi

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  cd packages/server"
echo "  bun run src/index.ts"
echo ""
