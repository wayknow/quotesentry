# QuoteSentry（报价哨兵）

> 面向中国高混紧固件外贸商的询价审单 Agent。桌面优先 Web 应用。

## 当前状态

MVP 已可运行：33 个仿真 SKU、9 份仿真询价、邮件文本 + Excel/CSV 输入、逐行证据、目录硬匹配、确定性计价、三轮对话补参、人工审批、毛利 override、CSV/PDF 导出和审计时间线。

正式部署形态为 **Cloudflare Worker + D1**：Worker 负责 API 与 DeepSeek 调用，D1 保存询价、报价、审批、审计以及上传原文和客户导出的文件字节。R2 保留为后续可选归档后端；当前账号未开通 R2，不影响演示主链路。Express + 本地 JSON 保留为离线开发回退。

```bash
npm install
npm run dev
```

- 前端：`http://127.0.0.1:5173`
- Worker API：`npm run db:migrate:local && npm run dev:worker`，访问 `http://127.0.0.1:8787/api/health`
- Express 回退：`npm run dev`（前端 `5173`，API `3001`）
- 生产前端：`npm run build:wayknow`，写入 `../wayknow/quotesentry/`

DeepSeek 默认走 OpenAI 兼容接口。Worker 本地开发复制 `.dev.vars.example` 为 `.dev.vars`，线上用 `npx wrangler secret put DEEPSEEK_API_KEY`；Key 只由服务端读取，不进入浏览器。未配置 Key 时界面明确显示“规则模式”，不会冒充 AI。Express smoke 可运行 `npm run test:deepseek`。

预发/公开演示可同时配置 `BASIC_AUTH_USER` 与 `BASIC_AUTH_PASSWORD` 开启可选 HTTP Basic Auth；本地默认关闭。

## 产品一句话

QuoteSentry 读取邮件文本和 Excel 询价，逐行抽取规格并回指原文；能确认的行进入目录匹配和确定性计价，缺参、冲突、目录外或毛利越界的行被明确阻断，最终由人审批后才允许导出。

## 演示主场景

打开 `演示主场景 · 三行询价`（`seed-08`）：

1. `M12x75 8.8 ZN` → 目录硬匹配 → 确定性计价 → 可审批。
2. `M12x75 8.8` 缺表面处理 → 待澄清，不生成正式价格。
3. `M14x60` → 目录无匹配，不硬选相似 SKU。

然后进入“报价审批”查看客户视图与内部成本/毛利隔离；审批后导出 CSV/PDF，在“审计时间线”核对模型、规则版本、哈希和责任人。

需要连续对话时进入“对话审单”：第一轮审单 → 回复“第二行表面处理是镀锌”触发重算 → 追问“为什么第三行不能报价”。对话只做理解、补参和解释；审批与导出仍必须由按钮和人工确认。

## 核心安全边界

- LLM 只做字段抽取；价格、折扣、汇率、费用、毛利、合计全部由确定性代码计算。
- 对话只做补参与解释，不自动审批、不自动导出、不自动外发。
- LLM 返回的原文片段必须能在询价中找到，否则标为未验证并阻断。
- 模型返回的 SKU/价格字段不参与业务事实，SKU 只来自目录硬过滤。
- `SEND_MODE=disabled` 时服务端始终拒绝发送；比赛版只允许审批后导出。
- 客户 CSV/PDF 不含成本、毛利、内部异常、审批人或模型信息。
- 所有客户、SKU、价格和询价均为仿真数据，界面固定展示演示横幅。

## 技术栈

- 前端：React 18 + Vite + TypeScript，桌面优先。
- 后端：Cloudflare Worker + TypeScript + Zod；Express 仅作本地回退。
- 模型：DeepSeek OpenAI 兼容接口；失败时降级规则抽取并显著标注。
- 数据：D1 持久化询价、审计和文件归档（单文件上限 1 MB）；`POST /api/reset-demo` 可重置演示文档。
- 文件：Worker 内用 `xlsx` 解析 Excel，`pdf-lib` 生成客户 PDF。

## 常用命令

```bash
npm run dev       # 同时启动 Vite 和 Express（离线回退）
npm run dev:worker # 启动本地 Cloudflare Worker（D1）
npm run db:migrate:local # 初始化本地 D1
npm run check     # TypeScript 类型检查
npm test          # 46 个金标/领域/Worker/对话测试
npm run test:deepseek  # 用真实 Key 直连 DeepSeek 做 smoke test
npm run seed      # 校验 9 份仿真询价均可识别
npm run build     # 生产构建
npm run build:wayknow # 构建到 wayknow/quotesentry
npm run worker:deploy # 部署 Cloudflare Worker
npm start         # Express 回退
```

## 目录

```text
client/               React 工作台
worker/               Cloudflare Worker、D1 存储、Auth
server/               Express 回退、领域规则、DeepSeek 网关、导出
server/domain/        抽取、门禁、硬匹配、计价、审批、审计
migrations/           D1 Schema
shared/schema.ts      共享 Zod Schema 与类型
data/catalog/         33 个仿真 SKU
data/samples/         9 份仿真询价
tests/golden/         计价、门禁、匹配、流程、导出隔离测试
```

## 文档

| 文件 | 内容 |
|---|---|
| [project.md](project.md) | 产品定义、目标客户、范围、架构、演示脚本 |
| [status.md](status.md) | 当前完成度、验证结果、风险与下一步 |
| [decisions.md](decisions.md) | 关键决策与取舍 |
| [deploy.md](deploy.md) | 本地运行、环境变量、wayknow 子目录部署 |
| [docs/DEMO.md](docs/DEMO.md) | 3 分钟以内演示脚本、已录视频结构和故障兜底 |
| [docs/PITCH.md](docs/PITCH.md) | 一页纸结构、路演话术和常见追问 |
| [demo/QuoteSentry-one-pager.pdf](demo/QuoteSentry-one-pager.pdf) | A4 单页路演稿（PDF，严格 1 页） |
| [demo/QuoteSentry-one-pager.png](demo/QuoteSentry-one-pager.png) | 一页纸高清预览图 |
| [demo/QuoteSentry-demo-zh.mp4](demo/QuoteSentry-demo-zh.mp4) | 2 分 43 秒中文旁白演示视频（含三轮对话） |
| [AGENTS.md](AGENTS.md) | 面向编码 Agent 的仓库约束与自检 |

## 当前限制

- DeepSeek 服务端连通性、`seed-08` 真实 LLM 抽取、审批和导出已实测通过；仍需准备规则模式录屏兜底。
- 不做 PDF 原文件解析、OCR、真实邮箱/ERP、多租户、登录权限。
- 毛利为税前、未计出口退税的演示口径。
- 线上 Worker 已部署到 `https://wayknow.tech/quotesentry/api/`，使用 D1 和可选 Basic Auth；正式账号、角色、多租户和 R2 归档仍不在当前范围。

## 上游与许可

- 设计与架构参考：`AnshMNSoni/B2B-RFP-Agent`（MIT）、`gourav-shokeen/rfq-quote-agent`（MIT）。
- 当前实现为 greenfield thin slice，尚未复制上述仓库源码；详见 [docs/UPSTREAM.md](docs/UPSTREAM.md) 与 [NOTICE](NOTICE)。
