# Resend Email Service Setup Guide

This guide covers setting up Resend for transactional email delivery in the Cultural Archiver project, including magic link authentication and notification emails.

## Overview

Resend is the email service provider for the Cultural Archiver, handling:

- Magic link authentication emails
- User notifications
- Administrative alerts
- Moderation notifications

The service is configured to use the domain `art.abluestar.com` for email delivery.

## Prerequisites

- Access to DNS management for `art.abluestar.com`
- Administrative access to create a Resend account
- Cloudflare Workers environment for secret management

## Account Setup

### 1. Create Resend Account

1. Visit [resend.com](https://resend.com) and sign up for an account
2. Choose the appropriate plan based on email volume:
   - **Free tier**: 3,000 emails/month (suitable for MVP testing)
   - **Pro tier**: 50,000 emails/month (recommended for production)
3. Verify your Resend account via email

### 2. Add Domain

1. In the Resend dashboard, navigate to **Domains**
2. Click **Add Domain**
3. Enter your domain: `art.abluestar.com`
4. Select **Sending** as the domain type
5. Click **Add Domain**

### 3. Configure DNS Records

Resend will provide DNS records that need to be added to your domain. Add these records to your DNS provider:

#### SPF Record (TXT)

```dns
Name: art.abluestar.com
Type: TXT
Value: v=spf1 include:_spf.resend.com ~all
```

#### DKIM Records (CNAME)

```dns
Name: resend._domainkey.art.abluestar.com
Type: CNAME
Value: [provided by Resend - unique per domain]

Name: resend2._domainkey.art.abluestar.com
Type: CNAME
Value: [provided by Resend - unique per domain]
```

#### DMARC Record (TXT)

```dns
Name: _dmarc.art.abluestar.com
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@art.abluestar.com
```

### 4. Verify Domain

1. After adding DNS records, return to Resend dashboard
2. Click **Verify** next to your domain
3. Wait for DNS propagation (can take up to 48 hours)
4. Domain status should change to **Verified**

## API Configuration

### 1. Generate API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Choose **Sending access** permission level
4. Set name: `Cultural Archiver Production` (or appropriate environment name)
5. Copy the generated API key (save securely - it won't be shown again)

### 2. Configure Worker Secrets

Set the API key as a Cloudflare Worker secret:

```bash
# For production environment
wrangler secret put RESEND_API_KEY --env production

# For development environment
wrangler secret put RESEND_API_KEY --env development
```

When prompted, paste your Resend API key.

### 3. Environment Variables

Add these variables to your `wrangler.toml`:

```toml
[vars]
# Email configuration
EMAIL_FROM_ADDRESS = "noreply@art.abluestar.com"
EMAIL_FROM_NAME = "Cultural Archiver"
EMAIL_REPLY_TO = "support@art.abluestar.com"

# Feature flags
EMAIL_ENABLED = "true"
```

For different environments:

```toml
[env.development.vars]
EMAIL_FROM_ADDRESS = "dev-noreply@art.abluestar.com"
EMAIL_FROM_NAME = "Cultural Archiver (Dev)"

[env.production.vars]
EMAIL_FROM_ADDRESS = "noreply@art.abluestar.com"
EMAIL_FROM_NAME = "Cultural Archiver"
```

## Email Templates

### Magic Link Authentication

The authentication system sends magic links for user login. Configure the email template:

**Subject**: `Sign in to Cultural Archiver`

**HTML Template**:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sign in to Cultural Archiver</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2c3e50;">Welcome to Cultural Archiver</h1>

      <p>Click the link below to sign in to your account:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a
          href="{{magic_link}}"
          style="background-color: #3498db; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;"
        >
          Sign In to Cultural Archiver
        </a>
      </div>

      <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes for security reasons. If you didn't request this email, you can safely ignore it.</p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

      <p style="color: #999; font-size: 12px;">
        Cultural Archiver - Preserving Digital Culture<br />
        This email was sent to {{user_email}}
      </p>
    </div>
  </body>
</html>
```

### Notification Templates

Additional templates for various notifications:

- **Submission Approved**: Notify users when their submissions are approved
- **Moderation Required**: Alert moderators about pending submissions
- **System Alerts**: Critical system notifications

## Testing Configuration

### 1. Test Email Delivery

Create a test endpoint in your worker to verify email functionality:

```typescript
// Test endpoint - remove in production
app.get('/test-email', async c => {
  const resend = new Resend(c.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: 'test@art.abluestar.com',
      to: 'your-test-email@example.com',
      subject: 'Test Email from Cultural Archiver',
      html: '<p>If you receive this, Resend is configured correctly!</p>',
    });

    return c.json({ success: true, id: result.data?.id });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});
```

### 2. Monitor Delivery

1. Use Resend dashboard to monitor email delivery rates
2. Check bounce and complaint rates
3. Monitor API usage against your plan limits

## Security Considerations

### 1. API Key Security

- Store API keys only in Cloudflare Worker secrets
- Never commit API keys to version control
- Use different API keys for different environments
- Rotate API keys regularly (quarterly recommended)

### 2. Email Security

- Always use HTTPS for magic links
- Implement proper link expiration (15 minutes recommended)
- Validate email addresses before sending
- Rate limit email sending to prevent abuse

### 3. DMARC Policy

Start with `p=quarantine` and monitor reports. After confirming legitimate emails are delivered correctly, consider upgrading to `p=reject` for stronger protection.

## Monitoring and Maintenance

### 1. Email Metrics

Monitor these key metrics in Resend dashboard:

- **Delivery Rate**: Should be > 95%
- **Open Rate**: Typical range 20-30% for transactional emails
- **Bounce Rate**: Should be < 2%
- **Complaint Rate**: Should be < 0.1%

### 2. DNS Monitoring

- Monitor DNS record health monthly
- Set up alerts for DNS changes
- Verify DKIM signatures remain valid

### 3. API Usage

- Monitor API rate limits
- Track email volume trends
- Plan for scaling based on user growth

## Troubleshooting

### Common Issues

**Domain not verifying**:

- Check DNS record syntax
- Verify DNS propagation with tools like `dig` or online DNS checkers
- Wait full 48 hours for global DNS propagation

**High bounce rates**:

- Validate email addresses before sending
- Maintain good sender reputation
- Check for typos in recipient addresses

**Emails going to spam**:

- Ensure all DNS records are properly configured
- Monitor sender reputation
- Use consistent "From" addresses
- Include unsubscribe links where appropriate

### Support

- Resend documentation: [resend.com/docs](https://resend.com/docs)
- Resend support: Available through dashboard chat
- DNS tools: [whatsmydns.net](https://whatsmydns.net) for checking propagation

## Migration Notes

If migrating from another email provider:

1. Set up Resend configuration parallel to existing service
2. Test thoroughly in development environment
3. Update environment variables in staging
4. Perform gradual rollout to production
5. Monitor delivery rates closely during transition
6. Keep old provider active for 24-48 hours as backup

## Cost Considerations

**Free Tier Limits**:

- 3,000 emails/month
- 100 emails/day
- Suitable for MVP and initial testing

**Pro Tier Benefits**:

- 50,000 emails/month
- Dedicated IP option
- Advanced analytics
- Priority support

Plan upgrades based on expected user growth and email volume requirements.
