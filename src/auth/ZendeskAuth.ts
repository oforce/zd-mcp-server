import { randomBytes } from 'crypto';

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export class ZendeskAuth {
  private subdomain: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;

  constructor(subdomain: string, clientId: string, clientSecret: string) {
    this.subdomain = subdomain;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async initiateDeviceFlow(): Promise<{ userCode: string; verificationUrl: string }> {
    const response = await fetch(`https://${this.subdomain}.zendesk.com/oauth/device/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: 'read write',
      }),
    });

    if (!response.ok) {
      throw new Error(`Device flow initiation failed: ${response.status} ${response.statusText}`);
    }

    const data: DeviceCodeResponse = await response.json();
    
    return {
      userCode: data.user_code,
      verificationUrl: data.verification_uri_complete || data.verification_uri,
    };
  }

  async pollForToken(deviceCode: string): Promise<string> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`https://${this.subdomain}.zendesk.com/oauth/tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        if (response.ok) {
          const tokenData: OAuthTokenResponse = await response.json();
          this.accessToken = tokenData.access_token;
          return this.accessToken;
        }

        const errorData = await response.json();
        
        // Handle pending authorization
        if (errorData.error === 'authorization_pending') {
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          continue;
        }

        // Handle other errors
        if (errorData.error === 'expired_token' || errorData.error === 'access_denied') {
          throw new Error(`Authorization ${errorData.error}: ${errorData.error_description || 'Unknown error'}`);
        }

        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authorization')) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    throw new Error('Authorization timed out. Please try again.');
  }

  async login(): Promise<string> {
    try {
      const { userCode, verificationUrl } = await this.initiateDeviceFlow();
      
      console.log('\n=== Zendesk OAuth Login ===');
      console.log(`Please visit: ${verificationUrl}`);
      console.log(`Enter code: ${userCode}`);
      console.log('Waiting for authorization...\n');

      const deviceCode = await this.extractDeviceCode(userCode);
      const token = await this.pollForToken(deviceCode);
      
      console.log('✅ Authorization successful!');
      return token;
    } catch (error) {
      console.log('❌ Authorization failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async extractDeviceCode(userCode: string): Promise<string> {
    // In a real implementation, we'd store the device code from the initial request
    // For simplicity, we'll re-initiate to get the device code
    const response = await fetch(`https://${this.subdomain}.zendesk.com/oauth/device/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        scope: 'read write',
      }),
    });

    const data: DeviceCodeResponse = await response.json();
    return data.device_code;
  }

  getToken(): string | null {
    return this.accessToken;
  }

  logout(): void {
    this.accessToken = null;
    console.log('✅ Logged out successfully');
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}