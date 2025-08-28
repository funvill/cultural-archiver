/**
 * Email utilities for magic link authentication using Cloudflare Email Workers
 *
 * This module handles sending verification emails with magic links and
 * managing email-based authentication flows.
 */

import type { WorkerEnv } from '../types';
import { ApiError } from './errors';

// Configuration constants
const MAGIC_LINK_EXPIRY_MINUTES = 30;

/**
 * Email template data for magic link verification
 */
export interface MagicLinkEmailData {
  email: string;
  magicLink: string;
  expiresAt: string;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

/**
 * Generate a secure magic link token
 */
export async function generateMagicLinkToken(): Promise<string> {
  // Generate a secure random token using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64url (URL-safe)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Create magic link data and store in KV
 */
export async function createMagicLink(
  env: WorkerEnv,
  email: string,
  userToken: string,
  request: Request
): Promise<{ token: string; expiresAt: Date }> {
  const token = await generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  // Store magic link data in KV with expiration
  const magicLinkData = {
    email: email.toLowerCase().trim(),
    userToken,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    userAgent: request.headers.get('User-Agent') || 'Unknown',
    ipAddress: request.headers.get('CF-Connecting-IP') || 'Unknown',
    consumed: false,
  };

  // Store in KV with automatic expiration
  await env.SESSIONS.put(`magic:${token}`, JSON.stringify(magicLinkData), {
    expirationTtl: MAGIC_LINK_EXPIRY_MINUTES * 60,
  });

  return { token, expiresAt };
}

/**
 * Generate HTML email template for magic link
 */
export function generateMagicLinkEmail(data: MagicLinkEmailData): string {
  const { email, magicLink, expiresAt, userAgent, ipAddress } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your Cultural Archiver account</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #f0f0f0;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
        }
        .content {
            padding: 30px 0;
        }
        .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            font-size: 14px;
            color: #666;
            border-top: 1px solid #f0f0f0;
            padding-top: 20px;
            margin-top: 30px;
        }
        .security-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            font-size: 14px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🎨 Cultural Archiver</div>
    </div>
    
    <div class="content">
        <h1>Verify your email address</h1>
        
        <p>Hello,</p>
        
        <p>Someone requested to verify the email address <strong>${email}</strong> for Cultural Archiver. If this was you, click the button below to complete your verification:</p>
        
        <a href="${magicLink}" class="button">Verify Email Address</a>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px;">${magicLink}</p>
        
        <div class="security-info">
            <strong>Security Information:</strong><br>
            This link will expire at <strong>${expiresAt}</strong><br>
            ${userAgent ? `Browser: ${userAgent}<br>` : ''}
            ${ipAddress && ipAddress !== 'Unknown' ? `IP Address: ${ipAddress}<br>` : ''}
        </div>
        
        <p>If you didn't request this verification, you can safely ignore this email.</p>
    </div>
    
