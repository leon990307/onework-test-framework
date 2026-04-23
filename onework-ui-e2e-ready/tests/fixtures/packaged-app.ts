import { Browser, BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type PackagedAppWorkerFixtures = {
  appProcess: ChildProcess;
};

type PackagedAppTestFixtures = {
  browser: Browser;
  context: BrowserContext;
  mainWindow: Page;
};

const CDP_PORT = process.env.PACKAGED_CDP_PORT ?? "9222";
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

/**
 * 查找打包后的 demo exe
 * 默认路径：dist/win-unpacked/OneworkDemo.exe（electron-builder 输出）
 */
function findPackagedExe(): string {
  if (process.env.PACKAGED_EXE_PATH) {
    return process.env.PACKAGED_EXE_PATH;
  }

  const defaultPath = path.resolve(process.cwd(), "dist", "win-unpacked", "OneworkDemo.exe");
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  throw new Error(
    `Packaged exe not found at ${defaultPath}. ` +
      "Run 'npm run build:demo' first, or set PACKAGED_EXE_PATH."
  );
}

async function waitForCdpReady(url: string, timeoutMs: number = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/json`);
      if (response.ok) return;
    } catch {
      // 端口还没开放
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`CDP port not ready after ${timeoutMs}ms: ${url}`);
}

export const test = base.extend<PackagedAppTestFixtures, PackagedAppWorkerFixtures>({
  appProcess: [async ({}, use) => {
    const exePath = findPackagedExe();
    console.log(`Starting packaged app: ${exePath} --remote-debugging-port=${CDP_PORT}`);

    const child = spawn(exePath, [`--remote-debugging-port=${CDP_PORT}`], {
      stdio: "ignore",
      detached: false
    });

    child.on("error", (err) => {
      throw new Error(`Failed to start packaged app: ${err.message}`);
    });

    await waitForCdpReady(CDP_URL);
    console.log(`Packaged app CDP ready at ${CDP_URL}`);

    await use(child);

    if (!child.killed) {
      child.kill();
      await new Promise<void>((resolve) => {
        child.on("exit", () => resolve());
        setTimeout(() => resolve(), 5_000);
      });
    }
  }, { scope: "worker" }],

  browser: async ({ appProcess: _proc }, use) => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    await use(browser);
    await browser.close();
  },

  context: async ({ browser }, use) => {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await use(context);
  },

  mainWindow: async ({ context }, use, testInfo) => {
    let page = context.pages().find((p) => !p.url().startsWith("devtools://"));
    if (!page) {
      page = await context.waitForEvent("page", { timeout: 15_000 });
    }
    await use(page);

    try {
      const buf = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", { body: buf, contentType: "image/png" });
    } catch { /* 忽略 */ }
  }
});

export { expect };
