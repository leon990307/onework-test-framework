import { Page } from "@playwright/test";
import { loginLocators } from "../locators/login.locator";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async fillUsername(username: string): Promise<void> {
    await this.page.getByTestId(loginLocators.usernameInput).fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.page.getByTestId(loginLocators.passwordInput).fill(password);
  }

  async submitLogin(): Promise<void> {
    await this.page.getByRole("button", { name: loginLocators.loginButtonName }).click();
  }
}

