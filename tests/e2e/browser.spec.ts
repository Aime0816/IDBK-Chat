import { test, expect } from '@playwright/test';
const password = process.env.E2E_PASSWORD;
test.beforeEach(async ({ page }) => {
  test.skip(!password, 'Set E2E_PASSWORD to the demo password and start the seeded app');
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('aime.demo');
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hello, Aime/ })).toBeVisible();
});
test('desktop home, chat persistence and announcements', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: 'test-results/desktop-home.png', fullPage: true });
  await page.locator('.sidebar').getByRole('link', { name: 'Chats', exact: true }).click();
  await page.getByRole('button', { name: /L4 SWD A/ }).click();
  await expect(page.getByRole('heading', { name: 'L4 SWD A' })).toBeVisible();
  const text = 'Browser test ' + Date.now();
  await page.getByLabel('Message', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.preserve').filter({ hasText: text })).toBeVisible();
  await page.reload();
  await expect(page.locator('.preserve').filter({ hasText: text })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop-chat.png', fullPage: true });
  await page.locator('.sidebar').getByRole('link', { name: 'Announcements' }).click();
  await expect(page.getByRole('heading', { name: 'Holiday learning resources' })).toBeVisible();
});
test('mobile navigation and conversation fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile-home.png', fullPage: true });
  await page.locator('.mobile-bottom').getByRole('link', { name: 'Chats', exact: true }).click();
  await page.getByRole('button', { name: /L4 SWD A/ }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile-chat.png', fullPage: true });
  await page.getByRole('button', { name: 'Back to chats' }).click();
  await expect(page.getByRole('heading', { name: 'Chats', exact: true })).toBeVisible();
});
