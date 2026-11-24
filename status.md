# Project Status

> Last updated: 2026-11-24

## 总览

| 项目 | 状态 |
|---|---|
| 产品方向 | ✅ QuoteSentry（报价哨兵） |
| 产品形态 | ✅ 桌面优先 Web 应用 |
| 5 天 MVP 范围 | ✅ 已冻结 |
| 技术底座 | ✅ React + Vite + TypeScript + Cloudflare Worker + Zod + D1 |
| 代码实现 | ✅ 主链路可运行 |
| Demo 数据 | ✅ 33 SKU / 9 份仿真询价 / 3 客户 |
| 自动化测试 | ✅ 51 个测试通过 |
| DeepSeek 实调用 | ✅ 线上 Worker Key 已配置，实时抽取已验收 |
| 模型选择器 | ✅ Flash（默认）/ V4 Pro 已上线；真实调用、构建与部署已验收 |
| wayknow 前端 | ✅ 已构建到 `work/wayknow/quotesentry/` |
| 线上部署 | ✅ `wayknow.tech/quotesentry/` + Worker API + D1 已上线 |
| 线上对话审单 | ✅ Worker Version `1ad89225`，三轮对话与审批边界已验收 |
| 比赛录屏/路演材料 | ✅ 2:50 视频、二维码、8 模块方案和提报表填写稿已完成；待填真实联系人并签署身份材料 |

## ✅ Done

- 建立 React/Vite 桌面工作台与 Express API。
- 实现邮件文本、CSV、XLSX 三种上传/输入路径。
- 实现 DeepSeek OpenAI 兼容网关：服务端直连、JSON 校验、超时、有限重试、代码块兼容、失败降级。
- 实现可切换字段抽取模型：右上角 `DeepSeek Flash`（默认）/ `DeepSeek V4 Pro`，选择持久化到浏览器；服务端只接受 `flash`、`pro` 两个受控 ID 并解析为实际模型名，非法值返回 400。旧 `chat` 值自动回落到 Flash。
- 模型选择只传入抽取链路，审计记录实际模型名；SKU 匹配、整数分计价、毛利、审批和客户导出不读取模型选择。
- 真实调用复验：默认 Flash 分析审计记录 `deepseek-flash`，显式选择 Pro 记录 `deepseek-v4-pro`；两者均得到 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`、USD 465.00 和 21.09% 毛利，Pro 约 9 秒、Flash 约 4 秒。
- 对齐 `app_survey` 的服务端接入方式：`DEEPSEEK_API_KEY` + `Bearer` + `https://api.deepseek.com/chat/completions`，并提供真实 Key smoke 命令。
- 用真实 Key 完成服务端直连 smoke：HTTP 请求成功并返回合法 JSON，确认端点、鉴权和模型名可用。
- 线上 Worker 配置 `DEEPSEEK_API_KEY`，`/quotesentry/api/health` 已返回 `engine: "llm"`、`llmConfigured: true`。
- 线上 `seed-08` 真实 LLM 验收通过：三行状态正确、USD 465.00、26/26 证据；审批、CSV/PDF 和发送阻断均通过，验收后已重置为 9 份样例。
- 用 `seed-08` 完成真实 DeepSeek 全链路：三行识别为 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，26 条证据全部回指成功；审批、CSV/PDF 导出和发送阻断均通过。
- 实现逐行抽取、原文回指、缺参/冲突/单位门禁、目录硬匹配。
- 实现整数分为单位的确定性计价：数量阶梯、客户折扣、汇率、固定费用和毛利底线。
- 实现三行询价（可报价 / 待澄清 / 目录外）并行处理，异常行不拖死整封询价。
- 实现人工审批、毛利 override（强制原因）、审计时间线。
- 实现审批后的客户 CSV/PDF 导出，内部成本/毛利不进入客户文件。
- 实现三轮对话审单：首轮审单、按行补充规格并重算、解释阻断原因；人工补充字段写入 `human` 证据和审计。
- 对话只返回结构化结果与动作建议，不自动审批、不自动导出；审批仍由报价审批页的按钮和人工确认完成。
- 构建并推送 `wayknow/quotesentry`，部署 Worker Version `1ad89225-1d5d-46c7-9f96-3f2b2955f3fe`。
- 线上完成三轮对话验收：首轮 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，补充第二行镀锌后变为 `PRICED / PRICED / NO_MATCH`，第三行解释与“去报价审批”按钮均正确；对话未触发审批或导出审计。
- 线上验收后执行 `reset-demo`，`seed-08` 恢复为 `RECEIVED`、0 行、0 轮对话的干净演示状态。
- 实现 `SEND_MODE=disabled` 服务端拒绝外发。
- 实现演示数据重置、健康检查、bootstrap、询价 CRUD 与导出 API。
- 完成 1440px 桌面浏览器渲染检查。
- 写好 `docs/DEMO.md` 演示 Runbook、演示前检查、故障兜底和 `docs/PITCH.md` 路演大纲。
- 完成 2 分 50 秒中文旁白演示视频：`demo/QuoteSentry-demo-zh.mp4`，覆盖三轮对话、补参重算、审批边界、客户导出和审计，并附 SRT 字幕。
- 视频规格已校验：1600 × 1000、H.264、30 fps、AAC 单声道、169.97 秒；关键帧已确认三轮对话、审批页、审计页和结尾体验链接。
- 视频按默认 `DeepSeek Flash` 录制，画面包含右上角模型选择器与对话页 `DeepSeek 就绪` 状态；旁白说明可切 `DeepSeek V4 Pro`、正式版可按用户需求支持更多模型，主线不切换 Pro。
- 完成 8 模块产品解决方案（7 个规定模块 + Demo/验证证据）的 HTML、PDF 和 DOCX。
- 完成体验二维码卡片、作品提报信息表填写稿、提交清单和邮件模板。
- 完成参赛要求原文归档：`submission/参赛要求原文与提交清单.md`。
- 完成 A4 单页路演稿并更新到最新口径：51 个自动化测试、补参后 3→2 行可报价；PDF 严格 1 页、无裁切，PNG 预览同步更新。
- 完成 `/quotesentry/` 本地生产构建验证：静态资源、子路径 API、深层刷新、审批与 CSV/PDF 导出均通过。
- 实现可选 Express Basic Auth：未认证/错误密码 401，正确密码可访问页面、静态资源和 API；本地默认关闭。
- 新增 Cloudflare Worker API：复用领域层，支持 `/api` 与 `/quotesentry/api` 两种前缀。
- 新增 D1 持久化：`rfq_documents` 保存完整询价 JSON，`quote_artifacts` 保存文件元数据与 BLOB。
- 新增文件归档：上传原文与审批后的客户 CSV/PDF 默认写入 D1，并记录 SHA-256；R2 保留为可选后端。
- 实现 Worker Basic Auth，行为与 Express 版本一致；配置不完整时失败关闭。
- 完成 Worker 本地全链路：健康检查、bootstrap、文本/XLSX 上传、`seed-08` 审单、审批、CSV/PDF、发送阻断、重置。
- 完成 D1 文件一致性校验：归档字节数与导出响应一致。
- 将 React 前端构建到 `work/wayknow/quotesentry/`，资源路径为 `/quotesentry/assets/`，API 自动走 `/quotesentry/api`。
- 创建线上 D1 `quotesentry-db`（`46d5a6cd-e959-486a-879a-72e3a0939b62`）并执行 0001/0002 迁移。
- 部署 Worker `quotesentry-api`，通过 Cloudflare Route 接管 `wayknow.tech/quotesentry/api/*`。
- 线上验收完成：静态页 200、bootstrap 9 份样例、`seed-08` 三行状态与 USD 465.00、审批、CSV/PDF、403 发送阻断、文本上传与 D1 归档。

