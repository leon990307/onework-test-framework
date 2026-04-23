import { Page, expect } from "@playwright/test";
import { loginLocators } from "../locators/login.locator";

export class AuthAssert {
  constructor(
    private readonly page: Page,
    private readonly expectApi: typeof expect
  ) {}

  async shouldBeLoggedIn(username: string): Promise<void> {
    await this.expectApi(this.page.getByTestId(loginLocators.welcomeText)).toHaveText(
      `欢迎你，${username}`
    );
    await this.expectApi(this.page.getByTestId(loginLocators.taskInput)).toBeVisible();
  }
}

