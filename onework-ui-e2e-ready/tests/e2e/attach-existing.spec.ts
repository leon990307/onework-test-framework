import { expect, test } from "../fixtures/existing-app";

const canAttach =
  !!process.env.EXISTING_ELECTRON_CDP_URL || !!process.env.EXISTING_ELECTRON_DEBUG_PORT;

test.skip(!canAttach, "Set EXISTING_ELECTRON_DEBUG_PORT or EXISTING_ELECTRON_CDP_URL to run attach mode.");

test("附着到已启动的 onework 进程并获取主窗口", async ({ mainWindow }) => {
  await expect(mainWindow).toHaveTitle(/.+/);
});

