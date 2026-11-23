# Project Status

> Last updated: 2026-11-23

## 总览

| 项目 | 状态 |
|---|---|
| 产品方向 | ✅ QuoteSentry（报价哨兵） |
| 产品形态 | ✅ 桌面优先 Web 应用 |
| 5 天 MVP 范围 | ✅ 已冻结 |
| 技术底座 | ✅ React + Vite + TypeScript + Cloudflare Worker + Zod + D1 + R2 |
| 代码实现 | ✅ 主链路可运行 |
| Demo 数据 | ✅ 33 SKU / 9 份仿真询价 / 3 客户 |
| 自动化测试 | ✅ 41 个测试通过 |
| DeepSeek 实调用 | ✅ 服务端直连 smoke 已通过 |
| wayknow 前端 | ✅ 已构建到 `work/wayknow/quotesentry/` |
| 线上部署 | 🟡 Worker/D1/R2 本地全链路已验证；远程资源和 Nginx 待配置 |
| 比赛录屏/路演材料 | ✅ 演示视频、SRT、A4 一页纸均已完成 |

## ✅ Done

- 建立 React/Vite 桌面工作台与 Express API。
- 实现邮件文本、CSV、XLSX 三种上传/输入路径。
- 实现 DeepSeek OpenAI 兼容网关：服务端直连、JSON 校验、超时、有限重试、代码块兼容、失败降级。
- 对齐 `app_survey` 的服务端接入方式：`DEEPSEEK_API_KEY` + `Bearer` + `https://api.deepseek.com/chat/completions`，并提供真实 Key smoke 命令。
- 用真实 Key 完成服务端直连 smoke：HTTP 请求成功并返回合法 JSON，确认端点、鉴权和模型名可用。
- 用 `seed-08` 完成真实 DeepSeek 全链路：三行识别为 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，26 条证据全部回指成功；审批、CSV/PDF 导出和发送阻断均通过。
- 实现逐行抽取、原文回指、缺参/冲突/单位门禁、目录硬匹配。
- 实现整数分为单位的确定性计价：数量阶梯、客户折扣、汇率、固定费用和毛利底线。
- 实现三行询价（可报价 / 待澄清 / 目录外）并行处理，异常行不拖死整封询价。
- 实现人工审批、毛利 override（强制原因）、审计时间线。
- 实现审批后的客户 CSV/PDF 导出，内部成本/毛利不进入客户文件。
- 实现 `SEND_MODE=disabled` 服务端拒绝外发。
- 实现演示数据重置、健康检查、bootstrap、询价 CRUD 与导出 API。
- 完成 1440px 桌面浏览器渲染检查。
- 写好 `docs/DEMO.md` 演示 Runbook、演示前检查、故障兜底和 `docs/PITCH.md` 路演大纲。
- 完成 3 分 34 秒中文旁白演示视频：`demo/QuoteSentry-demo-zh.mp4`，并附 SRT 字幕。
- 完成 A4 单页路演稿：`demo/QuoteSentry-one-pager.pdf`，并用 Quick Look 确认严格 1 页、无裁切；PNG 预览为 `demo/QuoteSentry-one-pager.png`。
- 完成 `/quotesentry/` 本地生产构建验证：静态资源、子路径 API、深层刷新、审批与 CSV/PDF 导出均通过。
- 实现可选 Express Basic Auth：未认证/错误密码 401，正确密码可访问页面、静态资源和 API；本地默认关闭。
- 新增 Cloudflare Worker API：复用领域层，支持 `/api` 与 `/quotesentry/api` 两种前缀。
- 新增 D1 持久化：`rfq_documents` 保存完整询价 JSON，`quote_artifacts` 保存 R2 文件索引。
- 新增 R2 归档：上传原文与审批后的客户 CSV/PDF 均写入 R2，并记录 SHA-256。
- 实现 Worker Basic Auth，行为与 Express 版本一致；配置不完整时失败关闭。
- 完成 Worker 本地全链路：健康检查、bootstrap、文本/XLSX 上传、`seed-08` 审单、审批、CSV/PDF、发送阻断、重置。
- 完成 R2 一致性校验：导出对象与 API 响应 SHA-256 完全相同。
- 将 React 前端构建到 `work/wayknow/quotesentry/`，资源路径为 `/quotesentry/assets/`，API 自动走 `/quotesentry/api`。

