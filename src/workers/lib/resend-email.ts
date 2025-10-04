/**
 * Resend Email Service
 * Handles email delivery using Resend API for the Cultural Archiver project
 */

import type { WorkerEnv } from '../types';

// Define a simpler email interface to avoid React Email dependencies
interface EmailOptions {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send email using Resend API directly
 */
async function sendEmailWithResend(
  apiKey: string,
  emailData: EmailOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: result.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      id: result.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Email template for magic link authentication
 */
export function generateMagicLinkEmailTemplate(
  email: string,
  magicLink: string,
  isSignup: boolean,
  expiresAt: string,
  anonymousSubmissions?: number
): string {
  const subject = isSignup ? 'Welcome to Cultural Archiver' : 'Sign in to Cultural Archiver';
  const welcomeText = isSignup
    ? 'Welcome to Cultural Archiver! Click the link below to verify your email and complete your account setup.'
    : 'Click the link below to sign in to your Cultural Archiver account.';

  const anonymousText =
    anonymousSubmissions && anonymousSubmissions > 0
      ? `<p style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; color: #495057; margin: 20px 0;">
         <strong>Account Claim:</strong> You have ${anonymousSubmissions} anonymous submission${anonymousSubmissions > 1 ? 's' : ''} 
         that will be linked to your account after verification.
       </p>`
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background-color: #2c3e50; padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: normal;">Cultural Archiver</h1>
            <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">Preserving Digital Culture</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px;">${isSignup ? 'Welcome!' : 'Sign In'}</h2>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; color: #555;">
                ${welcomeText}
            </p>
            
            ${anonymousText}
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${magicLink}" 
                   style="background-color: #3498db; color: white; padding: 16px 32px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;
                          font-size: 16px; font-weight: bold; transition: background-color 0.3s;">
                    ${isSignup ? 'Verify Email & Complete Setup' : 'Sign In to Cultural Archiver'}
                </a>
            </div>
            
            <!-- Security Notice -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>Security Notice:</strong> This link will expire on ${expiresAt} for your security.
                    If you didn't request this email, you can safely ignore it.
                </p>
            </div>
            
            <!-- Alternative Link -->
            <p style="font-size: 14px; color: #666; word-break: break-all; line-height: 1.4;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <span style="color: #3498db;">${magicLink}</span>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
            <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                This email was sent to <strong>${email}</strong>
            </p>
            <p style="margin: 0; color: #6c757d; font-size: 12px;">
                Cultural Archiver &copy; ${new Date().getFullYear()} | 
                <a href="https://api.publicartregistry.com" style="color: #3498db; text-decoration: none;">Visit Website</a>
            </p>
        </div>
    </div>
</body>
</html>`.trim();
}

/**
 * Send magic link email using Resend
 */
export async function sendMagicLinkEmailWithResend(
  env: WorkerEnv,
  email: string,
  magicLink: string,
  isSignup: boolean,
  expiresAt: string,
  anonymousSubmissions?: number
): Promise<void> {
  // Check if email is enabled
  if (env.EMAIL_ENABLED !== 'true') {
    console.log('Email sending disabled, logging magic link:', {
      email,
      magicLink,
      isSignup,
      expiresAt,
      anonymousSubmissions,
    });
    return;
  }

  // Check if we have the required Resend API key
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, falling back to console logging');
    console.log('=== DEVELOPMENT: MAGIC LINK EMAIL ===');
    console.log('To:', email);
    console.log('Magic Link:', magicLink);
    console.log('Expires:', expiresAt);
    console.log('Is Signup:', isSignup);
    if (anonymousSubmissions) {
      console.log('Anonymous Submissions:', anonymousSubmissions);
    }
    console.log('====================================');
    return;
  }

  try {
    const subject = isSignup
      ? 'Verify your email - Cultural Archiver'
      : 'Sign in to Cultural Archiver';

    const htmlContent = generateMagicLinkEmailTemplate(
      email,
      magicLink,
      isSignup,
      expiresAt,
      anonymousSubmissions
    );

    const emailData: EmailOptions = {
      from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
      to: [email],
      subject: subject,
      html: htmlContent,
      tags: [
        {
          name: 'category',
          value: 'authentication',
        },
        {
          name: 'type',
          value: isSignup ? 'signup' : 'signin',
        },
      ],
    };

    // Add replyTo only if it's configured
    if (env.EMAIL_REPLY_TO) {
      emailData.replyTo = env.EMAIL_REPLY_TO;
    }

    console.log('Sending email via Resend:', {
      to: email,
      from: emailData.from,
      subject: subject,
      replyTo: env.EMAIL_REPLY_TO,
    });

    const result = await sendEmailWithResend(env.RESEND_API_KEY, emailData);

    if (!result.success) {
      console.error('Resend API Error:', result.error);
      throw new Error(`Resend delivery failed: ${result.error}`);
    }

    console.log('Magic link email sent successfully via Resend:', {
      id: result.id,
      email: email,
      subject: subject,
    });
  } catch (error) {
    console.error('Failed to send email via Resend:', error);

    // Log for development purposes
    console.log('=== EMAIL SEND FAILED - MAGIC LINK INFO ===');
    console.log('To:', email);
    console.log('Magic Link:', magicLink);
    console.log('Expires:', expiresAt);
    console.log('Is Signup:', isSignup);
    if (anonymousSubmissions) {
      console.log('Anonymous Submissions:', anonymousSubmissions);
    }
    console.log('Error:', error);
    console.log('==========================================');

    throw error;
  }
}

/**
 * Send test email to verify Resend configuration
 */
export async function sendTestEmail(
  env: WorkerEnv,
  toEmail: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY not configured',
    };
  }

  if (env.EMAIL_ENABLED !== 'true') {
    return {
      success: false,
      error: 'Email sending is disabled',
    };
  }

  try {
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Test Email - Cultural Archiver</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Cultural Archiver</h1>
        <p style="margin: 10px 0 0 0;">Email Configuration Test</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #dee2e6; border-top: none;">
        <h2 style="color: #2c3e50; margin: 0 0 20px 0;">✅ Email Test Successful!</h2>
        
        <p>If you're receiving this email, your Resend configuration for Cultural Archiver is working correctly.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #2c3e50;">Configuration Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>From:</strong> ${env.EMAIL_FROM_NAME} &lt;${env.EMAIL_FROM_ADDRESS}&gt;</li>
                <li><strong>Domain:</strong> api.publicartregistry.com</li>
                <li><strong>Environment:</strong> ${env.ENVIRONMENT}</li>
                <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This test email was sent to verify the Resend email service integration.
        </p>
    </div>
</body>
</html>`;

    const emailData: EmailOptions = {
      from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`,
      to: [toEmail],
      subject: 'Test Email - Cultural Archiver Configuration',
      html: testHtml,
      tags: [
        {
          name: 'category',
          value: 'test',
        },
      ],
    };

    // Add replyTo only if it's configured
    if (env.EMAIL_REPLY_TO) {
      emailData.replyTo = env.EMAIL_REPLY_TO;
    }

    const result = await sendEmailWithResend(env.RESEND_API_KEY, emailData);

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
