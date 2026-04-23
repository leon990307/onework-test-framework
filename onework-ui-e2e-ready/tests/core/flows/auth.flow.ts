import { LoginPage } from "../pages/login.page";

export class AuthFlow {
  constructor(private readonly loginPage: LoginPage) {}

  async loginAs(username: string, password: string): Promise<void> {
    await this.loginPage.fillUsername(username);
    await this.loginPage.fillPassword(password);
    await this.loginPage.submitLogin();
  }
}

