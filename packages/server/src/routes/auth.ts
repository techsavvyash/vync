import { Elysia } from 'elysia'
import { DriveServiceFactory } from '../services/drive/DriveServiceFactory'
import { GoogleDriveService } from '../services/drive/GoogleDriveService'
import { promises as fs } from 'fs'
import path from 'path'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .get('/google', async () => {
    try {
      const driveService = DriveServiceFactory.getDriveService()

      if (!(driveService instanceof GoogleDriveService)) {
        return {
          success: false,
          message: 'Google Drive service not configured. Set DRIVE_TYPE=google'
        }
      }

      const authUrl = driveService.getAuthUrl()

      // Return HTML page with redirect
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Drive Authentication</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #333;
              margin-bottom: 1rem;
            }
            p {
              color: #666;
              margin-bottom: 2rem;
            }
            .btn {
              display: inline-block;
              padding: 12px 32px;
              background: #4285f4;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: background 0.3s;
            }
            .btn:hover {
              background: #357ae8;
            }
            .redirecting {
              color: #4285f4;
              font-size: 0.9rem;
              margin-top: 1rem;
            }
          </style>
          <script>
            setTimeout(() => {
              window.location.href = '${authUrl}';
            }, 2000);
          </script>
        </head>
        <body>
          <div class="container">
            <h1>🔐 Google Drive Authentication</h1>
            <p>You'll be redirected to Google to grant access to your Drive.</p>
            <a href="${authUrl}" class="btn">Authenticate with Google</a>
            <div class="redirecting">Redirecting in 2 seconds...</div>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html'
        }
      })
    } catch (error) {
      console.error('OAuth error:', error)
      return {
        success: false,
        message: `Authentication error: ${error}`
      }
    }
  })
  .get('/google/callback', async ({ query }) => {
    try {
      const code = query.code as string

      if (!code) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: sans-serif; padding: 2rem; text-align: center; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">❌ Authentication Error</h1>
            <p>No authorization code received from Google</p>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        })
      }

      const driveService = DriveServiceFactory.getDriveService()

      if (!(driveService instanceof GoogleDriveService)) {
        throw new Error('Google Drive service not configured')
      }

      // Exchange code for tokens
      await driveService.setOAuthTokens(code)

      // Save tokens to disk for persistence
      const tokens = driveService.getOAuthTokens()
      const tokensPath = path.join(process.cwd(), 'oauth-tokens.json')
      await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2))

      console.log('✅ OAuth tokens saved successfully')

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            .success { color: #2e7d32; font-size: 3rem; margin-bottom: 1rem; }
            h1 { color: #333; margin-bottom: 1rem; }
            p { color: #666; line-height: 1.6; }
            .token-info {
              background: #f5f5f5;
              padding: 1rem;
              border-radius: 6px;
              margin-top: 1.5rem;
              font-size: 0.9rem;
              text-align: left;
            }
            .close-btn {
              margin-top: 1.5rem;
              padding: 10px 24px;
              background: #4285f4;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 1rem;
            }
          </style>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Authentication Successful!</h1>
            <p>Your Google Drive has been connected successfully.</p>
            <p>You can now sync your Obsidian vaults to Google Drive.</p>
            <div class="token-info">
              <strong>Tokens saved:</strong><br>
              oauth-tokens.json
            </div>
            <button class="close-btn" onclick="window.close()">Close this window</button>
            <p style="font-size: 0.8rem; color: #999; margin-top: 1rem;">
              This window will close automatically in 5 seconds
            </p>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html'
        }
      })
    } catch (error) {
      console.error('OAuth callback error:', error)

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body {
              font-family: sans-serif;
              padding: 2rem;
              text-align: center;
            }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Authentication Error</h1>
          <p>${error}</p>
          <p><a href="/auth/google">Try again</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
  })
  .get('/status', ({ store }) => {
    try {
      const driveService = (store as any)?.driveService || DriveServiceFactory.getDriveService()

      if (!(driveService instanceof GoogleDriveService)) {
        return {
          authenticated: false,
          method: 'none',
          message: 'Google Drive service not configured'
        }
      }

      const tokens = driveService.getOAuthTokens()
      const isAuthenticated = driveService.isAuthenticated()

      return {
        authenticated: isAuthenticated,
        method: tokens ? 'oauth2' : 'service_account',
        hasTokens: !!tokens,
        tokenExpiry: tokens?.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
      }
    } catch (error) {
      return {
        authenticated: false,
        error: `${error}`
      }
    }
  })
