import { _electron as electron, ElectronApplication, Page, test as base } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type AppFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

const defaultDemoEntry = path.resolve(process.cwd(), "demo-electron-app", "main.js");
const resolvedAppEntry = process.env.ELECTRON_MAIN_ENTRY ?? defaultDemoEntry;
const oneworkInstallRoot = "C:\\Users\\17393\\AppData\\Local\\onework_desktop";
const findDefaultPackagedExecutable = () => {
  const launcherExecutable = path.join(oneworkInstallRoot, "onework.exe");
  if (!fs.existsSync(oneworkInstallRoot)) {
    return launcherExecutable;
  }

  const versionedExecutables = fs
    .readdirSync(oneworkInstallRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("app-"))
    .map((entry) => path.join(oneworkInstallRoot, entry.name, "onework.exe"))
    .filter((exePath) => fs.existsSync(exePath))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

  return versionedExecutables[0] ?? launcherExecutable;
};

const shouldUsePackagedExe =
  process.env.USE_PACKAGED_ELECTRON === "1" || !!process.env.ELECTRON_EXECUTABLE_PATH;
const configuredExecutable = process.env.ELECTRON_EXECUTABLE_PATH ?? findDefaultPackagedExecutable();
const electronExecutable =
  shouldUsePackagedExe && fs.existsSync(configuredExecutable)
    ? configuredExecutable
    : require("electron");
const usePackagedExe = shouldUsePackagedExe && electronExecutable === configuredExecutable;
const e2eUserDataDir = path.resolve(process.cwd(), ".pw-e2e-user-data");
const e2eLocalAppDataDir = path.join(e2eUserDataDir, "LocalAppData");
const e2eRoamingAppDataDir = path.join(e2eUserDataDir, "RoamingAppData");
const e2eDiskCacheDir = path.join(e2eUserDataDir, "DiskCache");

export const test = base.extend<AppFixtures>({
  electronApp: async ({}, use) => {
    fs.mkdirSync(e2eUserDataDir, { recursive: true });
    fs.mkdirSync(e2eLocalAppDataDir, { recursive: true });
    fs.mkdirSync(e2eRoamingAppDataDir, { recursive: true });
    fs.mkdirSync(e2eDiskCacheDir, { recursive: true });

    if (!fs.existsSync(electronExecutable)) {
      throw new Error(
        `Electron executable not found: ${electronExecutable}.`
      );
    }

    if (!usePackagedExe && !fs.existsSync(resolvedAppEntry)) {
      throw new Error(
        `Electron entry not found: ${resolvedAppEntry}. Set ELECTRON_MAIN_ENTRY to your app main file.`
      );
    }

    let app: ElectronApplication;
    try {
      app = await electron.launch({
        executablePath: electronExecutable,
        args: usePackagedExe
          ? [
              `--user-data-dir=${e2eUserDataDir}`,
              `--disk-cache-dir=${e2eDiskCacheDir}`,
              "--disable-gpu-shader-disk-cache"
            ]
          : [
              resolvedAppEntry,
              `--user-data-dir=${e2eUserDataDir}`,
              `--disk-cache-dir=${e2eDiskCacheDir}`,
              "--disable-gpu-shader-disk-cache"
            ],
        env: {
          ...process.env,
          LOCALAPPDATA: e2eLocalAppDataDir,
          APPDATA: e2eRoamingAppDataDir,
          ...(usePackagedExe ? {} : { NODE_ENV: "test" })
        }
      });
    } catch (error) {
      if (usePackagedExe) {
        throw new Error(
          `Packaged app failed to launch via Playwright Electron: ${electronExecutable}. ` +
            "This usually means the production build exits when Playwright injects --inspect/--remote-debugging flags " +
            "(for example, Electron fuses or app startup policy). Build a dedicated E2E package or use an unpackaged app entry.",
          { cause: error }
        );
      }
      throw error;
    }
    await use(app);
    await app.close();
  },

  mainWindow: async ({ electronApp }, use, testInfo) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(page);

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", {
        body: screenshotBuffer,
        contentType: "image/png"
      });
    } catch {
      // Ignore screenshot failures in teardown to avoid masking test results.
    }
  }
});

export { expect } from "@playwright/test";
