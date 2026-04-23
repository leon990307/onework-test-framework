# Agent桌面端自动化测试：工具选型与最小可行闭环

## 1. 主备选框架对比（按架构）

| 架构 | 主框架（建议） | 备选框架 | 适用性 | 风险点 |
|---|---|---|---|---|
| Electron | Playwright (`_electron`) | WebdriverIO Electron Service | 调试体验好，Trace/Video完善 | Electron支持为 experimental，版本升级需回归 |
| Tauri | WebdriverIO + Tauri Driver | Windows下补CDP/Playwright | 跨平台可行，WebDriver生态成熟 | 各平台WebView差异较大 |
| Windows原生 | FlaUI / FlaUI.WebDriver | Appium + WinAppDriver | 原生控件覆盖更强 | 生态碎片化，维护成本高 |

## 2. 默认推荐（基于当前基线）

- 主框架：`Playwright + Electron`
- 备选：`WebdriverIO`（用于少数桌面特性或团队已深度使用WDIO时）
- 语言：`TypeScript`
- 测试运行器：`@playwright/test`

## 3. 最小可行测试闭环（MVP）

目标：在 1 条流水线里验证“应用可启动 + 核心任务可执行 + Agent结果可判定 + 失败可追溯”。

### Step 1：启动与健康检查

- 启动桌面应用（开发模式或测试打包产物）。
- 校验主窗口打开、关键入口元素可见。
- 记录启动耗时（冷启动）。

### Step 2：P0任务执行

- 通过固定测试数据执行 1~2 条关键业务主链路。
- 涉及工具调用时，记录工具调用参数和返回码。

### Step 3：结果断言

- UI层断言：关键状态与结果展示正确。
- 协议层断言：关键接口响应码、字段完整性。
- Agent层断言：结构化结果（JSON）字段、工具调用次数、失败重试次数。

### Step 4：失败诊断产物

- 必产物：trace、screenshot、video、应用日志、测试日志。
- 失败自动归档到统一目录，保留最近 N 次运行。

## 4. 项目目录建议

```text
agent-desktop-testing/
  e2e/
  integration/
  agent-evals/
  fixtures/
  reports/
  docs/
```

## 5. 通过/失败门槛（MVP阶段）

- 冒烟通过率：`100%`（P0用例不允许失败）
- 单次流水线时长：`<= 15 分钟`
- Flaky率（同提交重复3次）：`< 5%`
