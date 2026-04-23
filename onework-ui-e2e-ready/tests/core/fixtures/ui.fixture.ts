import { expect, test as base } from "../../fixtures/electron-app";
import { AuthAssert } from "../asserts/auth.assert";
import { AuthFlow } from "../flows/auth.flow";
import { LoginPage } from "../pages/login.page";

type UiFixtures = {
  loginPage: LoginPage;
  authFlow: AuthFlow;
  authAssert: AuthAssert;
};

export const test = base.extend<UiFixtures>({
  loginPage: async ({ mainWindow }, use) => {
    await use(new LoginPage(mainWindow));
  },
  authFlow: async ({ loginPage }, use) => {
    await use(new AuthFlow(loginPage));
  },
  authAssert: async ({ mainWindow }, use) => {
    await use(new AuthAssert(mainWindow, expect));
  }
});

export { expect };

