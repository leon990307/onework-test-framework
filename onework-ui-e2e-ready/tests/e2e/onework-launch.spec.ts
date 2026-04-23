import { expect, test } from "../fixtures/onework-app";

test("启动 Onework exe 并成功获取主窗口", async ({ mainWindow }) => {
  // 验证窗口标题不为空（应用成功启动）
  await expect(mainWindow).toHaveTitle(/.+/);

  // 截图记录启动后的界面状态
  const title = await mainWindow.title();
  console.log(`Onework 启动成功，窗口标题: ${title}`);
});