## 验证结果

```text
npm run check    ✅
npm test         ✅ 8 files / 41 tests
npm run test:deepseek ✅ 真实 DeepSeek 直连成功
npm run seed     ✅ 9/9 samples recognized
npm run build    ✅
npm run worker:dry-run ✅
npm run db:migrate:local ✅
```

手动验证：

- `seed-08`：`PRICED / NEEDS_CLARIFICATION / NO_MATCH`，报价仅含 1 条可报行。
- `seed-06`：毛利越界时审批返回 409；override 后可审批。
- `seed-01` / `seed-07` / `seed-09`：干净询价全部可进入审批。
- CSV 导出不含 margin/cost/毛利/成本等字段。
- PDF 返回合法 `%PDF` 文件。
- `POST /send` 在 `SEND_MODE=disabled` 时返回 HTTP 403。
- Worker 本地 `/api/health`：`storage: d1+r2`，演示模式，`sendMode: disabled`。
- Worker 本地 `seed-08`：规则模式下仍为 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，USD 465.00，整单毛利 21.09%。
- Worker 本地文本上传与 XLSX 上传：D1 可读回、R2 可读回、源文件 SHA-256 与 `quote_artifacts` 一致。
- R2 中 CSV 对象与 API 下载一致；PDF 为合法 `%PDF-1.7`。
- XLSX 上传后可完成表头规则抽取和计价。
- `seed-08` 真实 LLM 抽取：第 1 行 `PRICED`、第 2 行缺 `surfaceTreatment`、第 3 行 `NO_MATCH`，证据 26/26 已验证；连续 3 次状态与金额稳定。
- 真实 LLM 结果审批成功，生成 USD 465.00 客户报价；CSV/PDF 导出成功，客户 CSV 不含成本/毛利。
- 整单毛利率 21.09%，ROW 01 行毛利率 24.67%；演示口径已区分整单与行级毛利。
- `POST /send` 在 `SEND_MODE=disabled` 时返回 HTTP 403。

## 🚧 In Progress

- 无。

## ⏳ Pending

| 任务 | 完成定义 |
|---|---|
| Cloudflare 远程资源 | 创建线上 D1/R2、替换真实 `database_id`、执行远程迁移并配置 `DEEPSEEK_API_KEY` |
| Worker 远程部署 | `npm run worker:deploy` 后记录 Worker hostname |
| wayknow API 接入 | 配置 Nginx `/quotesentry/api/` 反代，线上验证页面与 API |
| 现场彩排 | 用一页纸 + 录屏完成一次 3–5 分钟讲解，确认节奏、追问和故障兜底 |

## ⚠️ Risks

| 风险 | 影响 | 应对 |
|---|---|---|
| 现场网络/限流 | 演示时模型调用可能超时 | 已通过 API smoke；保留规则模式与录屏兜底 |
| 模型输出漂移 | 字段缺失或证据不对齐 | Zod 校验 + 原文子串验证 + 失败降级 |
| Worker/D1/R2 未远程部署 | 刷新 wayknow 页面时 API 仍会连接失败 | 按 deploy.md 创建资源、部署 Worker、配置 Nginx |
| API 鉴权未启用 | 公网可直接调用演示 API | 预发同时配置 Worker Basic Auth；正式版做登录与角色权限 |
| D1/R2 运维 | 备份、配额和误删未验证 | 比赛版只开放预发；正式上线前补备份和配额告警 |
| xlsx 依赖安全告警 | 恶意表格风险 | 只接收可信文件；生产加隔离解析/病毒扫描 |
| 极端低价毛利率展示 | 毛利率可能小于 -100% | UI 显示真实数字；路演明确这是模拟口径 |

## 下一步

1. 创建线上 D1/R2，替换 `wrangler.toml` 的占位 `database_id`，执行远程迁移。
2. 配置 Worker secrets，部署 Worker，并在 wayknow Nginx 增加 `/quotesentry/api/` 反代。
3. 线上验证 `/quotesentry/`、`/quotesentry/api/health`、`seed-08` 审批与导出后，再做正式彩排。
