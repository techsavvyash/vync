import { requestUrl } from 'obsidian'

export interface GoogleDriveTokens {
	access_token: string
	refresh_token?: string
	scope: string
	token_type: string
	expiry_date: number
}

/**
 * Browser-compatible Google OAuth2 service
 * Uses fetch/requestUrl instead of Node.js libraries
 */
export class GoogleDriveAuthService {
	private tokens: GoogleDriveTokens | null = null

	constructor(
		private clientId: string,
		private clientSecret: string,
		private redirectUri: string = 'urn:ietf:wg:oauth:2.0:oob' // Out-of-band flow for desktop apps
	) {}

	/**
	 * Generate OAuth URL for user authorization
	 */
	getAuthUrl(): string {
		const scopes = [
			'https://www.googleapis.com/auth/drive.file'
		]

		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			response_type: 'code',
			scope: scopes.join(' '),
			access_type: 'offline',
			prompt: 'consent' // Force to get refresh token
		})

		return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async exchangeCodeForTokens(code: string): Promise<GoogleDriveTokens> {
		try {
			const response = await requestUrl({
				url: 'https://oauth2.googleapis.com/token',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					code: code,
					client_id: this.clientId,
					client_secret: this.clientSecret,
					redirect_uri: this.redirectUri,
					grant_type: 'authorization_code'
				}).toString()
			})

			const data = response.json

			if (!data.access_token) {
				throw new Error('No access token received')
			}

			this.tokens = {
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				scope: data.scope || '',
				token_type: data.token_type || 'Bearer',
				expiry_date: Date.now() + (data.expires_in * 1000)
			}

			return this.tokens
		} catch (error) {
			console.error('Error exchanging code for tokens:', error)
			throw new Error(`Failed to exchange authorization code: ${error}`)
		}
	}

	/**
	 * Set tokens from storage
	 */
	setTokens(tokens: GoogleDriveTokens) {
		this.tokens = tokens
	}

	/**
	 * Get current tokens
	 */
	getTokens(): GoogleDriveTokens | null {
		return this.tokens
	}

	/**
	 * Check if authenticated
	 */
	isAuthenticated(): boolean {
		return this.tokens !== null && this.tokens.access_token !== undefined
	}

	/**
	 * Check if token is expired
	 */
	isTokenExpired(): boolean {
		if (!this.tokens || !this.tokens.expiry_date) {
			return true
		}
		return Date.now() >= this.tokens.expiry_date - 60000 // 1 minute buffer
	}

	/**
	 * Refresh access token using refresh token
	 */
	async refreshAccessToken(): Promise<void> {
		if (!this.tokens?.refresh_token) {
			throw new Error('No refresh token available')
		}

		try {
			const response = await requestUrl({
				url: 'https://oauth2.googleapis.com/token',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					refresh_token: this.tokens.refresh_token,
					client_id: this.clientId,
					client_secret: this.clientSecret,
					grant_type: 'refresh_token'
				}).toString()
			})

			const data = response.json

			this.tokens = {
				...this.tokens,
				access_token: data.access_token,
				expiry_date: Date.now() + (data.expires_in * 1000)
			}
		} catch (error) {
			console.error('Error refreshing access token:', error)
			throw new Error(`Failed to refresh access token: ${error}`)
		}
	}

	/**
	 * Get valid access token, refreshing if needed
	 */
	async getValidAccessToken(): Promise<string> {
		if (!this.tokens) {
			throw new Error('Not authenticated')
		}

		if (this.isTokenExpired() && this.tokens.refresh_token) {
			await this.refreshAccessToken()
		}

		return this.tokens.access_token
	}

	/**
	 * Revoke tokens and sign out
	 */
	async revokeTokens(): Promise<void> {
		if (!this.tokens) {
			return
		}

		try {
			await requestUrl({
				url: `https://oauth2.googleapis.com/revoke?token=${this.tokens.access_token}`,
				method: 'POST'
			})
			this.tokens = null
		} catch (error) {
			console.error('Error revoking tokens:', error)
			// Even if revocation fails, clear local tokens
			this.tokens = null
		}
	}
}
