/**
 * Playwright test for moderator feedback queue functionality
 * Tests authentication and feedback moderation in ReviewView
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const API_URL = process.env.VITE_API_URL || 'http://localhost:8787';

test.describe('Moderator Feedback Queue', () => {
  let moderatorToken: string;

  test.beforeAll(async ({ request }) => {
    // Get or create a moderator token for testing
    // In dev environment, we should have a way to get a test moderator token
    const response = await request.get(`${API_URL}/api/auth/dev-magic-link`, {
      params: {
        email: 'test-moderator@example.com',
      },
    });

    if (response.ok()) {
      const data = await response.json();
      moderatorToken = data.token || '';
      console.log('Obtained moderator token for testing');
    } else {
      console.warn('Could not obtain moderator token, some tests may fail');
      moderatorToken = '';
    }
  });

  test('should load feedback tab in ReviewView with authentication', async ({ page }) => {
    // Skip if we don't have a moderator token
    if (!moderatorToken) {
      test.skip(true, 'No moderator token available');
      return;
    }

    // Set the moderator token in localStorage
    await page.goto(BASE_URL);
    await page.evaluate(token => {
      localStorage.setItem('userToken', token);
    }, moderatorToken);

    // Navigate to the review page
    await page.goto(`${BASE_URL}/review`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we're on the review page
    await expect(page).toHaveURL(/\/review/);

    // Check that the feedback tab exists
    const feedbackTab = page.locator('button:has-text("User Feedback")');
    await expect(feedbackTab).toBeVisible();

    // Click the feedback tab
    await feedbackTab.click();

    // Wait for the feedback API call
    const feedbackResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/moderation/feedback') && response.request().method() === 'GET'
    );

    // Verify the response is successful (200 or 401 would indicate auth is working)
    const response = await feedbackResponse;
    expect([200, 404]).toContain(response.status()); // 200 = data, 404 = no data

    // Verify no authentication errors are shown
    const errorMessage = page.locator('text=/failed to load feedback.*user token required/i');
    await expect(errorMessage).not.toBeVisible();
  });

  test('should include auth token in feedback API requests', async ({ page }) => {
    if (!moderatorToken) {
      test.skip(true, 'No moderator token available');
      return;
    }

    // Set the token
    await page.goto(BASE_URL);
    await page.evaluate(token => {
      localStorage.setItem('userToken', token);
    }, moderatorToken);

    // Intercept the feedback API call to verify headers
    let requestHeaders: Record<string, string> = {};
    page.on('request', request => {
      if (request.url().includes('/api/moderation/feedback')) {
        requestHeaders = request.headers();
      }
    });

    // Navigate to review page and click feedback tab
    await page.goto(`${BASE_URL}/review`);
    await page.waitForLoadState('networkidle');

    const feedbackTab = page.locator('button:has-text("User Feedback")');
    await feedbackTab.click();

    // Wait a bit for the request to be captured
    await page.waitForTimeout(1000);

    // Verify the X-User-Token header was sent
    expect(requestHeaders['x-user-token']).toBeTruthy();
    expect(requestHeaders['x-user-token']).toBe(moderatorToken);
  });

  test('should show feedback items when available', async ({ page, request }) => {
    if (!moderatorToken) {
      test.skip(true, 'No moderator token available');
      return;
    }

    // First, create a test feedback item
    const testFeedbackData = {
      artwork_id: '00000000-0000-0000-0000-000000000001', // Test artwork ID
      issue_type: 'incorrect_info',
      note: 'Test feedback for Playwright automation',
    };

    const createResponse = await request.post(`${API_URL}/api/feedback`, {
      data: testFeedbackData,
      headers: {
        'X-User-Token': moderatorToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('Create feedback response:', createResponse.status());

    // Now navigate to the review page
    await page.goto(BASE_URL);
    await page.evaluate(token => {
      localStorage.setItem('userToken', token);
    }, moderatorToken);

    await page.goto(`${BASE_URL}/review`);
    await page.waitForLoadState('networkidle');

    // Click feedback tab
    const feedbackTab = page.locator('button:has-text("User Feedback")');
    await feedbackTab.click();

    // Wait for feedback to load
    await page.waitForTimeout(2000);

    // Check if feedback items are displayed (or "No feedback" message)
    const hasFeedback = await page.locator('.feedback-item, .feedback-card').count();
    const noFeedback = await page.locator('text=/no.*feedback/i').count();

    expect(hasFeedback + noFeedback).toBeGreaterThan(0);
  });

  test('should allow moderators to resolve feedback', async ({ page }) => {
    if (!moderatorToken) {
      test.skip(true, 'No moderator token available');
      return;
    }

    await page.goto(BASE_URL);
    await page.evaluate(token => {
      localStorage.setItem('userToken', token);
    }, moderatorToken);

    await page.goto(`${BASE_URL}/review`);
    await page.waitForLoadState('networkidle');

    // Click feedback tab
    const feedbackTab = page.locator('button:has-text("User Feedback")');
    await feedbackTab.click();
    await page.waitForTimeout(1000);

    // Look for a resolve button (if any feedback exists)
    const resolveButton = page.locator('button:has-text("Resolve")').first();
    const resolveExists = await resolveButton.count();

    if (resolveExists > 0) {
      // Click resolve
      await resolveButton.click();

      // Wait for confirmation dialog
      const confirmButton = page.locator('button:has-text("Yes"), button:has-text("Confirm")');
      if ((await confirmButton.count()) > 0) {
        await confirmButton.click();
      }

      // Verify the API call was made
      const reviewResponse = await page.waitForResponse(
        response =>
          response.url().includes('/api/moderation/feedback') &&
          response.url().includes('/review') &&
          response.request().method() === 'POST',
        { timeout: 5000 }
      );

      expect([200, 404]).toContain(reviewResponse.status());
    } else {
      console.log('No feedback items to resolve');
    }
  });

  test('should show appropriate error for non-moderators', async ({ page }) => {
    // Create a regular user token (not moderator)
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      // Generate a random UUID that won't have moderator permissions
      const randomToken = crypto.randomUUID();
      localStorage.setItem('userToken', randomToken);
    });

    // Try to access the review page
    await page.goto(`${BASE_URL}/review`);
    await page.waitForLoadState('networkidle');

    // Should either redirect or show an error
    // The page might redirect to home or show an access denied message
    const currentUrl = page.url();
    const hasError = await page.locator('text=/permission|access denied|unauthorized/i').count();

    expect(currentUrl !== `${BASE_URL}/review` || hasError > 0).toBeTruthy();
  });
});
