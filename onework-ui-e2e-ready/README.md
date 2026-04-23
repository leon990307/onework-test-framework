# Onework UI E2E (TypeScript)

这是一套只针对 **UI E2E** 的测试框架（不含 Agent 评测）。

## 技术栈

- `Playwright`
- `TypeScript`
- `Electron`（通过 Playwright `_electron` 启动）

## 目录

```text
onework-ui-e2e/
  .github/workflows/ui-e2e.yml
  tests/
    fixtures/electron-app.ts
    e2e/
      app-launch.spec.ts
      core-flow.spec.ts
      history.spec.ts
  playwright.config.ts
  package.json
```

## 快速开始

1. 安装依赖：

```bash
npm ci
```

2. 直接运行（默认跑内置 demo app）：

```bash
npm run test:e2e
```

3. 如需测试你自己的 Electron 应用，再设置入口：

```bash
# PowerShell
$env:ELECTRON_MAIN_ENTRY="D:\\path\\to\\your\\main.js"
npm run test:e2e
```

4. 如需附着到“已启动”的 onework 进程（不重新拉起）：

```bash
# 先确保 onework 用 remote debugging 端口启动（示例 9222）
# PowerShell
& "C:\path\to\onework.exe" --remote-debugging-port=9222

# 再运行附着模式测试
$env:EXISTING_ELECTRON_DEBUG_PORT="9222"
npm run test:e2e:attach
```

## 注意事项

- 示例中的 `getByTestId("task-input")` 等选择器需要替换成你真实项目中的标识。
- 建议在应用里补充稳定测试属性（例如 `data-testid`），减少 flaky。
- 当前 Electron fixture 会在每条用例结束后附加一张 `result-screenshot` 到 HTML 报告。

## 技术方案文档

- 完整方案见：`docs/ui-e2e-technical-solution.md`
- 对标业界的框架落地版：`docs/ui-e2e-framework-reference-implementation.md`
