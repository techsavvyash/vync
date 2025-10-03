import { Elysia } from 'elysia'

/**
 * Auth routes - These are now minimal since OAuth is handled in the plugin
 * Tokens are stored on user's machine and sent with each request via Authorization header
 *
 * The server only provides information about OAuth configuration
 */
export const authRoutes = new Elysia({ prefix: '/auth' })
  .get('/status', () => {
    // Return basic info about server auth configuration
    return {
      authenticated: false,
      method: 'client-side',
      message: 'This server uses client-side authentication. Authenticate in the Obsidian plugin settings.'
    }
  })
