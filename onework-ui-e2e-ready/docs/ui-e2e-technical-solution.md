# Onework UI E2E 自动化测试技术方案

| 属性 | 值 |
|---|---|
| 文档编号 | ONEWORK-QA-001 |
| 版本 | v4.0 |
| 状态 | 待评审 |
| 作者 | QA Team |
| 更新日期 | 2026-04-23 |
| 评审人 | — |

---

## 目录

1. [背景与问题分析](#1-背景与问题分析)
2. [业界方案调研](#2-业界方案调研)
3. [技术选型与论证](#3-技术选型与论证)
4. [整体架构设计](#4-整体架构设计)
5. [核心子系统详细设计](#5-核心子系统详细设计)
6. [测试策略与用例规范](#6-测试策略与用例规范)
7. [CI/CD 集成方案](#7-cicd-集成方案)
8. [前端协作契约](#8-前端协作契约)
9. [报告与可观测性](#9-报告与可观测性)
10. [里程碑与验收标准](#10-里程碑与验收标准)
11. [风险登记册](#11-风险登记册)
12. [附录](#附录)

---

## 1. 背景与问题分析

### 1.1 产品背景

Onework 是一个基于 **Electron** 的桌面端 AI Agent 应用，主要运行在 Windows 和 macOS 平台，技术栈为 Electron（Chromium 内核）+ Web 前端渲染。用户核心路径为：**启动应用 → 登录 → 输入任务 → Agent 执行 → 查看结果/历史**。

### 1.2 当前质量痛点

| 编号 | 问题 | 影响 | 现状 |
|---|---|---|---|
| P1 | **主流程回归无自动化保障** | 每次前端变更后，"启动→登录→执行任务→查看历史"只能依赖人工验证。人工回归耗时长、覆盖不稳定，无法做到每次提交必验 | 立项前无自动化 E2E 用例；当前已完成登录链路（见第 10 章阶段 0） |
| P2 | **Electron 桌面端自动化缺乏工具链** | Onework 是 Electron 桌面程序，不是浏览器内 Web 应用。传统 Web E2E 工具（Selenium、Cypress）无法启动 Electron 进程、获取渲染窗口控制权 | 已通过 Playwright 解决（见第 5 章） |
| P3 | **现场问题缺乏自动化复现手段** | 用户反馈的问题需要连接到**正在运行中的应用实例**进行调试验证，只能手动操作或远程查看 | 已通过 Attach 模式解决（见 5.2 节） |
| P4 | **测试结果不可追溯** | 手动测试无截图、无操作录像、无失败时的状态快照。问题发生后无法事后追溯 | 已实现截图 + Trace（见第 9 章） |
| P5 | **CI 流水线缺少 UI 验证环节** | CI 仅覆盖构建和 lint，未包含 UI 级别的冒烟验证。UI 回归问题只能在人工测试或线上发现 | 已接入 GitHub Actions（见第 7 章） |

### 1.3 项目目标

| 目标 | 验收标准 |
|---|---|
| **G1 — 自动化覆盖核心路径** | 启动、登录成功/失败、任务执行、历史查看 4 条关键链路有自动化用例 |
| **G2 — 支持 Electron 桌面端驱动** | 能由自动化框架直接启动 Electron 进程，获取渲染窗口的 DOM 控制权 |
| **G3 — 支持附着运行中的应用** | 能通过 CDP 连接已启动的 Onework 实例，执行自动化验证 |
| **G4 — 测试结果可追溯** | 每条用例产出截图；失败时保留 Trace（时间线回放 + DOM 快照） |
| **G5 — CI 集成** | PR 提交自动触发冒烟用例，失败可阻断合并；报告自动归档 |

### 1.4 范围边界

**本方案聚焦 UI E2E 层**，不覆盖：

- 单元测试（应由开发团队独立维护）
- 接口/API 测试（建议独立方案覆盖）
- 性能/压力测试
- 安全测试

用例策略遵循业界共识：E2E 测试成本高、速度慢，应**聚焦最核心的用户路径，数量克制**。

> 参考：[Google Testing Blog - Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)

---

## 2. 业界方案调研

### 2.1 Electron 桌面端 E2E 的核心技术约束

在调研方案之前，需明确 Electron 应用自动化的技术前提：

1. **Electron = Chromium + Node.js**。渲染窗口本质是 Chromium 页面，可通过 **Chrome DevTools Protocol (CDP)** 控制。
2. **CDP 接入有两种方式**：(a) 启动 Electron 时注入 `--remote-debugging-port`，由自动化框架启动并管理进程；(b) 应用自身以调试端口启动后，外部工具连接已有进程。
3. **Electron 需要 Display Server**。在无桌面环境的 Linux CI 上，必须使用 xvfb（X Virtual Framebuffer）提供虚拟显示器。Windows/macOS CI runner 自带桌面环境。

> 参考：[Electron 官方 - Testing on Headless CI](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci)

### 2.2 方案详细对比

#### 方案 A：Spectron

| 维度 | 评估 |
|---|---|
| 简介 | Electron 团队早期官方推荐。基于 WebdriverIO v4 + ChromeDriver 协议 |
| 维护状态 | **2022 年归档废弃**，GitHub 仓库 archived |
| 废弃原因 | ChromeDriver 协议与 Electron/Chromium 版本频繁不兼容（Electron 每 8 周升级 Chromium），导致每次 Electron 升级都可能破坏测试 |
| 结论 | **不可选**。无维护、无社区支持、版本兼容风险极高 |

> 参考：[Electron 官方测试指南](https://www.electronjs.org/docs/latest/tutorial/automated-testing) 已标记 Spectron 为 deprecated

#### 方案 B：WebdriverIO + wdio-electron-service

| 维度 | 评估 |
|---|---|
| 简介 | Spectron 的精神继任者。WebdriverIO 社区维护的 `wdio-electron-service` 插件，通过 WebDriver 协议驱动 Electron |
| 优点 | WebdriverIO 生态成熟；插件持续维护（v9.19+）；支持 macOS/Linux/Windows；v9.19+ 内置 xvfb 自动配置 |
| 缺点 | (1) 需额外插件且版本需与 Electron 对齐 (2) 无内置 Trace 回放能力（需额外集成截图/录屏方案） (3) CDP 附着能力不如 Playwright 原生 (4) fixture/DI 机制不内置 |
| 谁在用 | 从 Spectron 迁移过来的存量项目 |

> 参考：[WebdriverIO Electron Service](https://webdriver.io/docs/wdio-electron-service/) — "Spiritual successor to Spectron (RIP)"

#### 方案 C：Playwright（微软）

| 维度 | 评估 |
|---|---|
| 简介 | 微软开发的自动化测试框架，内置 Electron 实验性支持 |
| 核心能力 | `_electron.launch()` 启动 Electron；`connectOverCDP()` 附着已运行实例；内置 Trace Viewer（时间线 + DOM 快照 + 网络请求回放）；内置 HTML Reporter；`test.extend()` fixture 依赖注入 |
| 生产验证 | **微软 VS Code** — 全球最大的 Electron 应用之一，其 smoke test 使用 Playwright。参考 [VS Code Smoke Test](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md) |
| 官方推荐 | Electron 官方测试指南明确列出 Playwright 作为 E2E 方案 |
| 已知限制 | (1) Electron 支持标注为 **experimental** (2) 若生产包通过 Electron Fuses 禁用 `EnableNodeCliInspectArguments`，`_electron.launch()` 将失败 (3) `connectOverCDP()` 保真度低于原生 Playwright 连接，部分高级功能不可用 |

> 参考：[Playwright Electron API](https://playwright.dev/docs/api/class-electron)；[Electron 官方](https://www.electronjs.org/docs/latest/tutorial/automated-testing)

#### 方案 D：Cypress

| 维度 | 评估 |
|---|---|
| 简介 | 流行的 Web E2E 框架 |
| 问题 | 架构上运行在浏览器内部（in-browser），**无法启动和驱动 Electron 桌面进程**。可用于 Electron 渲染进程中的 component testing，但无法控制 Electron 主进程、启动应用、获取窗口句柄 |
| 结论 | **不适用**于桌面端 Electron E2E |

### 2.3 对比矩阵

| 评估维度 | 权重 | Playwright | WebdriverIO | Spectron | Cypress |
|---|---|---|---|---|---|
| Electron 启动支持 | 必须 | 原生 `_electron.launch()` | 需插件 | 基于 ChromeDriver | **不支持** |
| CDP 附着支持 | 高 | 原生 `connectOverCDP()` | 支持 | 不支持 | 不支持 |
| Trace/回放能力 | 高 | 内置 Trace Viewer | 无内置 | 无 | 仅 Web |
| 报告能力 | 中 | 内置 HTML Reporter | 需配置 | 无 | 仅 Web |
| fixture/DI | 中 | 内置 `test.extend()` | 无内置 | 无 | 无 |
| TypeScript 支持 | 中 | 一等公民 | 支持 | 支持 | 支持 |
| 维护状态 | 必须 | 微软活跃维护 | 社区维护 | **已废弃** | Cypress 公司 |
| 大型项目生产验证 | 高 | VS Code smoke test | 无知名案例 | — | — |
| CI 集成文档 | 中 | 官方 CI 指南完善 | 社区文档 | — | — |

### 2.4 选型结论

**选择 Playwright `@playwright/test`**。

决策理由：

| 编号 | 理由 | 对应问题 |
|---|---|---|
| R1 | **唯一同时原生支持 Launch + Attach 两种模式**——直接覆盖 P2（桌面端驱动）和 P3（现场附着排障） | P2, P3 |
| R2 | **内置 Trace Viewer + HTML Reporter**——直接覆盖 P4（结果可追溯），无需额外集成报告工具 | P4 |
| R3 | **VS Code 已在生产环境验证**——VS Code 是最大 Electron 应用之一，proof of concept 已被验证 | 可行性 |
| R4 | **Electron 官方推荐**——Electron 团队在废弃 Spectron 后，官方文档推荐 Playwright | 长期维护 |
| R5 | **内置 fixture 机制**——`test.extend()` 提供声明式依赖注入，天然支持 setup/teardown 生命周期管理，比自行封装 beforeEach/afterEach 更可靠 | 工程质量 |

已知风险与对策：

| 风险 | 等级 | 对策 |
|---|---|---|
| Electron 支持标注为 experimental | 中 | VS Code 已在生产环境大规模使用，实际稳定性高于标注。持续跟踪 Playwright release notes |
| 生产包 Electron Fuses 可能禁用调试端口 | 高 | 维护 E2E 专用构建（不禁用 `EnableNodeCliInspectArguments`），与生产构建隔离 |
| `connectOverCDP` 保真度低于原生连接 | 低 | 附着模式仅用于排障验证，不承担 CI 回归职责。接受此限制 |

---

## 3. 技术选型与论证

### 3.1 技术栈全景

| 层 | 选型 | 版本 | 选型理由 |
|---|---|---|---|
| 测试框架 | `@playwright/test` | ^1.54.0 | 第 2 节选型结论。原生 Electron 支持 + 内置 Trace + Reporter + fixture |
| 编程语言 | TypeScript | ^5.7.2 | strict 模式保证类型安全；与被测应用技术栈一致，降低维护门槛 |
| 运行时 | Node.js | 20 LTS | LTS 版本保证稳定性；CI 与本地统一 |
| 被测应用运行时 | Electron | ^37.2.6 | Chromium 内核，支持 CDP 协议 |
| CI 平台 | GitHub Actions | — | 代码托管在 GitHub；原生提供 Windows/macOS/Linux 托管 Runner |
| 包管理 | npm | — | 与项目一致 |

### 3.2 关键版本约束

| 约束 | 说明 |
|---|---|
| Playwright 与 Electron 版本 | Playwright 通过 CDP 控制 Chromium，与 Electron 内嵌的 Chromium 版本需兼容。Playwright 每次发布会更新支持的 Chromium 版本范围。升级 Electron 时需验证 Playwright 兼容性 |
| Node.js 版本 | Playwright 1.54+ 要求 Node.js >= 18。使用 Node 20 LTS |
| TypeScript 配置 | `target: ES2022`、`module: CommonJS`、`moduleResolution: Node`。`strict: true` |

---

## 4. 整体架构设计

### 4.1 系统上下文

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        开发者工作流                                    │
│                                                                      │
│   开发者提交代码                                                       │
│       │                                                              │
│       ▼                                                              │
│   GitHub PR ──触发──→ GitHub Actions CI                              │
│                            │                                         │
│                            ▼                                         │
│                 ┌─ E2E 测试执行 ─────────────────────────────────┐   │
│                 │                                                 │   │
│                 │  npm ci → playwright test                       │   │
│                 │       │                                         │   │
│                 │       ▼                                         │   │
│                 │  Playwright 进程                                │   │
│                 │       │                                         │   │
│                 │       │  _electron.launch()                     │   │
│                 │       ▼                                         │   │
│                 │  Electron 进程（被测应用）                        │   │
│                 │       │                                         │   │
│                 │       │  CDP 协议控制渲染窗口                    │   │
│                 │       ▼                                         │   │
│                 │  执行用例 → 截图/Trace → 生成报告                │   │
│                 │                                                 │   │
│                 └─────────────────────────────────────────────────┘   │
│                            │                                         │
│                            ▼                                         │
│                   上传 playwright-report/ + test-results/             │
│                            │                                         │
│                            ▼                                         │
│                   PR 状态检查（通过/失败）                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        排障工作流                                      │
│                                                                      │
│   QA/开发者手动启动 Onework（--remote-debugging-port=9222）           │
│       │                                                              │
│       ▼                                                              │
│   运行附着模式测试                                                     │
│       │                                                              │
│       │  chromium.connectOverCDP("http://127.0.0.1:9222")            │
│       ▼                                                              │
│   连接到运行中的应用 → 执行验证用例 → 输出报告                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 分层架构

```text
┌─────────────────────────────────────────────────────────────────┐
│  spec 层（tests/e2e/）                                           │
│                                                                  │
│  职责：用例编排                                                    │
│  规则：只调 flow、只用 expect 断言、不写选择器、不做页面操作细节     │
│  分组：smoke/（冒烟）、regression/（回归）、attach/（附着验证）      │
└────────────────────────────┬────────────────────────────────────┘
                             │ import
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  fixture 层                                                      │
│                                                                  │
│  tests/fixtures/                                                 │
│    electron-app.ts    Launch 模式：启动 Electron，提供 Page      │
│    existing-app.ts    Attach 模式：CDP 连接，提供 Page           │
│                                                                  │
│  tests/core/fixtures/                                            │
│    ui.fixture.ts      业务 fixture：注入 Page/Flow/Assert 实例   │
│                                                                  │
│  机制：Playwright test.extend() 声明式依赖注入                    │
│  生命周期：Playwright 自动管理 setup → use → teardown             │
└────────────────────────────┬────────────────────────────────────┘
                             │ 实例化
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  flow 层（tests/core/flows/）                                    │
│                                                                  │
│  职责：组合多个 page 动作，表达完整业务流程                         │
│  示例：AuthFlow.loginAs(username, password)                      │
│  规则：只调用 page 方法，不直接引用 locator 常量                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ 调用
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  page 层（tests/core/pages/）                                    │
│                                                                  │
│  职责：单页面原子操作（fill、click、getText）                      │
│  构造：通过构造函数接收 Playwright Page 实例                       │
│  规则：不做跨页面流程，不做断言                                     │
│  参考：Playwright POM 官方模式                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ 引用
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  locator 层（tests/core/locators/）                              │
│                                                                  │
│  职责：存放 data-testid 和 role name 常量                         │
│  规则：不引用 Page 实例，不写任何逻辑                               │
│  价值：选择器变更只改此层，page/flow/spec 不受影响                  │
└─────────────────────────────────────────────────────────────────┘
```

依赖规则：**严格单向**。`spec → fixture → flow → page → locator`。禁止反向调用、禁止跨层调用。

> 分层参考：
> - [Playwright 官方 Page Object Model](https://playwright.dev/docs/pom) — Page 类通过构造函数接收 `Page` 实例
> - [Martin Fowler - Page Object](https://martinfowler.com/bliki/PageObject.html) — "A page object wraps an HTML page with an application-specific API"
> - [Playwright 官方 Fixtures](https://playwright.dev/docs/test-fixtures) — "Fixtures are used to establish the environment for each test"
> - VS Code Smoke Test 采用类似分层：driver 层连接应用，page 层封装 UI 操作，test 层做编排

### 4.3 各层职责边界

| 层 | 文件位置 | 允许 | 禁止 |
|---|---|---|---|
| **spec** | `tests/e2e/**/*.spec.ts` | 调用 flow/assert；使用 `expect` 断言；简单场景可直接使用 mainWindow（见 6.2 规则 2） | 当已有对应 flow/page 封装时，不应绕过直接操作 DOM |
| **fixture** | `tests/fixtures/`、`tests/core/fixtures/` | 启动/连接应用；实例化 page/flow/assert；teardown 截图 | 做业务操作；做断言 |
| **flow** | `tests/core/flows/` | 调用 page 方法组合业务流程 | 直接操作 locator；做断言 |
| **page** | `tests/core/pages/` | 调用 locator 常量；封装单页面原子操作 | 跨页面流程；断言 |
| **locator** | `tests/core/locators/` | 定义 `data-testid` 和 role name 常量 | 引用 Page 实例；写逻辑 |
| **assert** | `tests/core/asserts/` | 封装多步复合断言（仅在被多处复用时提取） | 做页面操作 |

### 4.4 已落地的工程目录

```text
onework-ui-e2e-ready/
├── tests/
│   ├── fixtures/                            # [应用连接层]
│   │   ├── electron-app.ts                  #   Launch 模式 fixture
│   │   └── existing-app.ts                  #   Attach 模式 fixture
│   │
│   ├── core/                                # [业务抽象层]
│   │   ├── fixtures/
│   │   │   └── ui.fixture.ts                #   注入 Page/Flow/Assert 实例
│   │   ├── locators/
│   │   │   └── login.locator.ts             #   登录页选择器常量
│   │   ├── pages/
│   │   │   └── login.page.ts                #   登录页原子操作
│   │   ├── flows/
│   │   │   └── auth.flow.ts                 #   认证业务流程
│   │   └── asserts/
│   │       └── auth.assert.ts               #   认证多步断言
│   │
│   └── e2e/                                 # [用例层]
│       ├── smoke/
│       │   └── login-success.smoke.spec.ts  #   冒烟：登录成功
│       ├── login-flow.spec.ts               #   基础：登录流程
│       └── attach-existing.spec.ts          #   附着模式验证
│
├── demo-electron-app/                       # [演示用被测应用]
│   ├── main.js                              #   Electron 主进程
│   └── renderer/
│       ├── index.html                       #   UI 页面（含 data-testid）
│       └── renderer.js                      #   前端交互逻辑
│
├── .github/workflows/
│   └── ui-e2e.yml                           # [GitHub Actions CI 流水线]
│
├── playwright.config.ts                     # [Playwright 全局配置]
├── package.json
├── tsconfig.json
└── docs/
    └── ui-e2e-technical-solution.md         # 本文档
```

---

## 5. 核心子系统详细设计

### 5.1 启动模式 fixture（`tests/fixtures/electron-app.ts`）

**职责**：启动 Electron 进程，获取主窗口 Page 对象，管理进程生命周期。

**运行原理**：

```text
_electron.launch()
  │  Playwright 内部：
  │  1. 以子进程方式启动 Electron
  │  2. 自动注入 --remote-debugging-port 参数
  │  3. 通过 CDP WebSocket 建立控制通道
  ▼
ElectronApplication 实例
  │
  │  electronApp.firstWindow()
  │  内部：通过 CDP 获取第一个 BrowserWindow 对应的 Page
  ▼
Page 对象（渲染窗口）
  │
  │  page.getByTestId("xxx").fill("value")
  │  内部：CDP 命令 → Chromium 执行 DOM 操作
  ▼
用户界面响应
```

**核心实现**：

```typescript
import { _electron as electron, ElectronApplication, Page, test as base } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type AppFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

// --- 路径与模式解析 ---
const defaultDemoEntry = path.resolve(process.cwd(), "demo-electron-app", "main.js");
const resolvedAppEntry = process.env.ELECTRON_MAIN_ENTRY ?? defaultDemoEntry;

// 打包模式：自动在安装目录中查找最新版本的 exe
// 注：实际路径通过 LOCALAPPDATA 环境变量动态解析，此处为示例
const oneworkInstallRoot = path.join(process.env.LOCALAPPDATA || "", "onework_desktop");
const findDefaultPackagedExecutable = () => {
  const launcherExecutable = path.join(oneworkInstallRoot, "onework.exe");
  if (!fs.existsSync(oneworkInstallRoot)) return launcherExecutable;
  const versionedExecutables = fs
    .readdirSync(oneworkInstallRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("app-"))
    .map((entry) => path.join(oneworkInstallRoot, entry.name, "onework.exe"))
    .filter((exePath) => fs.existsSync(exePath))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
  return versionedExecutables[0] ?? launcherExecutable;
};

const shouldUsePackagedExe =
  process.env.USE_PACKAGED_ELECTRON === "1" || !!process.env.ELECTRON_EXECUTABLE_PATH;
const configuredExecutable = process.env.ELECTRON_EXECUTABLE_PATH ?? findDefaultPackagedExecutable();
const electronExecutable =
  shouldUsePackagedExe && fs.existsSync(configuredExecutable)
    ? configuredExecutable
    : require("electron");
const usePackagedExe = shouldUsePackagedExe && electronExecutable === configuredExecutable;

// --- 数据隔离 ---
const e2eUserDataDir = path.resolve(process.cwd(), ".pw-e2e-user-data");
const e2eLocalAppDataDir = path.join(e2eUserDataDir, "LocalAppData");
const e2eRoamingAppDataDir = path.join(e2eUserDataDir, "RoamingAppData");
const e2eDiskCacheDir = path.join(e2eUserDataDir, "DiskCache");

export const test = base.extend<AppFixtures>({
  electronApp: async ({}, use) => {
    // 创建隔离目录
    fs.mkdirSync(e2eUserDataDir, { recursive: true });
    fs.mkdirSync(e2eLocalAppDataDir, { recursive: true });
    fs.mkdirSync(e2eRoamingAppDataDir, { recursive: true });
    fs.mkdirSync(e2eDiskCacheDir, { recursive: true });

    // 前置校验
    if (!fs.existsSync(electronExecutable)) {
      throw new Error(`Electron executable not found: ${electronExecutable}.`);
    }
    if (!usePackagedExe && !fs.existsSync(resolvedAppEntry)) {
      throw new Error(`Electron entry not found: ${resolvedAppEntry}. Set ELECTRON_MAIN_ENTRY.`);
    }

    // 启动 Electron
    let app: ElectronApplication;
    try {
      app = await electron.launch({
        executablePath: electronExecutable,
        args: usePackagedExe
          ? [`--user-data-dir=${e2eUserDataDir}`, `--disk-cache-dir=${e2eDiskCacheDir}`,
             "--disable-gpu-shader-disk-cache"]
          : [resolvedAppEntry, `--user-data-dir=${e2eUserDataDir}`,
             `--disk-cache-dir=${e2eDiskCacheDir}`, "--disable-gpu-shader-disk-cache"],
        env: {
          ...process.env,
          LOCALAPPDATA: e2eLocalAppDataDir,
          APPDATA: e2eRoamingAppDataDir,
          ...(usePackagedExe ? {} : { NODE_ENV: "test" })
        }
      });
    } catch (error) {
      if (usePackagedExe) {
        throw new Error(
          `Packaged app failed to launch: ${electronExecutable}. ` +
          "This usually means the production build exits when Playwright injects " +
          "--inspect/--remote-debugging flags (Electron Fuses). " +
          "Build a dedicated E2E package or use an unpackaged app entry.",
          { cause: error }
        );
      }
      throw error;
    }

    await use(app);
    await app.close();
  },

  mainWindow: async ({ electronApp }, use, testInfo) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(page);

    // teardown：截图附加到报告
    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", {
        body: screenshotBuffer,
        contentType: "image/png"
      });
    } catch {
      // 忽略截图失败，避免掩盖真实测试错误
    }
  }
});

export { expect } from "@playwright/test";
```

**设计决策清单**：

| 决策 | 理由 | 业界参考 |
|---|---|---|
| 隔离 `user-data-dir` | 避免测试读写真实用户数据，保证可重复性 | VS Code smoke test、cmux E2E 均采用独立数据目录 |
| 重定向 `LOCALAPPDATA` / `APPDATA` | Windows 上 Electron 通过这些环境变量定位缓存，不隔离会污染系统目录 | Electron 文档 |
| `--disable-gpu-shader-disk-cache` | GPU shader 缓存写入系统目录可能在 CI 上遇到权限冲突 | Electron CI 常见配置 |
| 自动查找最新版 exe | 打包模式下 Squirrel 安装器会创建 `app-x.y.z/` 版本目录，自动取最新避免硬编码版本号 | Electron Squirrel 安装结构 |
| teardown 截图 try/catch | 应用崩溃时 `page.screenshot()` 会抛异常，teardown 异常不能掩盖真实的测试失败 | Playwright fixture 标准做法 |
| 打包模式专属错误提示 | 生产包可能因 Electron Fuses 禁用调试注入而启动失败，给出明确排查方向 | [Playwright Electron 文档](https://playwright.dev/docs/api/class-electron) |

### 5.2 附着模式 fixture（`tests/fixtures/existing-app.ts`）

**职责**：通过 CDP 连接已运行的 Electron 实例，定位主窗口。

**运行原理**：

```text
被测 Onework 进程（以 --remote-debugging-port=9222 启动）
    │
    │  chromium.connectOverCDP("http://127.0.0.1:9222")
    │  内部：连接到已有的 CDP WebSocket
    ▼
Browser 对象
    │  browser.contexts()[0].pages()
    │  内部：枚举已有的 BrowserContext 和 Page
    ▼
Page 对象（排除 devtools:// 页面后的主窗口）
```

**核心实现**：

```typescript
import { Browser, BrowserContext, Page, chromium, expect, test as base } from "@playwright/test";

type ExistingAppFixtures = {
  browser: Browser;
  context: BrowserContext;
  mainWindow: Page;
};

function resolveCdpUrl(): string {
  if (process.env.EXISTING_ELECTRON_CDP_URL) {
    return process.env.EXISTING_ELECTRON_CDP_URL;
  }
  const port = process.env.EXISTING_ELECTRON_DEBUG_PORT;
  if (port) {
    return `http://127.0.0.1:${port}`;
  }
  throw new Error(
    "Missing EXISTING_ELECTRON_CDP_URL or EXISTING_ELECTRON_DEBUG_PORT. " +
      "Start onework with --remote-debugging-port=9222 and then set EXISTING_ELECTRON_DEBUG_PORT=9222."
  );
}

export const test = base.extend<ExistingAppFixtures>({
  browser: async ({}, use) => {
    const browser = await chromium.connectOverCDP(resolveCdpUrl());
    await use(browser);
    await browser.close();
  },

  context: async ({ browser }, use) => {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    await use(context);
  },

  mainWindow: async ({ context }, use, testInfo) => {
    let page = context.pages().find((candidate) => !candidate.url().startsWith("devtools://"));
    if (!page) {
      page = await context.waitForEvent("page", { timeout: 15_000 });
    }
    await use(page);

    try {
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      await testInfo.attach("result-screenshot", {
        body: screenshotBuffer,
        contentType: "image/png"
      });
    } catch {
      // 忽略截图失败
    }
  }
});

export { expect };
```

**使用流程**：

```bash
# 步骤 1：以调试模式启动 Onework
onework.exe --remote-debugging-port=9222

# 步骤 2：运行附着模式测试
EXISTING_ELECTRON_DEBUG_PORT=9222 npm run test:e2e:attach
```

**附着模式约束**：

| 约束 | 说明 |
|---|---|
| 共享进程 | 用例间共享同一 Electron 进程，无法自动隔离状态 |
| 只读建议 | 建议附着模式用例只做只读验证（检查标题、元素可见性），不做状态修改 |
| CDP 保真度 | `connectOverCDP` 保真度低于原生 Playwright 连接，视频录制等高级功能不可用 |
| Fuses 限制 | 若生产包禁用了 `--remote-debugging-port`，需提供 E2E 专用构建 |

### 5.3 业务抽象层（Page Object Model）

#### 5.3.1 Locator 层

```typescript
// tests/core/locators/login.locator.ts
export const loginLocators = {
  usernameInput:   "username-input",     // data-testid
  passwordInput:   "password-input",     // data-testid
  welcomeText:     "welcome-text",       // data-testid
  taskInput:       "task-input",         // data-testid
  loginButtonName: "登录"                // aria-label，供 getByRole 使用
} as const;
```

#### 5.3.2 Page 层

```typescript
// tests/core/pages/login.page.ts
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
```

#### 5.3.3 Flow 层

```typescript
// tests/core/flows/auth.flow.ts
import { LoginPage } from "../pages/login.page";

export class AuthFlow {
  constructor(private readonly loginPage: LoginPage) {}

  async loginAs(username: string, password: string): Promise<void> {
    await this.loginPage.fillUsername(username);
    await this.loginPage.fillPassword(password);
    await this.loginPage.submitLogin();
  }
}
```

#### 5.3.4 Assert 层

仅在多步断言被多个 spec 复用时才提取。简单的单行 `expect` 直接写在 spec 中。

```typescript
// tests/core/asserts/auth.assert.ts
import { Page, expect } from "@playwright/test";
import { loginLocators } from "../locators/login.locator";

export class AuthAssert {
  constructor(
    private readonly page: Page,
    private readonly expectApi: typeof expect
  ) {}

  async shouldBeLoggedIn(username: string): Promise<void> {
    await this.expectApi(
      this.page.getByTestId(loginLocators.welcomeText)
    ).toHaveText(`欢迎你，${username}`);
    await this.expectApi(
      this.page.getByTestId(loginLocators.taskInput)
    ).toBeVisible();
  }
}
```

#### 5.3.5 Fixture 注入

```typescript
// tests/core/fixtures/ui.fixture.ts
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
```

**fixture 依赖链**：

```text
electronApp → mainWindow(Page) → loginPage(LoginPage) → authFlow(AuthFlow)
                                                       → authAssert(AuthAssert)
```

Playwright 自动管理依赖顺序和 setup/teardown 生命周期。fixture 按需实例化——如果用例没有解构 `authAssert`，则不会创建 `AuthAssert` 实例。

### 5.4 Playwright 全局配置

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    screenshot: "off",
    video: "off",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000
  },
  outputDir: "test-results"
});
```

**配置决策说明**：

| 配置 | 值 | 理由 |
|---|---|---|
| `workers: 1` | 串行 | Electron 进程单实例限制：多个 `_electron.launch()` 并行会争抢 `user-data-dir`。[Playwright CI 文档](https://playwright.dev/docs/ci)也建议 CI 使用 `workers: 1` |
| `timeout: 60_000` | 60 秒 | Electron 启动（含渲染）较慢，需要比 Web 测试更长的超时 |
| `retries: isCI ? 1 : 0` | CI 重试 1 次 | CI 环境可能有短暂资源争抢导致 flaky；本地不重试便于快速定位 |
| `trace: "retain-on-failure"` | 仅失败保留 | trace 文件约 5-10MB，全量保留浪费 CI 存储 |
| `screenshot: "off"` | 关闭自动截图 | 由 fixture teardown 统一截图，格式和命名可控。避免与自动截图重复 |

---

## 6. 测试策略与用例规范

### 6.1 测试分级

| 级别 | 目录 | 触发时机 | 目标 | 时间要求 |
|---|---|---|---|---|
| **Smoke** | `tests/e2e/smoke/` | PR 提交、合并前 | 核心路径冒烟验证（3-5 条用例） | < 3 分钟（含 Electron 启动开销） |
| **Regression** | `tests/e2e/` 全量 | 每晚定时、发版前 | 全流程覆盖（目标 10-20 条用例） | < 10 分钟 |
| **Attach** | `tests/e2e/attach-*` | 手动触发 | 连接运行中的应用做现场排障验证 | 按需 |

### 6.2 用例编写规范

> 参考：[Playwright Best Practices](https://playwright.dev/docs/best-practices) — "Test user-visible behavior."

**规则 1：用例只做编排**

```typescript
// 推荐：使用分层 fixture
test("登录成功后进入主界面 @smoke", async ({ authFlow, authAssert }) => {
  await authFlow.loginAs("demo", "123456");
  await authAssert.shouldBeLoggedIn("demo");
});
```

**规则 2：简单场景可直接使用底层 fixture**

```typescript
// 适用于简单验证，无需经过 flow/assert 层
test("登录成功后进入应用主界面", async ({ mainWindow }) => {
  await mainWindow.getByTestId("username-input").fill("demo");
  await mainWindow.getByTestId("password-input").fill("123456");
  await mainWindow.getByRole("button", { name: "登录" }).click();

  await expect(mainWindow.getByTestId("welcome-text")).toHaveText("欢迎你，demo");
  await expect(mainWindow.getByTestId("task-input")).toBeVisible();
});
```

**规则 3：等待策略**

| 做法 | 说明 | 来源 |
|---|---|---|
| 使用 locator 自动等待 | `getByTestId("x").fill("v")` 自动等待元素可交互 | Playwright 内置 |
| 使用 `expect` 自动重试 | `expect(locator).toHaveText("x")` 在 timeout 内持续重试 | Playwright 内置 |
| **禁止 `waitForTimeout`** | 硬等待是 flaky 测试的根源 | [Playwright Best Practices](https://playwright.dev/docs/best-practices)；[VS Code Smoke Test](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md) — "Hope is your worst enemy in UI tests" |

**规则 4：用例间隔离**

| 机制 | Launch 模式 | Attach 模式 |
|---|---|---|
| 进程 | 每条用例启动新 Electron 进程，teardown 时 `app.close()` | 共享同一进程，无自动隔离 |
| 数据 | 独立 `user-data-dir` | 共享应用数据 |
| 登录态 | 每条用例自行登录，不依赖前序用例状态 | 依赖应用当前状态 |
| 崩溃恢复 | fixture teardown 捕获异常并忽略，下条用例重新启动新进程 | 无自动恢复 |

### 6.3 新增业务模块的标准流程

以新增"任务执行"模块为例（5 步）：

| 步骤 | 产出文件 | 内容 |
|---|---|---|
| 1 | `core/locators/task.locator.ts` | `taskInput`、`taskResult` 等 testid 常量 |
| 2 | `core/pages/task.page.ts` | `TaskPage` 类：`fillTask()`、`submitTask()` |
| 3 | `core/flows/task.flow.ts` | `TaskFlow` 类：`executeTask()` 组合 Page 动作 |
| 4 | `core/fixtures/ui.fixture.ts` | 注册 `taskPage`、`taskFlow` fixture |
| 5 | `e2e/smoke/task-execute.smoke.spec.ts` | 用例：登录 → 执行任务 → 断言结果 |

### 6.4 命名规范

| 类别 | 规则 | 示例 |
|---|---|---|
| 业务抽象文件 | `<domain>.<layer>.ts` | `login.page.ts`、`auth.flow.ts`、`auth.assert.ts` |
| 选择器文件 | `<domain>.locator.ts` | `login.locator.ts`、`task.locator.ts` |
| 用例文件 | `<场景描述>.<级别?>.spec.ts` | `login-success.smoke.spec.ts` |
| data-testid | `<domain>-<element>[-<state>]` | `username-input`、`task-result` |
| Page 类 | `<Domain>Page` | `LoginPage`、`TaskPage` |
| Flow 类 | `<Domain>Flow` | `AuthFlow`、`TaskFlow` |
| Assert 类 | `<Domain>Assert` | `AuthAssert`（仅多步复合断言） |

---

## 7. CI/CD 集成方案（GitHub Actions）

> 参考：[Playwright CI 文档](https://playwright.dev/docs/ci)、[GitHub Actions 文档](https://docs.github.com/en/actions)、[Electron Headless CI](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci)

### 7.1 Electron 在 CI 上的核心技术约束

Electron 基于 Chromium，**必须有 Display Server 才能启动渲染窗口**。这决定了不同平台的 CI 方案差异：

| GitHub 托管 Runner | 桌面环境 | 是否需要额外配置 | 说明 |
|---|---|---|---|
| **`windows-latest`** | **有** | **不需要** | Electron 直接启动，零配置 |
| **`macos-latest`** | **有** | **不需要** | Electron 直接启动，零配置 |
| `ubuntu-latest` | **没有** | 需要 xvfb | 必须用 `xvfb-run` 提供虚拟显示器 |

> Electron 官方："Being based on Chromium, Electron requires a display driver to function."（[来源](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci)）

**结论**：GitHub Actions 原生提供 Windows/macOS/Linux 三平台托管 Runner，无需自建机器。Windows 和 macOS Runner 自带桌面环境，**Electron 零配置直接启动**。

### 7.2 整体 CI 架构

```text
┌──────────────────────────────────────────────────────┐
│                  GitHub Actions                       │
│                                                       │
│  git push / PR 创建 / 定时 cron / 手动触发            │
│       │                                               │
│       ▼                                               │
│  .github/workflows/ui-e2e.yml 被激活                  │
│       │                                               │
│       │  strategy.matrix 并行分发                      │
│       ├────────────────┬──────────────────┐           │
│       ▼                ▼                  ▼           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐     │
│  │ Windows  │  │    macOS     │  │   Linux    │     │
│  │ -latest  │  │   -latest    │  │  -latest   │     │
│  │          │  │              │  │ + xvfb-run │     │
│  │ Electron │  │  Electron    │  │ Electron   │     │
│  │ 直接启动  │  │  直接启动    │  │ 虚拟显示器  │     │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘     │
│       │                │                │             │
│       └────────────────┼────────────────┘             │
│                        ▼                              │
│           upload-artifact 上传报告                     │
│           playwright-report/ + test-results/          │
│                        │                              │
│                        ▼                              │
│           PR 状态检查（✅ 通过 / ❌ 失败）             │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**GitHub Actions 的核心优势**：三平台托管 Runner **开箱即用**，无需自建机器。通过 `strategy.matrix` 一行配置即可并行跑 Windows + macOS + Linux。

### 7.3 Windows 单平台 Workflow（当前已落地）

文件位置：`.github/workflows/ui-e2e.yml`

**当前实际配置**：

```yaml
name: UI E2E

on:
  pull_request:
  workflow_dispatch:

jobs:
  ui-e2e:
    runs-on: windows-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        working-directory: onework-ui-e2e
        run: npm ci

      - name: Run UI E2E
        working-directory: onework-ui-e2e
        env:
          ELECTRON_MAIN_ENTRY: demo-electron-app/main.js
        run: npm run test:e2e:ci

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ui-e2e-artifacts
          path: |
            onework-ui-e2e/playwright-report
            onework-ui-e2e/test-results
```

> **说明**：当前项目代码在仓库的 `onework-ui-e2e` 子目录中，因此 step 中使用了 `working-directory`。如果项目在仓库根目录，可去掉 `working-directory`。

**推荐优化**（后续迭代可加入）：

- `cache: "npm"`：自动缓存 `node_modules`，加速后续构建
- `retention-days: 30`：报告保留 30 天（默认 90 天）
- `CI: "true"` 环境变量：GitHub Actions 自动设置，无需手动加

### 7.4 双平台并行 Workflow（Windows + macOS）

当 Onework 同时发布 Windows 和 macOS 版本时，用 `strategy.matrix` 并行跑：

```yaml
name: UI E2E (Multi-Platform)

on:
  pull_request:
  schedule:
    - cron: "30 17 * * *"    # 每天 UTC 17:30（北京时间 01:30）跑 regression
  workflow_dispatch:

jobs:
  e2e:
    strategy:
      fail-fast: false       # 一个平台失败不影响另一个继续跑
      matrix:
        os: [windows-latest, macos-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        env:
          CI: "true"
          ELECTRON_MAIN_ENTRY: demo-electron-app/main.js
        run: npm run test:e2e:ci
        # Windows 和 macOS Runner 都有桌面环境
        # Electron 直接启动，两个平台都不需要 xvfb

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-report-${{ matrix.os }}
          path: |
            playwright-report
            test-results
          retention-days: 30
```

**matrix 执行效果**：GitHub 自动创建两个并行 Job：
- `e2e (windows-latest)` — 在 Windows Runner 上执行
- `e2e (macos-latest)` — 在 macOS Runner 上执行

两个 Job 同时开始，互不影响。任一失败会在 PR 上显示 ❌。

### 7.5 三平台完整 Workflow（Windows + macOS + Linux）

如需加入 Linux 平台验证（跨平台兼容性测试），Linux 需要 `xvfb-run`：

```yaml
name: UI E2E (All Platforms)

on:
  pull_request:
  schedule:
    - cron: "30 17 * * *"
  workflow_dispatch:

jobs:
  e2e:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            e2e-cmd: npm run test:e2e:ci
          - os: macos-latest
            e2e-cmd: npm run test:e2e:ci
          - os: ubuntu-latest
            e2e-cmd: xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" npm run test:e2e:ci

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci

      # Linux 需要安装 xvfb
      - name: Install xvfb (Linux only)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y xvfb

      - name: Run E2E tests
        env:
          CI: "true"
          ELECTRON_MAIN_ENTRY: demo-electron-app/main.js
        run: ${{ matrix.e2e-cmd }}

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-report-${{ matrix.os }}
          path: |
            playwright-report
            test-results
```

### 7.6 各平台注意事项

| 平台 | Runner | 桌面环境 | xvfb | 特殊注意 |
|---|---|---|---|---|
| **Windows** | `windows-latest` | 有（Windows Server 2022） | 不需要 | 路径分隔符用 `/`（Node.js 兼容）；环境变量用 `$env:` 或跨平台写法 |
| **macOS** | `macos-latest` | 有（Sonoma, Apple Silicon M1） | 不需要 | `macos-latest` 已迁移到 M1 芯片；Electron arm64/x64 需匹配 |
| **Linux** | `ubuntu-latest` | 没有 | `xvfb-run` 必须 | 需安装 `xvfb`；中文字体可能缺失（安装 `fonts-noto-cjk`） |

### 7.7 报告与产物管理

GitHub Actions 使用 `actions/upload-artifact` 管理 CI 产物：

| 特性 | 说明 |
|---|---|
| 上传方式 | `uses: actions/upload-artifact@v4` |
| 查看位置 | PR 页面 → Checks → Summary → Artifacts 区域 |
| 下载方式 | 点击 Artifact 名称直接下载 zip |
| 默认保留 | 90 天（可通过 `retention-days` 自定义） |
| 跨 Job 共享 | 用 `actions/download-artifact` 在下游 Job 中获取上游产物 |

### 7.8 质量门禁策略

| 触发时机 | 执行范围 | 平台 | 门禁策略 | 产物 |
|---|---|---|---|---|
| PR 创建/更新 | smoke 用例 | Windows（必须）+ macOS（可选） | **必须通过**，配置为 Required Status Check 阻断合并 | GitHub Artifact |
| 主分支 push | 全量 regression | Windows + macOS | 失败告警（不阻断） | GitHub Artifact |
| 每晚定时（cron） | 全量 regression | 三平台 | 失败通知（Slack/飞书 webhook） | GitHub Artifact |
| 手动触发 | 按需 | 按需选择 | 无门禁 | GitHub Artifact |

**设置 Required Status Check**（阻断合并）：

1. GitHub 仓库 → Settings → Branches → Branch protection rules
2. 勾选 "Require status checks to pass before merging"
3. 搜索并选择 `e2e (windows-latest)` 作为必须通过的 Check

### 7.9 GitHub Actions vs 自建 Runner

| 维度 | GitHub 托管 Runner | self-hosted Runner |
|---|---|---|
| 机器管理 | **零运维**，GitHub 提供 | 自行维护 |
| 三平台支持 | Windows/macOS/Linux **原生提供** | 需自行准备对应 OS 机器 |
| 配置复杂度 | `runs-on: windows-latest` 一行 | 安装 Runner agent + 注册 |
| 费用（公开仓库） | **完全免费** | 机器费用自负 |
| 费用（私有仓库） | 2000 分钟/月免费（Linux），Windows 2x，macOS 10x | 机器费用自负，Actions 分钟数不计 |
| 适用场景 | 绝大多数项目 | 需特殊环境（GPU、特定硬件）或超出免费额度 |

> 对于 Onework 项目：优先使用 GitHub 托管 Runner。只有当私有仓库 macOS 分钟数不够用时，才考虑 self-hosted macOS Runner。

### 7.10 运行脚本

| 命令 | 实际执行 | 用途 |
|---|---|---|
| `npm run test:e2e` | `playwright test` | 全量执行 |
| `npm run test:e2e:smoke` | `playwright test tests/e2e/smoke` | 冒烟回归 |
| `npm run test:e2e:attach` | `playwright test tests/e2e/attach-existing.spec.ts` | 附着模式 |
| `npm run test:e2e:headed` | `playwright test --headed` | 有头调试（可见 UI） |
| `npm run test:e2e:ci` | `playwright test --reporter=line,html` | CI 执行 |
| `npm run report:open` | `playwright show-report` | 打开 HTML 报告 |

---

## 8. 前端协作契约（前端开发者必读）

本章是前端开发者需要配合 E2E 自动化测试的**完整 checklist**。请逐项对照落实。

### 8.1 任务总览

| 编号 | 任务 | 优先级 | 工作量估计 |
|---|---|---|---|
| F1 | 开放 CDP 调试端口（`--remote-debugging-port`） | **必须** | 0.5 天 |
| F2 | 维护 E2E 专用构建配置（Electron Fuses） | **必须** | 0.5 天 |
| F3 | 为关键元素添加 `data-testid` | **必须** | 1-2 天 |
| F4 | 提供可观测的业务状态标识 | **必须** | 随 F3 同步 |
| F5 | 实现 E2E 环境开关 | 建议 | 0.5 天 |
| F6 | 建立 testid 变更协作流程 | 建议 | 0.5 天 |

---

### 8.2 F1：开放 CDP 调试端口

**为什么需要**：E2E 测试框架（Playwright）通过 Chrome DevTools Protocol (CDP) 控制 Electron 渲染窗口。附着模式需要应用主动开放 CDP 端口，启动模式需要 Playwright 能注入调试参数。

**具体做法**：在 Electron 主进程（`main.js` 或 `main.ts`）中，根据环境变量有条件地开启调试端口：

```javascript
// main.js / main.ts
const { app } = require("electron");

// 方式 1（推荐）：通过环境变量控制，仅在 E2E 模式下开启
if (process.env.E2E_AUTOMATION === "1") {
  const debugPort = process.env.E2E_DEBUG_PORT || "9222";
  app.commandLine.appendSwitch("remote-debugging-port", debugPort);
}

// 方式 2（备选）：解析命令行参数
// 这种方式允许外部通过 --remote-debugging-port=9222 传参
// Chromium 原生支持此参数，Electron 不会阻止它
// 无需额外代码，但需要确保启动脚本传递了此参数
```

> **技术说明**：`--remote-debugging-port` 是 Chromium 层面的参数，**不受 Electron Fuses 的 `EnableNodeCliInspectArguments` 控制**。即使生产包禁用了 `--inspect`，`--remote-debugging-port` 仍然可用。参考 [Electron Fuses 文档](https://www.electronjs.org/docs/latest/tutorial/fuses)。

**验证方法**：

```bash
# 启动应用（开启调试端口）
E2E_AUTOMATION=1 E2E_DEBUG_PORT=9222 ./onework.exe
# 或
./onework.exe --remote-debugging-port=9222

# 验证端口是否开放（在浏览器中访问）
# 打开 Chrome，访问 http://127.0.0.1:9222/json
# 应返回 JSON 数组，包含当前打开的页面信息
```

**安全注意**：
- 调试端口**仅在 E2E/开发环境下开启**，生产环境默认关闭。
- 通过环境变量 `E2E_AUTOMATION=1` 控制，不会影响普通用户。
- 调试端口仅监听 `127.0.0.1`（本地回环），不会暴露到网络。

---

### 8.3 F2：E2E 专用构建配置（Electron Fuses）

**为什么需要**：Playwright 的 `_electron.launch()` 内部会向 Electron 进程注入 `--inspect` 类参数。如果生产包通过 [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses) 禁用了 `EnableNodeCliInspectArguments`，Playwright 将无法启动应用。

**具体做法**：维护两套构建配置——生产构建和 E2E 构建。

**生产构建**（安全优先，正常发布）：

```javascript
// electron-builder 配置
{
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,     // 生产包禁用
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  }
}
```

**E2E 构建**（测试专用，允许调试注入）：

```javascript
// electron-builder.e2e.config.js
{
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: true,      // E2E 包必须开启！
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  }
}
```

**在 `package.json` 中添加构建脚本**：

```json
{
  "scripts": {
    "build": "electron-builder --config electron-builder.config.js",
    "build:e2e": "electron-builder --config electron-builder.e2e.config.js"
  }
}
```

**如果使用 `afterPack` hook**：

```javascript
// afterPack.e2e.js
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const path = require("path");

module.exports = async function afterPack(context) {
  const ext = { darwin: ".app", win32: ".exe" }[context.electronPlatformName];
  const electronBinaryPath = path.join(
    context.appOutDir,
    context.packager.appInfo.productFilename + ext
  );
  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.EnableNodeCliInspectArguments]: true,  // E2E 必须 true
  });
};
```

**验证 Fuses 状态**：

```bash
# 检查打包后的 exe 的 Fuses 配置
npx @electron/fuses read --app dist/win-unpacked/onework.exe
# 输出中应显示 EnableNodeCliInspectArguments: true（E2E 包）
```

> 参考：[electron-builder Fuses 配置](https://www.electron.build/tutorials/adding-electron-fuses.html)、[@electron/fuses](https://github.com/electron/fuses)

---

### 8.4 F3：添加 data-testid

**为什么需要**：自动化测试需要**稳定的元素标识**来定位页面上的输入框、按钮、结果区域。CSS class 和 DOM 结构会随重构变化导致用例批量失败，`data-testid` 是 Playwright 官方推荐的稳定选择器。

> 参考：[Playwright Best Practices](https://playwright.dev/docs/best-practices) — "Use locators. Locators come with auto-waiting and retry-ability."

**具体做法**：在 JSX/HTML 模板中为关键元素添加 `data-testid` 属性：

```html
<!-- 示例：登录页 -->
<input data-testid="username-input" placeholder="用户名" />
<input data-testid="password-input" type="password" placeholder="密码" />
<button aria-label="登录">登录</button>
<div data-testid="login-error" class="error"></div>

<!-- 示例：主界面 -->
<p data-testid="welcome-text"></p>
<input data-testid="task-input" placeholder="输入任务" />
<button aria-label="运行">运行</button>
<div data-testid="task-result"></div>
<li data-testid="history-item"></li>
```

**命名规则**：`<domain>-<element>[-<state>]`

**当前需要添加的 testid 清单**：

| testid | 元素 | 页面 | 用途 |
|---|---|---|---|
| `username-input` | 用户名输入框 | 登录页 | 登录用例填写用户名 |
| `password-input` | 密码输入框 | 登录页 | 登录用例填写密码 |
| `login-error` | 错误提示区域 | 登录页 | 登录失败负例断言 |
| `welcome-text` | 欢迎语 | 主页 | 登录成功断言 |
| `task-input` | 任务输入框 | 主页 | 任务执行用例 |
| `task-result` | 任务结果区域 | 主页 | 任务完成断言 |
| `history-item` | 历史记录条目 | 主页 | 历史可见断言 |

**选择器优先级**（Playwright 官方推荐）：

| 优先级 | 选择器 | 适用场景 | 稳定性 |
|---|---|---|---|
| 1 | `getByRole("button", { name: "登录" })` | 有明确语义角色的元素（button、textbox、heading） | 高 |
| 2 | `getByTestId("username-input")` | 无语义角色的通用容器、结果区域 | 高 |
| **禁止** | CSS class / XPath / DOM 路径 | — | 低，随重构频繁变更 |

> **对前端代码的影响**：`data-testid` 只是一个 HTML 属性，不影响样式、不影响行为、不影响性能。生产包中可保留（体积影响可忽略），也可通过 babel 插件在生产构建时移除。

---

### 8.5 F4：提供可观测的业务状态标识

**为什么需要**：自动化测试需要判断业务操作是否完成（如"登录成功"、"任务执行完毕"）。如果 UI 上没有明确的完成标识，测试只能用 `waitForTimeout` 硬等——这是 flaky 测试的根源。

> [VS Code Smoke Test](https://github.com/microsoft/vscode/blob/main/test/smoke/README.md) — "Hope is your worst enemy in UI tests. Always wait for the right condition."

**具体要求**：

| 业务状态 | 前端需提供的 UI 标识 | 自动化断言方式 |
|---|---|---|
| 登录成功 | 欢迎语文本 `data-testid="welcome-text"` 显示用户名 + 任务输入框可见 | `toHaveText("欢迎你，xxx")` + `toBeVisible()` |
| 登录失败 | 错误提示 `data-testid="login-error"` 显示错误文案 | `toHaveText("用户名或密码错误")` |
| 任务执行完成 | 结果区域 `data-testid="task-result"` 文本更新 | `toContainText("已完成")` |
| 页面加载中 | loading 指示器（建议 `data-testid="loading-indicator"`） | `toBeHidden()`（等待消失） |
| 页面加载完成 | loading 指示器消失，主内容区可见 | `toBeVisible()` |

**反面示例**（不要这样做）：
- 登录成功后只做页面跳转但没有任何可判断的文案/元素 → 测试无法断言
- 任务执行后结果区域始终显示"加载中"直到一段时间后才更新 → 测试只能硬等
- 错误状态不显示在 UI 上，只打 `console.error` → 自动化无法捕获

---

### 8.6 F5：E2E 环境开关（建议）

**为什么需要**：生产环境中的升级弹窗、引导蒙层、推送通知等会干扰自动化操作（点击被弹窗拦截、元素被蒙层遮挡）。

**具体做法**：在主进程中读取环境变量，传给渲染进程：

```javascript
// main.js — 主进程
const isE2E = process.env.E2E_AUTOMATION === "1";

// 创建窗口时通过 preload 或 webPreferences 传递
const mainWindow = new BrowserWindow({
  webPreferences: {
    // 方式 1：通过 additionalArguments
    additionalArguments: isE2E ? ["--e2e-mode"] : [],
    // 方式 2：通过 preload 脚本注入全局变量
  }
});
```

```javascript
// renderer（渲染进程）— 根据 E2E 标识关闭干扰项
const isE2E = process.argv.includes("--e2e-mode");

if (isE2E) {
  // 关闭升级提示弹窗
  // 关闭新手引导蒙层
  // 关闭非必要动画（减少 flaky）
  // 关闭自动轮询/WebSocket 推送通知
}
```

**E2E 模式下需要关闭的项**：

| 关闭项 | 原因 |
|---|---|
| 升级/更新提示弹窗 | 遮挡目标元素，导致 click 失败 |
| 新手引导蒙层/遮罩 | 遮挡目标元素 |
| 非必要动画（过渡动画、骨架屏） | 增加等待时间，可能导致定位不稳定 |
| 自动刷新/轮询 | 页面刷新会中断正在进行的自动化操作 |
| 推送通知弹窗 | 干扰元素定位 |

---

### 8.7 F6：testid 变更协作流程

**为什么需要**：`data-testid` 是前端和 QA 之间的**契约**。未经协商的变更会导致自动化用例批量失败。

**协作规则**：

1. **新增 testid**：前端添加后通知 QA，QA 在 locator 文件中同步新增。
2. **修改已有 testid**：**必须先与 QA 协商**。QA 确认影响范围后，前端修改 testid，QA 同步更新 locator 和用例。
3. **删除 testid**：同修改流程，需先确认没有用例依赖该 testid。
4. **Code Review 检查**：PR 中如果变更了 `data-testid`，reviewer 应确认 QA 已知悉。

**建议**：在 CI 中添加一个简单的检查脚本，扫描 `data-testid` 的增删改，自动在 PR 中 @QA。

---

## 9. 报告与可观测性

### 9.1 证据链

| 证据类型 | 触发条件 | 存放位置 | 格式 | 用途 |
|---|---|---|---|---|
| 结果截图 | 每条用例结束（成功+失败） | HTML 报告内联 | PNG, fullPage | 快速查看用例结束时的页面状态 |
| Trace 回放 | 仅失败时 | `test-results/<用例名>/trace.zip` | Playwright Trace 格式 | Trace Viewer 时间线回放：DOM 快照 + 操作序列 + 网络请求 |
| HTML 报告 | 每次运行 | `playwright-report/index.html` | HTML | 统一查看入口，聚合截图和 trace 链接 |
| 错误上下文 | 失败时 | `test-results/<用例名>/error-context.md` | Markdown | 失败原因描述 |

### 9.2 截图实现

在两种模式的 `mainWindow` fixture teardown 中统一实现：

```typescript
// 在 use(page) 之后执行（无论成功或失败）
try {
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  await testInfo.attach("result-screenshot", {
    body: screenshotBuffer,
    contentType: "image/png"
  });
} catch {
  // 忽略截图失败（如应用崩溃），避免掩盖真实错误
}
```

### 9.3 报告查看

```bash
npm run report:open                                    # 本地打开 HTML 报告
npx playwright show-trace test-results/xxx/trace.zip   # 打开 Trace Viewer
```

---

## 10. 里程碑与验收标准

### 阶段 0（已完成）

| 交付物 | 状态 | 验收标准 |
|---|---|---|
| Launch 模式 fixture（electron-app.ts） | 已完成 | 能启动 demo 应用并获取 Page |
| Attach 模式 fixture（existing-app.ts） | 已完成 | 能连接已运行实例并获取 Page |
| 登录模块全链路（locator/page/flow/assert/spec） | 已完成 | 登录成功用例通过 |
| GitHub Actions CI 流水线 | 已完成 | PR 触发执行，报告自动归档为 Artifact |
| HTML 报告 + 截图 + Trace | 已完成 | 每条用例有截图，失败有 trace |
| Demo 应用 | 已完成 | 含登录/任务/历史全流程 |
| 技术方案文档 | 已完成 | 本文档 |

### 阶段 1：前端 testid 对齐

| 交付物 | 验收标准 | 负责方 | 预计周期 |
|---|---|---|---|
| 前端核心页面补齐 `data-testid` | 第 8.2 节清单中所有 testid 在正式应用中存在 | 前端团队 | 1 周 |
| testid 协作规范文档 | 变更流程明确，QA 与前端达成一致 | QA + 前端 | 随 testid 同步 |

### 阶段 2：核心链路扩展

| 交付物 | 验收标准 | 预计周期 |
|---|---|---|
| Task 模块（locator/page/flow/spec） | 任务执行冒烟用例通过 | 1 周 |
| History 模块（locator/page/flow/spec） | 历史查看冒烟用例通过 | 0.5 周 |
| 登录失败负例 | 错误密码用例通过 | 0.5 周 |

### 阶段 3：CI 强化

| 交付物 | 验收标准 | 预计周期 |
|---|---|---|
| Playwright projects 分组（smoke/regression） | `playwright.config.ts` 定义项目，`npm run test:e2e:smoke` 和 `npm run test:e2e:regression` 可独立运行 | 0.5 周 |
| CI 质量门禁 | PR 合并前 smoke 必须通过；失败阻断合并 | 0.5 周 |
| 定时 regression | 每晚自动跑全量，失败通知 | 0.5 周 |

### 阶段 4：持续优化（按需）

| 方向 | 触发条件 |
|---|---|
| 测试数据管理（`data/accounts.ts`） | 测试账号需按环境区分时 |
| 自定义等待策略封装 | 出现大量相似的等待逻辑时 |
| 多平台 CI 矩阵（Windows + macOS + Linux） | 产品发布 macOS 版本时，参照 7.4/7.5 节配置 |
| 接入 Allure 或企业报告平台 | 需要趋势看板时 |

---

## 11. 风险登记册

| ID | 风险描述 | 概率 | 影响 | 等级 | 缓解措施 | 责任人 |
|---|---|---|---|---|---|---|
| R1 | 前端 UI 重构导致 `data-testid` 变更，用例批量失败 | 中 | 高 | **高** | 建立 testid 变更评审流程；locator 层隔离变更影响 | 前端 + QA |
| R2 | 生产包通过 Electron Fuses 禁用 `EnableNodeCliInspectArguments`，导致 Playwright `_electron.launch()` 无法注入 `--inspect` 参数而失败（注：`--remote-debugging-port` 不受此 Fuse 影响，Attach 模式不受影响） | 高 | 高 | **高** | 维护 E2E 专用构建，保持 `EnableNodeCliInspectArguments: true` | 构建工程 |
| R3 | 业务异步操作无稳定"完成信号"，导致用例等待超时 flaky | 中 | 中 | **中** | 前端提供稳定的状态标识；严禁 `waitForTimeout` | 前端 + QA |
| R4 | Playwright Electron 支持为 experimental，API 可能变更 | 低 | 中 | **中** | 锁定 Playwright 版本；升级前在分支验证兼容性 | QA |
| R5 | Linux CI 缺少 Display Server，Electron 启动失败 | — | 高 | **中** | Linux CI 必须配置 xvfb；当前使用 Windows runner 回避此问题 | DevOps |
| R6 | Electron 进程单实例限制，无法并行执行用例 | — | 低 | **低** | 当前 `workers: 1` 串行执行；未来可通过独立 user-data-dir 尝试并行 | QA |

---

## 附录

### A. 环境变量一览

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CI` | — | 设置后启用 CI 策略（重试 1 次） |
| `ELECTRON_MAIN_ENTRY` | `demo-electron-app/main.js` | Electron 主进程入口文件路径 |
| `USE_PACKAGED_ELECTRON` | — | 设为 `1` 使用打包后的 .exe 运行 |
| `ELECTRON_EXECUTABLE_PATH` | 自动查找最新版本 | 直接指定 .exe 完整路径 |
| `EXISTING_ELECTRON_CDP_URL` | — | 附着模式：完整 CDP 地址 |
| `EXISTING_ELECTRON_DEBUG_PORT` | — | 附着模式：端口号（自动拼接 `http://127.0.0.1:<port>`） |
| `NODE_ENV` | — | 开发模式下自动设为 `test` |
| `E2E_AUTOMATION` | — | 设为 `1` 开启 E2E 模式（关闭弹窗/动画、开放调试端口） |
| `E2E_DEBUG_PORT` | `9222` | E2E 模式下的 CDP 调试端口号（配合 `E2E_AUTOMATION=1` 使用） |

### B. 依赖清单

```json
{
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@types/node": "^22.10.2",
    "electron": "^37.2.6",
    "typescript": "^5.7.2"
  }
}
```

### C. 参考文献

| 编号 | 来源 | 链接 |
|---|---|---|
| [1] | Playwright Best Practices | https://playwright.dev/docs/best-practices |
| [2] | Playwright Page Object Model | https://playwright.dev/docs/pom |
| [3] | Playwright Fixtures | https://playwright.dev/docs/test-fixtures |
| [4] | Playwright Electron API | https://playwright.dev/docs/api/class-electron |
| [5] | Playwright CI Integration | https://playwright.dev/docs/ci |
| [6] | Playwright connectOverCDP | https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp |
| [7] | Electron Automated Testing | https://www.electronjs.org/docs/latest/tutorial/automated-testing |
| [8] | Electron Headless CI | https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci |
| [9] | Electron Fuses | https://www.electronjs.org/docs/latest/tutorial/fuses |
| [10] | VS Code Smoke Test | https://github.com/microsoft/vscode/blob/main/test/smoke/README.md |
| [11] | VS Code Extension CI | https://code.visualstudio.com/api/working-with-extensions/continuous-integration |
| [12] | Martin Fowler Page Object | https://martinfowler.com/bliki/PageObject.html |
| [13] | Google Testing Blog | https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html |
| [14] | WebdriverIO Electron Service | https://webdriver.io/docs/wdio-electron-service |
