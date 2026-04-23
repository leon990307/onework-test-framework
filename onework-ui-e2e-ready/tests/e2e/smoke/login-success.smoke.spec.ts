import { test } from "../../core/fixtures/ui.fixture";

test("登录成功后进入主界面（分层框架示例）@smoke", async ({ authFlow, authAssert }) => {
  await authFlow.loginAs("demo", "123456");
  await authAssert.shouldBeLoggedIn("demo");
});

