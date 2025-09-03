# MailChannels Setup Guide

This guide covers setting up MailChannels for email delivery in the Cultural Archiver application.

## Overview

MailChannels is a free email delivery service for Cloudflare Workers that requires proper DNS configuration to authorize sending emails from your domain.

## Current Issue

The application is receiving a `401 Unauthorized` error from MailChannels when trying to send magic link emails. This indicates that the domain `funvill.com` is not properly configured to authorize MailChannels.

## Required DNS Configuration

### 1. SPF Record

Add an SPF record to authorize MailChannels to send emails from your domain:

```dns
Type: TXT
Name: @ (or funvill.com)
Value: v=spf1 a mx include:relay.mailchannels.net ~all
```

**Important**: If you already have an SPF record, you need to modify it to include `include:relay.mailchannels.net`. For example:

```dns
v=spf1 include:_spf.google.com include:relay.mailchannels.net ~all
```

### 2. DKIM Configuration

MailChannels requires DKIM authentication. Add the following DKIM record:

```dns
Type: TXT
Name: mailchannels._domainkey
Value: v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4r8Vd4dWEkVjMkQOW...
```

**Note**: The actual DKIM public key should be obtained from MailChannels documentation or your Cloudflare Worker setup.

### 3. Domain Verification Record (Optional)

For additional security, you can add a domain verification record:

```dns
Type: TXT
Name: _mailchannels
Value: v=mc1 cfid=your-cloudflare-account-id
```

## Verification Steps

1. **Check SPF Record**:

   ```bash
   nslookup -type=txt funvill.com
   ```

2. **Check DKIM Record**:

   ```bash
   nslookup -type=txt mailchannels._domainkey.funvill.com
   ```

3. **Test Email Sending**:
   - After DNS propagation (can take up to 24 hours)
   - Try the account creation flow again

## Alternative Solutions

### Option 1: Use a Different Domain

If you cannot modify DNS records for `funvill.com`, consider using a subdomain that you control:

1. Update the `EMAIL_FROM` environment variable:

   ```toml
   EMAIL_FROM = "Cultural Archiver <noreply@mail.funvill.com>"
   ```

2. Configure DNS records for `mail.funvill.com` instead

### Option 2: Development Mode Only

For development/testing, the application already falls back to console logging when MailChannels fails. The magic links are logged to the console and stored in KV for manual access.

## Current Fallback Behavior

The application currently handles MailChannels failures gracefully:

1. **Tries MailChannels** first for production environment
2. **Falls back to console logging** when MailChannels fails
3. **Stores magic links in KV** for development access
4. **User sees generic error** but the system continues to work

## Testing the Fix

After DNS configuration:

1. **Wait for DNS propagation** (up to 24 hours)
2. **Test account creation** on the production site
3. **Check Cloudflare logs** for successful MailChannels delivery
4. **Verify email delivery** to the target email address

## Monitoring

Monitor email delivery in Cloudflare Workers logs:

```bash
wrangler tail --env production
```

Look for these log messages:

- `Magic link email sent via MailChannels to: {email}` (success)
- `MailChannels API Error:` (failure)

## References

- [MailChannels for Cloudflare Workers](https://support.mailchannels.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API)
- [SPF Record Setup](https://support.mailchannels.com/hc/en-us/articles/200262610-Set-up-SPF-Records)
- [DKIM Configuration](https://support.mailchannels.com/hc/en-us/articles/200148447-What-is-DKIM-)