    <div class="footer">
        <p>This email was sent by Cultural Archiver, a crowdsourced public art mapping platform.</p>
        <p>If you have questions, please contact us through our website.</p>
    </div>
</body>
</html>`;
}

/**
 * Send magic link email using Cloudflare Email Workers
 */
export async function sendMagicLinkEmail(
  env: WorkerEnv,
  email: string,
  magicLink: string,
  expiresAt: Date,
  request: Request
): Promise<void> {
  try {
    const emailData: MagicLinkEmailData = {
      email: email.toLowerCase().trim(),
      magicLink,
      expiresAt: expiresAt.toLocaleString(),
      userAgent: request.headers.get('User-Agent') || undefined,
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined,
    };

    const htmlContent = generateMagicLinkEmail(emailData);

    // For MVP, we'll use a simple email sending approach
    // In production, this would integrate with Cloudflare Email Workers or a service like Resend

    if (env.EMAIL_API_KEY && env.EMAIL_FROM) {
      // Use external email service (Resend, SendGrid, etc.)
      const emailPayload = {
        from: env.EMAIL_FROM,
        to: email,
        subject: 'Verify your Cultural Archiver account',
        html: htmlContent,
      };

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Email sending failed:', errorData);
        throw new ApiError('Email delivery failed', 'INTEGRATION_ERROR', 502, {
          details: { email: email.toLowerCase().trim() },
        });
      }
    } else {
      // Development mode: log email content instead of sending
      console.log('=== DEVELOPMENT EMAIL ===');
      console.log('To:', email);
      console.log('Magic Link:', magicLink);
      console.log('Expires:', expiresAt.toISOString());
      console.log('========================');

      // In development, we'll store the magic link in KV for easy access
      await env.SESSIONS.put(
        `dev-email:${email}`,
        JSON.stringify({ magicLink, expiresAt: expiresAt.toISOString() }),
        { expirationTtl: MAGIC_LINK_EXPIRY_MINUTES * 60 }
      );
    }
  } catch (error) {
    console.error('Error sending magic link email:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to send verification email', 'EMAIL_SEND_ERROR', 503, {
      details: { email: email.toLowerCase().trim() },
    });
  }
}

/**
 * Consume a magic link token and verify email
 */
export async function consumeMagicLink(
  env: WorkerEnv,
  token: string
): Promise<{ userToken: string; email: string }> {
  try {
    // Retrieve magic link data from KV
    const magicLinkDataStr = await env.SESSIONS.get(`magic:${token}`);

    if (!magicLinkDataStr) {
      throw new ApiError('Invalid or expired verification link', 'INVALID_MAGIC_LINK', 400);
    }

    const magicLinkData = JSON.parse(magicLinkDataStr);

    // Check if already consumed
    if (magicLinkData.consumed) {
      throw new ApiError('Verification link has already been used', 'MAGIC_LINK_CONSUMED', 400);
    }

    // Check expiration (double-check even though KV has TTL)
    const expiresAt = new Date(magicLinkData.expiresAt);
    if (expiresAt <= new Date()) {
      throw new ApiError('Verification link has expired', 'MAGIC_LINK_EXPIRED', 400);
    }

    // Mark as consumed
    magicLinkData.consumed = true;
    magicLinkData.consumedAt = new Date().toISOString();

    await env.SESSIONS.put(
      `magic:${token}`,
      JSON.stringify(magicLinkData),
      { expirationTtl: 300 } // Keep for 5 minutes for audit purposes
    );

    // Store email verification for user
    await env.SESSIONS.put(
      `email:${magicLinkData.userToken}`,
      JSON.stringify({
        email: magicLinkData.email,
        verifiedAt: new Date().toISOString(),
        verificationMethod: 'magic_link',
      }),
      { expirationTtl: 86400 * 30 } // Keep for 30 days
    );

    return {
      userToken: magicLinkData.userToken,
      email: magicLinkData.email,
    };
  } catch (error) {
    console.error('Error consuming magic link:', error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to verify email', 'MAGIC_LINK_ERROR', 500);
  }
}

/**
 * Clean up expired magic links (for maintenance)
 */
export async function cleanupExpiredMagicLinks(_env: WorkerEnv): Promise<number> {
  // Note: KV automatically expires keys based on TTL, so this is mainly for audit purposes
  // In a production system, you might want to log cleanup statistics

  let cleanedCount = 0;

  try {
    // KV automatically handles expiration, but we could implement additional cleanup logic here
    // For now, we'll just return 0 as cleanup is handled automatically
    console.log('Magic link cleanup: automatic TTL expiration in effect');
  } catch (error) {
    console.error('Error during magic link cleanup:', error);
  }

  return cleanedCount;
}

/**
 * Development helper: get magic link for email (only in development)
 */
export async function getDevMagicLink(env: WorkerEnv, email: string): Promise<string | null> {
  if (env.ENVIRONMENT === 'production') {
    throw new ApiError('Development endpoint not available in production', 'FORBIDDEN', 403);
  }

  try {
    const devEmailData = await env.SESSIONS.get(`dev-email:${email}`);
    if (!devEmailData) {
      return null;
    }

    const data = JSON.parse(devEmailData);
    return data.magicLink;
  } catch (error) {
    console.error('Error retrieving dev magic link:', error);
    return null;
  }
}
