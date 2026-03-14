import { expect, test } from '@playwright/test';

test.describe('UI smoke', () => {
  test('login page renders primary auth controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('dashboard route renders core shell and widget controls', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('ShopDeck')).toBeVisible();
    await expect(page.getByRole('button', { name: /^add Add Widget$/i })).toBeVisible();
  });

  test('active deals and drops routes render without route errors', async ({ page }) => {
    await page.goto('/active-deals');
    await expect(page.getByRole('heading', { name: 'Active Deals' })).toBeVisible();

    await page.goto('/drops');
    await expect(page.getByRole('heading', { name: 'New Releases & Drops' })).toBeVisible();
  });
});
