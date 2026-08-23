import { chromium } from '@playwright/test';
import { apps } from './apps';
import { installApiMocks } from './apiMocks';

/**
 * Visit every dev server once before the suite runs.
 *
 * Vite builds each app's module graph on the first request for it, and
 * `npm run dev:front` boots eight servers at once. On a CI runner the very
 * first navigation of the run pays that compile while the other seven servers
 * are still starting and competing for the same cores — enough to blow a
 * per-test timeout, which is why the first test in the file failed while the
 * later ones, hitting warm servers on a settled machine, passed.
 *
 * Paying the cost here leaves each test's timeout for the behaviour it
 * actually asserts. Playwright starts `webServer` before global setup, so the
 * servers are already listening by the time this runs.
 */
async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    // Same stand-ins as the tests use: an app that renders an error instead of
    // its real content compiles a different (smaller) part of its graph.
    await installApiMocks(page);

    for (const app of apps) {
      // Best effort — a warm-up failure is not a test failure. Letting it
      // throw here would replace a clear per-app test failure with an opaque
      // "global setup failed" for the whole suite.
      try {
        await page.goto(app.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await page.getByText(app.heading).first().waitFor({ state: 'visible', timeout: 90_000 });
      } catch {
        // Ignored on purpose; the app's own test will report what is wrong.
      }
    }
  } finally {
    await browser.close();
  }
}

export default globalSetup;
