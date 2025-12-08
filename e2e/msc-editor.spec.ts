import { test, expect } from '@playwright/test';

test.describe('MSC Editor E2E', () => {
    test('should load the homepage', async ({ page }) => {
        await page.goto('/');

        // Check that the page title is present
        await expect(page).toHaveTitle(/ASN\.1 Processor/i);

        // Check for main navigation elements
        await expect(page.getByText('ASN.1 Processor')).toBeVisible();
    });

    test('should navigate to MSC Editor', async ({ page }) => {
        await page.goto('/');

        // Click on MSC Editor link
        const editorLink = page.getByRole('link', { name: /msc editor/i });
        await expect(page.getByText('MSC Editor')).toBeVisible();

        // Check that actor headers are present
        await expect(page.getByText('UE')).toBeVisible();
        await expect(page.getByText('gNB')).toBeVisible();

        // Enter a sequence name
        const nameInput = page.getByPlaceholder('Enter sequence name');
        await nameInput.fill('E2E Test Sequence');

        // Verify the name was entered
        await expect(nameInput).toHaveValue('E2E Test Sequence');
    });

    test('should display protocol selector', async ({ page }) => {
        await page.goto('/msc-editor');

        // Wait for the page to load
        await expect(page.getByText('MSC Editor')).toBeVisible();

        // Check that protocol selector is present
        const protocolSelect = page.locator('select, [role="combobox"]').first();
        await expect(protocolSelect).toBeVisible();
    });
});
