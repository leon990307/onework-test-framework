# Agent桌面端自动化测试：技术栈与平台优先级基线

## 1. 当前默认基线（可直接执行）

在未获得更多项目信息前，采用以下默认假设：

- 桌面框架：`Electron`
- 首发平台：`Windows`
- CI首跑平台：`windows-latest`
- 后续扩展：`macOS`、`Linux`

## 2. 为什么先这样定

- 你的当前环境是 Windows，本地与CI联调成本最低。
- Electron 在桌面测试生态里资料最成熟，`Playwright` 和 `WebdriverIO` 均有可用路径。
- 先单平台跑通可最快拿到“稳定可重复”的自动化收益，再做跨平台差异治理。

## 3. 何时切换默认基线

满足以下任一条件时，切换主路线：

- 若项目是 `Tauri`：主框架切到 WebDriver/Tauri Driver 路线。
- 若大量原生控件（WPF/WinForms/UWP）不可被DOM稳定定位：切到 `FlaUI/Appium` 路线。
- 若业务强依赖跨平台一致性（同版本同时发 Win/macOS/Linux）：从PoC第2周起引入双平台并跑。

## 4. 技术栈确认清单（供你补充）

执行过程中如果你补齐这些信息，我可以秒级改造方案：

- 应用框架：Electron / Tauri / 原生混合
- 打包工具：electron-builder / forge / tauri bundler / 自研
- UI技术：React/Vue/Svelte/其他
- 是否有本地模型或本地工具进程
- 是否允许测试环境启用 mock 模式
- 发布平台优先级：Win > macOS > Linux（或其他）
