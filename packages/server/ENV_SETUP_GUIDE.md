# Environment Setup Guide

## Quick Start

### 1. Copy Example File
```bash
cp .env.example .env
```

### 2. Choose Your Storage Backend

#### Option A: Local Storage (Development/Testing)
```bash
# .env
DRIVE_TYPE=local
LOCAL_STORAGE_PATH=./local-storage
```

#### Option B: Google Drive (Production)
```bash
# .env
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Google OAuth Setup

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable **Google Drive API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create OAuth 2.0 Client ID:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Give it a name (e.g., "Obsidian Sync Server")

### Step 2: Configure Redirect URIs

Add these redirect URIs based on your environment:

**For Development (Local):**
```
http://localhost:3000/auth/google/callback
```

**For Production:**
```
https://your-domain.com/auth/google/callback
```

**For Multiple Environments:**
```
http://localhost:3000/auth/google/callback
http://localhost:8080/auth/google/callback
https://staging.your-domain.com/auth/google/callback
https://your-domain.com/auth/google/callback
```

### Step 3: Copy Credentials to .env

```bash
# .env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
```

### Step 4: Authenticate

```bash
# Start the server
bun run dev

# Visit in browser
http://localhost:3000/auth/google

# Complete OAuth flow
# Tokens will be saved to oauth-tokens.json
```

## Configuration Options

### OAuth Redirect URI (Optional)

The redirect URI is **auto-detected** by default. You only need to set it manually for specific cases:

**Auto-Detection (Recommended):**
```bash
# Leave GOOGLE_REDIRECT_URI commented out
# Server will auto-detect based on incoming request
```

**Manual Override (Production):**
```bash
# Force specific redirect URI
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
```

**How Auto-Detection Works:**
- Request to `http://localhost:3000/auth/google`
  → Redirects to `http://localhost:3000/auth/google/callback`
- Request to `https://sync.example.com/auth/google`
  → Redirects to `https://sync.example.com/auth/google/callback`

### Server Configuration

```bash
# Server port (default: 3000)
PORT=3000

# Server host (default: 0.0.0.0)
HOST=0.0.0.0

# Node environment
NODE_ENV=development  # or production
```

### Debug Options

```bash
# Enable debug logging
DEBUG=true

# CORS origins (comma-separated)
CORS_ORIGINS=https://your-domain.com,app://obsidian.md
```

## Environment-Specific Configurations

### Development (.env)
```bash
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
# GOOGLE_REDIRECT_URI is auto-detected
PORT=3000
NODE_ENV=development
DEBUG=true
```

### Production (.env)
```bash
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
PORT=3000
NODE_ENV=production
# DEBUG=false
CORS_ORIGINS=https://your-domain.com
```

### Staging (.env)
```bash
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://staging.your-domain.com/auth/google/callback
PORT=3000
NODE_ENV=staging
DEBUG=true
```

## Verification

### 1. Check Configuration
```bash
# Start server with debug
DEBUG=true bun run dev

# Check console output
🔍 SERVER STARTUP: Initializing services...
DRIVE_TYPE: google
GOOGLE_CLIENT_ID: ✅ Set
GOOGLE_CLIENT_SECRET: ✅ Set
```

### 2. Test OAuth Flow
```bash
# Visit auth endpoint
curl http://localhost:3000/auth/google

# Or open in browser
open http://localhost:3000/auth/google

# Check for redirect URI in logs
🔗 OAuth Redirect URI: http://localhost:3000/auth/google/callback
```

### 3. Verify Authentication
```bash
# Check auth status
curl http://localhost:3000/auth/status

# Expected response (before auth)
{
  "authenticated": false,
  "method": "none",
  "hasTokens": false
}

# Expected response (after auth)
{
  "authenticated": true,
  "method": "oauth2",
  "hasTokens": true,
  "tokenExpiry": "2024-01-01T00:00:00.000Z"
}
```

## Troubleshooting

### Issue: "OAuth2 credentials not configured"
**Solution:**
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Check for typos in environment variable names
- Restart server after changing .env file

### Issue: "redirect_uri_mismatch"
**Solution:**
1. Check console for actual redirect URI being used
2. Add that exact URI to Google Cloud Console
3. Make sure protocol (http/https) matches
4. Ensure there are no trailing slashes

### Issue: "Google Drive service not configured"
**Solution:**
- Set `DRIVE_TYPE=google` in .env
- Restart server

### Issue: Tokens not persisting
**Solution:**
- Check file permissions for `oauth-tokens.json`
- Ensure server has write access to current directory
- For Docker/containers, use volume mounts

## Security Best Practices

### 1. Never Commit Secrets
```bash
# .gitignore should include:
.env
oauth-tokens.json
credentials.json
```

### 2. Use Different Credentials Per Environment
- Development: One OAuth client
- Staging: Another OAuth client
- Production: Separate OAuth client

### 3. Restrict CORS in Production
```bash
# Don't use '*' in production
CORS_ORIGINS=https://your-domain.com,app://obsidian.md
```

### 4. Use HTTPS in Production
```bash
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
# Never use http:// in production
```

## Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DRIVE_TYPE` | Yes | `local` | Storage backend: `local` or `google` |
| `GOOGLE_CLIENT_ID` | If using Google | - | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | If using Google | - | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | Auto-detected | OAuth callback URL |
| `LOCAL_STORAGE_PATH` | If using local | `./local-storage` | Local file storage path |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `DEBUG` | No | `false` | Enable debug logs |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins |