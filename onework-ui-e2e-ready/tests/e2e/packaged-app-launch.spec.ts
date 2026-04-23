import { expect, test } from "../fixtures/packaged-app";

test("打包后的 demo exe 能启动并获取主窗口", async ({ mainWindow }) => {
  await expect(mainWindow).toHaveTitle(/.+/);

  const title = await mainWindow.title();
  console.log(`打包应用启动成功，窗口标题: ${title}`);
});

test("打包后的 demo exe 登录流程正常", async ({ mainWindow }) => {
  // 填写登录信息
  await mainWindow.getByTestId("username-input").fill("demo");
  await mainWindow.getByTestId("password-input").fill("123456");
  await mainWindow.getByRole("button", { name: "登录" }).click();

  // 验证登录成功
  await expect(mainWindow.getByTestId("welcome-text")).toHaveText("欢迎你，demo");
  await expect(mainWindow.getByTestId("task-input")).toBeVisible();
});
