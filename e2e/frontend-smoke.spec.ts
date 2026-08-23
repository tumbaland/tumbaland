import { expect, test } from '@playwright/test';
import { apps } from './apps';
import { installApiMocks } from './apiMocks';

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

for (const app of apps) {
  test(`${app.name} boots on its dev server`, async ({ page }) => {
    await page.goto(app.url);

    await expect(page.getByText(app.heading).first()).toBeVisible();
    await expect(page.getByText(/configuration error/i)).toHaveCount(0);
    await expect(page.getByText(/access restricted/i)).toHaveCount(0);
  });
}
