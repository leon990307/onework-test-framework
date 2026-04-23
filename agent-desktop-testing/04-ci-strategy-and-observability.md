# Agent桌面端自动化测试：CI策略与诊断可观测性

## 1. CI分层执行策略

### PR（每次提交）

- 执行：`UI冒烟 + 关键集成 + 快速Agent评测`
- 目标时长：`<= 15 分钟`
- 失败策略：任一 P0 失败即阻断合并

### Nightly（每日）

- 执行：全量集成、全量Agent评测、跨平台子集
- 目标：发现回归漂移、性能波动、环境相关问题

### Release Candidate（发版前）

- 执行：全量P0/P1 + 关键异常流 + 回归基线对比
- 要求：零P0缺陷、Flaky率达标

## 2. 平台矩阵建议

- 第一阶段：`Windows` 单平台
- 第二阶段：`Windows + macOS`
- 第三阶段：`Windows + macOS + Linux`

如果是 Tauri，跨平台阶段必须引入平台差异测试集（WebView行为差异）。

## 3. 失败诊断产物（强制）

每次失败都应自动归档以下产物：

- Playwright/WDIO Trace
- 全程视频（或关键步骤录屏）
- 失败截图（至少失败点前后各1张）
- 桌面应用日志（main/renderer）
- 测试运行日志（步骤级）
- 工具调用日志（入参、出参、耗时、错误码）

## 4. 目录与保留策略

```text
reports/
  <run-id>/
    trace/
    video/
    screenshots/
    app-logs/
    test-logs/
    tool-logs/
```

- PR产物保留：7天
- Nightly产物保留：14天
- RC产物保留：30天

## 5. 稳定性治理机制（Anti-Flaky）

- 统一等待策略（禁止随意 `sleep`）
- 固定测试数据与固定随机种子
- 定位优先级：AccessibilityId > role/text > xpath
- 易抖场景执行 3 次重复，统计波动率
- 网络/依赖异常使用可控 mock 注入

## 6. 质量门禁指标（建议）

- P0 通过率：`100%`
- PR流水线通过率：`>= 95%`
- Flaky率：`< 5%`
- 平均执行时长波动：`< 20%`
- Agent关键评测通过率：`>= 90%`（按业务可调）
