# Onework UI E2E 框架（对标业界实践版）

## 1. 参考依据（不是自定义拍脑袋）

本方案直接对标以下实践：

- Playwright 官方 Best Practices  
  [https://playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)
- Playwright 官方 Fixtures  
  [https://playwright.dev/docs/test-fixtures](https://playwright.dev/docs/test-fixtures)
- Playwright 官方 Page Object Model  
  [https://playwright.dev/docs/pom](https://playwright.dev/docs/pom)
- Playwright 官方 Projects（按 smoke/regression 分组）  
  [https://playwright.dev/docs/test-projects](https://playwright.dev/docs/test-projects)
- Martin Fowler - Page Object（经典模式）  
  [https://martinfowler.com/bliki/PageObject.html](https://martinfowler.com/bliki/PageObject.html)
- Google Testing Blog（E2E 数量要克制，聚焦高价值链路）  
  [https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

---

## 2. 对标后的框架分层

业界共识是：**用 fixture 管环境、用 page 封装页面、用 flow 组合业务、用 assert 管业务语义断言**。

你项目现在已经按这个方向落地了基础骨架：

```text
tests/
  core/
    locators/
      login.locator.ts
    pages/
      login.page.ts
    flows/
      auth.flow.ts
    asserts/
      auth.assert.ts
    fixtures/
      ui.fixture.ts
  e2e/
    smoke/
      login-success.smoke.spec.ts
```

职责边界（按业界建议）：

- `locator`：只放选择器常量。
- `page`：只做页面级原子动作（填、点、读）。
- `flow`：组合多个 page 动作形成业务流程。
- `assert`：封装业务语义断言（例如“已登录成功”）。
- `spec`：仅做编排，不写底层细节。

---

## 3. 运行策略（业界常用）

- `smoke`：提交必跑，数量少、关键路径。
- `regression`：定时或发布前跑，覆盖更广。
- `attach`：排障模式，连接现场进程（非默认 CI）。

当前脚本：

- `npm run test:e2e`：全量
- `npm run test:e2e:smoke`：冒烟
- `npm run test:e2e:attach`：附着已启动进程

---

## 4. 前端协作规范（对标 Playwright + Fowler）

- 关键元素必须有稳定契约（`data-testid` 或稳定 role/name）。
- Page Object 只封装 UI 行为，不直接写断言。
- 断言放在 `assert` 层，避免页面对象职责膨胀。
- 避免 `waitForTimeout`，优先 locator 自动等待和状态等待。

---

## 5. 建议下一步（按业界迁移节奏）

1. 将现有 `login-flow.spec.ts` 迁移到 `smoke` 分层（保留旧版一段时间）。
2. 按同样模式拆分 `task`、`history` 为 locator/page/flow/assert。
3. 在 `playwright.config.ts` 增加 projects（`launch-smoke`、`launch-regression`、`attach-smoke`）。
4. 在 CI 中默认仅跑 smoke，夜间跑 regression。

