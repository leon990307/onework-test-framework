import { Browser, BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";

type ExistingAppFixtures = {
  browser: Browser;
  context: BrowserContext;
  mainWindow: Page;
};

function resolveCdpUrl(): string {
  if (process.env.EXISTING_ELECTRON_CDP_URL) {
    return process.env.EXISTING_ELECTRON_CDP_URL;
  }

  const port = process.env.EXISTING_ELECTRON_DEBUG_PORT;
  if (port) {
    return `http://127.0.0.1:${port}`;
  }

  throw new Error(
    "Missing EXISTING_ELECTRON_CDP_URL or EXISTING_ELECTRON_DEBUG_PORT. " +
      "Start onework with --remote-debugging-port=9222 and then set EXISTING_ELECTRON_DEBUG_PORT=9222."
  );
}

export const test = base.extend<ExistingAppFixtures>({
  browser: async ({}, use) => {
    const browser = await chromium.connectOverCDP(resolveCdpUrl());
    await use(browser);
    await browser.close();
  },

  context: async ({ browser }, use) => {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await use(context);
  },

  mainWindow: async ({ context }, use, testInfo) => {
    let page = context.pages().find((candidate) => !candidate.url().startsWith("devtools://"));
    if (!page) {
      page = await context.waitForEvent("page", { timeout: 15_000 });
    }

    await use(page);

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", {
        body: screenshotBuffer,
        contentType: "image/png"
      });
    } catch {
      // Ignore screenshot failures to avoid hiding real assertion errors.
    }
  }
});

export { expect };

