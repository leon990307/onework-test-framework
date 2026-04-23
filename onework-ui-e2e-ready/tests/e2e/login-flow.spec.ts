import { expect, test } from "../fixtures/electron-app";

test("登录成功后进入应用主界面", async ({ mainWindow }) => {
  const usernameInput = mainWindow.getByTestId("username-input");
  const passwordInput = mainWindow.getByTestId("password-input");
  const loginButton = mainWindow.getByRole("button", { name: "登录" });

  await usernameInput.fill("demo");
  await passwordInput.fill("123456");
  await loginButton.click();

  await expect(mainWindow.getByTestId("welcome-text")).toHaveText("欢迎你，demo");
  await expect(mainWindow.getByTestId("task-input")).toBeVisible();
});

