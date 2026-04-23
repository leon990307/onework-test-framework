import { Browser, BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** worker 级别 fixture（整个 worker 共享一个 Onework 进程） */
type OneworkWorkerFixtures = {
  oneworkProcess: ChildProcess;
};

/** test 级别 fixture（每条用例独立的 browser/page） */
type OneworkTestFixtures = {
  browser: Browser;
  context: BrowserContext;
  mainWindow: Page;
};

const CDP_PORT = process.env.ONEWORK_CDP_PORT ?? "9222";
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

/**
 * 查找本地安装的 Onework exe 路径
 */
function findOneworkExecutable(): string {
  if (process.env.ONEWORK_EXE_PATH) {
    return process.env.ONEWORK_EXE_PATH;
  }

  const installRoot = path.join(process.env.LOCALAPPDATA || "", "onework_desktop");

  if (!fs.existsSync(installRoot)) {
    throw new Error(
      `Onework install directory not found: ${installRoot}. ` +
        "Set ONEWORK_EXE_PATH to the onework.exe path."
    );
  }

  const versionedExes = fs
    .readdirSync(installRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("app-"))
    .map((entry) => path.join(installRoot, entry.name, "onework.exe"))
    .filter((exePath) => fs.existsSync(exePath))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

  if (versionedExes.length > 0) return versionedExes[0];

  const launcherExe = path.join(installRoot, "onework.exe");
  if (fs.existsSync(launcherExe)) return launcherExe;

  throw new Error(`No onework.exe found in ${installRoot}. Set ONEWORK_EXE_PATH.`);
}

/**
 * 等待 CDP 端口就绪
 */
async function waitForCdpReady(url: string, timeoutMs: number = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/json`);
      if (response.ok) return;
    } catch {
      // 端口还没开放，继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`CDP port not ready after ${timeoutMs}ms: ${url}`);
}

export const test = base.extend<OneworkTestFixtures, OneworkWorkerFixtures>({
  // worker scope：启动 Onework 进程，整个 worker 共享
  oneworkProcess: [async ({}, use) => {
    const exePath = findOneworkExecutable();
    console.log(`Starting Onework: ${exePath} --remote-debugging-port=${CDP_PORT}`);

    const child = spawn(exePath, [`--remote-debugging-port=${CDP_PORT}`], {
      stdio: "ignore",
      detached: false
    });

    child.on("error", (err) => {
      throw new Error(`Failed to start Onework: ${err.message}`);
    });

    await waitForCdpReady(CDP_URL);
    console.log(`Onework CDP ready at ${CDP_URL}`);

    await use(child);

    // teardown：关闭进程
    if (!child.killed) {
      child.kill();
      await new Promise<void>((resolve) => {
        child.on("exit", () => resolve());
        setTimeout(() => resolve(), 5_000);
      });
    }
  }, { scope: "worker" }],

  // test scope：每条用例连接 CDP
  browser: async ({ oneworkProcess: _proc }, use) => {
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
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", {
        body: screenshotBuffer,
        contentType: "image/png"
      });
    } catch {
      // 忽略截图失败
    }
  }
});

export { expect };