## 验证结果

```text
npm run check    ✅
npm test         ✅ 10 files / 51 tests
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
- Worker 线上 `/quotesentry/api/health`：`storage: d1`，演示模式，`sendMode: disabled`。
- Worker 本地 `seed-08`：规则模式下仍为 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，USD 465.00，整单毛利 21.09%。
- Worker 线上文本上传：文档与源文件均可在 D1 读回，`quote_artifacts` 的 `storage_backend=d1`。
- 线上导出的 CSV 为 310 字节且不含成本/毛利；PDF 为 1976 字节、合法 `%PDF-1.7`。
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
| 参赛材料签字 | 负责人 wayknow / develop@wayknow.tech 已填；待补手机号、签署承诺书并准备身份证正反面 |
| D1 备份与配额 | 比赛后补自动备份、配额告警和恢复演练 |
| 静态资源缓存/带宽 | 线上首次资源加载偶发较慢，比赛前复查 Cloudflare 缓存策略 |
| 现场彩排 | 用一页纸 + 2:50 录屏完成一次 3 分钟讲解，确认节奏、追问和故障兜底 |

## ⚠️ Risks

| 风险 | 影响 | 应对 |
|---|---|---|
| 现场网络/限流 | 演示时模型调用可能超时 | 已通过 API smoke；保留规则模式与录屏兜底 |
| 模型输出漂移 | 字段缺失或证据不对齐 | Zod 校验 + 原文子串验证 + 失败降级 |
| DeepSeek 额度/限流 | 现场调用可能超时或返回 429 | 保留规则模式与录屏兜底；演示前预热并复测 `seed-08` |
| API 鉴权未启用 | 公网可直接调用演示 API | 预发同时配置 Worker Basic Auth；正式版做登录与角色权限 |
| D1 运维 | 备份、配额和误删未验证 | 比赛版只开放预发；正式上线前补备份和配额告警 |
| xlsx 依赖安全告警 | 恶意表格风险 | 只接收可信文件；生产加隔离解析/病毒扫描 |
| 极端低价毛利率展示 | 毛利率可能小于 -100% | UI 显示真实数字；路演明确这是模拟口径 |

## 下一步

1. 填写真实负责人姓名、电话、邮箱和参赛形式，签署《作品自创承诺书》并准备身份材料。
2. 按 `submission/QuoteSentry-提交清单与邮件模板.md` 核对附件并发送提交邮件。
3. 比赛前再执行一次 `POST /api/reset-demo`，确保从 9 份干净样例开始。
