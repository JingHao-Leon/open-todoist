# open-todoist

**一个本地优先、键盘优先的开源任务管理器，支持自然语言快速录入 —— 一个不需要账号、
不需要服务器、不需要联网的 Todoist 替代方案。**

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)](package.json)
[![build](https://img.shields.io/badge/build-passing-brightgreen.svg)](package.json)
[![reverse-engineered with REA](https://img.shields.io/badge/reverse--engineered%20with-REA-6b4cff.svg)](docs/REVERSE_ENGINEERING.md)
[![stars](https://img.shields.io/badge/stars-%E2%98%85%20on%20GitHub-ff69b4.svg)](https://github.com/)

> **与 Todoist 无任何关联。** 本项目为独立的 clean-room 重实现。

## 这是什么

open-todoist 是一个**开源的 Todoist 替代方案**（open source Todoist alternative），
适合希望把全部待办事项托付给一个可信工具的人。你输入
`明天 9点 打电话给牙医 #健康 @电话 p2`，应用会在你确认之前**先把解析结果显示出来**，
然后任务才真正创建 —— 带日期、时间、优先级和归档。全程没有账号，因为根本没有服务器。

它**本地优先**（local-first）：所有数据存放在浏览器的 IndexedDB 里，页面加载完成后
**零网络请求**。因此它同时是一个**注重隐私的待办工具**、一个真正能**离线使用**的
**任务管理器**，也是一个约 3,700 行原创 TypeScript 的**极简待办应用**。它以最强的
形式实现自托管 —— 你早就拥有它，就在你的浏览器标签页里。

它同时是**键盘优先**的：每个操作都有快捷键，所有功能都能通过 `⌘K` 命令面板到达，
完整快捷键表见下文。

### 自然语言快速录入

这是本项目存在的理由。一行文字，边输入边解析：

| 你输入 | open-todoist 的理解 |
| --- | --- |
| `Standup tomorrow` | 日期：明天 |
| `Retro next monday` | 日期：下周一 |
| `Dentist in 2 weeks` · `Renew passport 3d` | 日期：+14 天 · +3 天 |
| `Deploy at 14:00 friday` · `Gym 9am` · `Dinner 7:30pm` | 日期 + 具体时间 |
| `Water plants every weekday` | 重复：周一至周五，不含周末 |
| `Review every mon,wed,fri` · `Backup every 2 weeks` | 重复：指定星期 / 每两周 |
| `Pay rent monthly` · `Journal daily` · `Review weekly` | 重复：每月 / 每天 / 每周 |
| `Fix outage p1` … `Someday p4` | 优先级 1（紧急）… 4（无） |
| `Write spec #Roadmap` · `写周报 #工作` | 项目，不存在则自动创建 |
| `Fix login @bug @urgent` | 标签 |

可以自由组合。`Draft release notes #Work @docs every monday at 9am p1` 会创建出一个
字段完整的中文任务。中文同样支持：`明天`、`下周三`、`三天后`、`每天`、`每周五`、
`下午3点半`。

**而且它会展示自己的推理过程。** 输入时，下方会实时出现解析结果标签：

![快速录入与实时解析预览](docs/images/quick-add-preview.png)

**不确定的时候，它什么都不做。** `You may want to check this` 会原样保留每个单词 ——
单独的 `may` 不会被当作月份。`Fix the mar floor` 会保留 `mar`，因为它在"Tuesday"和
"March"之间确实存在歧义。留在标题里的多余单词是你看得见、能修正的错误；而一个被悄悄
设错的日期，要到出事那天你才会发现。这是一个真实的设计决策，并且有测试覆盖。

## 功能对比

| 功能 | open-todoist | Todoist | 说明 |
| --- | --- | --- | --- |
| 自然语言快速录入 | ✅ | ✅ | 语法为独立实现，73 个测试 |
| 提交前实时解析预览 | ✅ | ✅ | 每次按键都更新 |
| 重复：每天 / 工作日 / 按星期 / 每月 / 每年 | ✅ | ✅ | 完成重复任务时自动顺延 |
| 优先级分层 | ✅ `p1`–`p4` | ✅ | 同样的约定，独立实现 |
| 项目、标签、收集箱、今天、即将到来、已完成 | ✅ | ✅ | |
| 回收站与恢复（软删除） | ✅ | ✅ | |
| 排序与筛选 | ✅ 5 种排序 | ✅ 更多 | 此处没有保存的自定义筛选 |
| 命令面板 ⌘K、键盘优先 | ✅ | ✅ | |
| 统计：连续天数、28 天柱状图、按项目/标签分布 | ✅ | ✅ 更深 | 手写 SVG，不引入图表库 |
| JSON 导入 / 导出 | ✅ 往返测试 | ⚠️ | 带版本号、可读、格式化良好 |
| CSV 导出 | ✅ 12 列 | ⚠️ Pro 功能 | 符合 RFC-4180 引号规则 |
| 离线 | ✅ 零网络请求 | ⚠️ 离线模式 | 没有服务器，也就无所谓离线 |
| **移动端 App** | ❌ | ✅ | **最大短板。** 没有原生 App。 |
| **提醒 / 通知** | ❌ | ✅ | **最大短板。** 到期日是被动的。 |
| **日历、看板、甘特图视图** | ❌ | ✅ | 仅列表视图 |
| **集成（100+）** | ❌ | ✅ | |
| **AI 助手功能** | ❌ | ✅ | 有意为之：你的任务不会外传 |
| **评论、附件、工时** | ❌ | ✅ | |
| **团队 / 共享项目** | ❌ | ✅ | 结构性的，设计使然 |
| 跨设备同步 | ❌ 不适用 | ✅ | 核心取舍 |
| 用户账号 | ❌ 不适用 | ✅ | 核心取舍 |

完整表格（含 open-todoist 确实更好的部分）见
[docs/COMPARISON.md](docs/COMPARISON.md)。

## 为什么做它 / 取证方式

做它，是因为主流任务管理器都要求账号、服务器和网络连接 —— 对于一份私密的待办清单，
这三者都是糟糕的交换。

**我们没有逆向任何专有代码，也不可能做到。** 我们使用 REA 对 Todoist 的**公开 Web
表面**进行取证：公开营销站点上的 78 个脚本（351,479 个 AST 节点），以及
`app.todoist.com` 未登录时重定向到的登录外壳（5 个脚本、1,910 个 AST 节点）。这让我们
得知了技术栈指纹和公开的信息架构，仅此而已。

未授权状态下，应用端不暴露任何任务数据 API。因此这是对**公开 Web 表面的架构与信息
架构**取证，**不是**代码逆向。产品的行为规格来自可观察的公开行为与公开文档，以及我们
自己的设计。完整说明、证据 ID 与命令见
[docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md)。

## 快速开始

```bash
git clone https://github.com/<you>/open-todoist.git
cd open-todoist
npm install
npm run dev        # http://localhost:5173

# 验证
npm run build      # tsc --noEmit && vite build
npm test           # 165 个测试
```

无需配置，无需 `.env`，无需搭建数据库。需要 Node 18+。
如果 `npm install` 因网络缓慢卡住：`npm install --registry=https://registry.npmmirror.com`。

## 截图

![收集箱视图，含项目、标签与统计面板](docs/images/screenshot.png)

*（两张截图均为本应用在无头 Chrome 中运行自身构建产物的真实截图，使用示例数据。）*

## 架构

```
React UI  ──▶  reducer store  ──▶  纯函数 lib  ──▶  IndexedDB
 组件层          (useStore)      nlp · recurrence     （不可用时回退
                     ▲           filter · stats        到 localStorage）
                     └────── 250ms 防抖写回 ──────────┘
```

领域层是不引用 React 的纯 TypeScript，因此全部 165 个测试可以直接在 Node 中运行，
无需 DOM 模拟。

- `src/lib/nlp.ts` —— 快速录入扫描器（英文 + 中文）
- `src/lib/recurrence.ts` —— 下次触发日期引擎，正确处理夏令时与闰年
- `src/lib/db.ts` —— 约 200 行的 IndexedDB 封装，不使用 ORM
- `src/lib/date.ts` —— 日历运算；到期日是**本地日历日**，绝不是时间戳

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 键盘快捷键

| 范围 | 按键 | 动作 |
| --- | --- | --- |
| 全局 | `⌘K` / `Ctrl-K` | 命令面板 |
| 全局 | `N`、`Q` 或 `/` | 聚焦快速录入 |
| 全局 | `T` | 今天 |
| 全局 | `U` | 即将到来 |
| 全局 | `I` | 收集箱 |
| 全局 | `C` | 已完成 |
| 全局 | `S` | 切换统计面板 |
| 任务行 | `空格` 或 `X` | 完成 / 重新打开（重复任务自动顺延） |
| 任务行 | `E` | 行内编辑标题 |
| 任务行 | `1` `2` `3` `4` | 设置优先级 |
| 任务行 | `Delete` | 移入回收站（在回收站中按 `Backspace` 恢复） |
| 任务行 | `↑` `↓` | 手动排序 |

## 路线图

诚实列出：

**已完成**
- [x] 自然语言快速录入（中英文）与实时预览
- [x] 重复、优先级、项目、标签、软删除与回收站
- [x] 全部七个视图、排序与筛选
- [x] 命令面板与完整键盘操作
- [x] JSON 导入导出、CSV 导出
- [x] 含连续天数与分布的统计面板
- [x] 跟随系统的深色模式

**接下来**
- [ ] 可选的本地提醒通知（需授权，仍然本地）
- [ ] 子任务
- [ ] 拖拽排序
- [ ] 支持 Markdown 的多行描述
- [ ] 不含附件的任务模板

**大概永远不会做，而这正是重点**
- ❌ 账号、服务器或同步
- ❌ 任何形式的遥测
- ❌ 广告、联盟链接或付费引导
- ❌ 会把你的任务文本外传的 AI 功能

## 常见问题

**这是真正的开源 Todoist 替代方案吗？**
是的 —— MIT 许可，具备自然语言快速录入、项目、标签、重复任务、四级优先级和七个
视图。它比 Todoist 更窄：没有移动端 App、没有提醒、没有看板或日历视图、没有同步。
[完整对比](docs/COMPARISON.md)。

**需要账号吗？**
不需要。没有注册、没有登录、没有邮箱，也没有可以存放这些的服务器。

**我的数据私密吗？**
任务存储在你浏览器的 IndexedDB 中，绝不离开设备。页面加载后不再发起任何网络请求，
不含任何分析代码，运行时依赖只有 `react` 和 `react-dom` —— 可在 `package.json` 中核实。

**会跨设备同步吗？**
不会，我们宁愿直说。你的任务存在于某一个浏览器的用户配置中。请定期导出 JSON；
那就是你拥有的"备份"。

**能离线使用吗？**
完全可以。代码里根本没有 API 客户端可供"离线"。

**手机上能用吗？**
Web 应用是响应式的，可以添加到主屏幕，但没有原生 App，也没有推送通知。如果手机
访问对你很重要，请用 Todoist。

**如果解析错了怎么办？**
它拒绝猜测。有歧义的词会留在标题里；没有日期的时间也会留在标题里。预览会在你按
回车之前准确显示将创建的内容。

**完成一个重复任务会怎样？**
自动顺延 —— 到期日推进到下一个触发日期，保留时间，并且任务保持未完成状态。

**如何备份数据？**
状态栏（或 `⌘K`）中的 **JSON** 会把全部数据导出为带版本号、可读性强的文档；导入即可
恢复。另有 CSV 导出供表格使用。

**这个项目和 Todoist 有关联吗？**
没有。"Todoist" 是 Doist 的商标。open-todoist 独立、非官方、无关联，不包含其任何
代码、资源或品牌素材。见 [NOTICE.md](NOTICE.md)。

更多问题见 [docs/FAQ.md](docs/FAQ.md)。

## 贡献

欢迎 issue 与 PR —— 尤其是解析器的边界情况，这是最容易出错的部分。提交前请运行
`npm run build && npm test`。见 [CONTRIBUTING.md](CONTRIBUTING.md) 与
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。clean-room 声明见 [NOTICE.md](NOTICE.md)。
