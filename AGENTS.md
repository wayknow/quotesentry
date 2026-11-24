# AGENTS.md — QuoteSentry 报价哨兵

> 面向 AI 编码 Agent（Codex 等）的仓库约定。产品定义见 [project.md](project.md)，进度见 [status.md](status.md)，决策见 [decisions.md](decisions.md)，部署见 [deploy.md](deploy.md)。

## 项目概览

- **是什么**：QuoteSentry（报价哨兵），面向中国高混紧固件外贸商的询价审单 Agent。
- **产品形态**：桌面优先的 B 端 Web 应用，浏览器访问，不做小程序、不做 Electron、不做原生 App。
- **核心闭环**：读取邮件文本/Excel → 逐行抽取规格与证据 → 缺参/冲突/目录外阻断 → 目录硬过滤 → 确定性计价 → 人工审批 → CSV/PDF 导出 → 审计追溯。
- **5 天版范围**：一个产品族、33 个仿真 SKU、9 份询价、两种输入、两个核心业务页面 + 对话审单辅助、正常与异常三条演示链路。
- **技术栈（5 天版）**：React + Vite + TypeScript + Cloudflare Worker + Zod；D1 保存文档与文件归档，R2 为可选后端；模型走 DeepSeek OpenAI 兼容接口。Express + JSON 仅作离线回退。
- **当前状态**：MVP 主链路与三轮对话审单已实现并通过 46 个自动化测试；Worker + D1 已部署到 `wayknow.tech/quotesentry/api/`，文本/XLSX 上传、审批、CSV/PDF 和发送阻断均已通过线上验收。

## 硬性约束

- **桌面 Web 优先**：主界面按 1280px 以上桌面优化；移动端最多做只读摘要，不开发小程序。
- **不扩 5 天范围**：PDF 解析、自由改价/批量自然语言修订、双语 PDF、真实邮箱/ERP、多租户、复杂权限、embedding 均不属于 5 天版。
- **大模型不碰价格**：模型只能做抽取、解释、澄清草稿；价格、折扣、汇率、费用、毛利、合计只能由确定性代码计算。
- **大模型不碰 SKU 事实**：模型返回的 SKU 必须重新查目录并复核硬属性；目录外或冲突 SKU 必须阻断。
- **对话不做承诺动作**：对话只负责理解、补参和解释；审批、override、导出与外发必须由按钮触发、服务端复核、人工确认。
- **禁止自动外发**：`SEND_MODE=disabled` 时服务端必须拒绝发送；比赛版只做导出和模拟发送。
- **仿真数据默认**：演示目录、客户、价格、询价均为虚构，界面必须显示“仿真数据｜未连接真实 ERP/邮箱”。
- **状态由服务端控制**：前端按钮不能直接跳状态；审批、修订、导出必须在服务端复核门禁。
- **证据必须可回指**：字段证据至少包含原文片段 + 页码/工作表/行号；找不到证据的字段视为未验证。
- **规则模式必须标注**：模型不可用时，结构化 Excel/CSV 和邮件文本可以走确定性规则抽取，但界面必须明确显示“规则模式”，不得冒充 AI。
- **客户文件隔离**：客户 PDF/CSV 不得包含成本、毛利、内部备注、异常置信度、审批人信息。
- **不要修改 `work/wayknow` 的其他内容**：用户已授权维护 `work/wayknow/quotesentry/` 静态产物和对应部署文档；不要改站点导航、其他产品页或生产服务器，除非再次明确要求。
- **重要改动自动提交**：完成并验证一个重要模块、功能或提交材料后，自动提交并推送 `ai_agent_demo` 与 `work/wayknow/quotesentry/`；零散试验、未验证改动不单独提交。提交信息说明改了什么、验证了什么。
- **保留上游许可**：使用或复制 MIT 代码时必须保留原 LICENSE、版权声明，并新增 `NOTICE` 与 `docs/UPSTREAM.md`。

## 当前目录结构

```text
ai_agent_demo/
├── AGENTS.md                  # Agent 约定（本文件）
├── agent.md                   # 兼容入口，指向 AGENTS.md
├── README.md                  # 项目入口
├── project.md                 # 产品定义与 5 天范围
├── status.md                  # 当前进度与下一步
├── decisions.md               # 关键决策与原因
├── deploy.md                  # 本地运行与 wayknow 子目录部署
├── client/                    # React + Vite 前端
├── server/                    # Express 回退 + 可复用领域层
│   ├── domain/                # 抽取、门禁、匹配、计价、审批、审计
│   └── llm/                   # DeepSeek OpenAI 兼容网关
├── worker/                    # Cloudflare Worker、D1、可选 R2、Worker Auth
├── migrations/                # D1 Schema
├── shared/                    # 共享类型与 Schema
├── data/
│   ├── catalog/               # 仿真 SKU
│   └── samples/               # 仿真询价
├── tests/golden/              # 金标与关键测试
├── scripts/seed-check.ts      # 仿真样例自检
├── docs/UPSTREAM.md           # 上游来源与 commit
└── NOTICE                     # 参考来源与修改说明
```

## 技术约定

- **前端**：React + Vite + TypeScript；本项目使用自有 CSS 组件，不复制上游 UI 代码。
- **后端**：Cloudflare Worker + TypeScript；路由、状态、审批、审计集中在服务端。Express 仅作离线回退。
- **校验**：Zod 校验所有请求、模型输出和导出对象；模型输出先校验，再落库或渲染。
- **计价**：使用整数最小货币单位或 decimal 库；禁止直接使用浮点结果作为正式金额。
- **持久化**：生产使用 D1，文件默认以 BLOB 存在 `quote_artifacts`（单文件 ≤1 MB）；配置 R2 后自动切换为 R2。Express 本地回退使用单文件 JSON。
- **模型**：默认 DeepSeek OpenAI 兼容接口；密钥只在服务端读取，失败时显著降级规则模式。
- **UI 风格**：企业工具风格，浅色/中性色背景，表格与分栏优先；不要做聊天首页、营销大屏或夸张动画。
- **语言**：内部文档中文；产品界面中文；客户报价可英文或中英混排。

## 领域不变量

- `RFQDocument` 状态与 `RFQLine` 状态分离；文档状态由行状态聚合，不能因为一行缺参就丢掉其他可报价行。
- 行状态至少包含：`READY`、`NEEDS_CLARIFICATION`、`NO_MATCH`、`PRICED`、`MARGIN_ALERT`、`APPROVED`、`REJECTED`。
- 文档状态至少包含：`RECEIVED`、`EXTRACTING`、`NEEDS_REVIEW`、`PRICED`、`READY_FOR_APPROVAL`、`APPROVED`、`EXPORTED`、`FAILED`。
- 任何缺参、硬属性冲突、目录外、无效数量、缺失汇率、毛利越界，都不得进入正式报价。
- 审批接口必须重新校验报价状态、行状态、报价行一致性和 override 记录；修订后必须生成新版本并重新审批。
- 审计事件至少记录：输入哈希、模型名/版本、提示词版本、目录版本、规则版本、修改人、审批人、状态变化。

## 常见任务

### 新增 SKU

1. 更新 `data/catalog/fasteners.json`。
2. 补充或更新 `tests/golden/` 中的匹配与计价样例。
3. 确认 SKU 有唯一定价规则、成本、单位和生效版本。
4. 如果目录结构变化，同步更新 `project.md` 的数据模型说明。

### 新增询价样例

1. 在 `data/samples/` 新增仿真询价，明确标注虚构。
2. 在 `tests/golden/` 写明每行预期字段、应否澄清、可接受 SKU、是否拒识和预期金额。
3. 至少保留一个正常行、一个缺参行、一个目录外行。

### 修改计价规则

1. 先改 `server/domain/pricing.ts` 和金标测试。
2. 再改界面和文档；禁止只改界面数字。
3. 确认客户导出不包含成本、毛利和内部异常。

### 修改界面

- 保持两个核心业务页面：询价工作台/审单页、审批/导出页；对话审单是补参与解释的辅助视图，不是聊天首页。
- 对话不得自动审批、自动导出或自动外发；只能返回结构化结果和导航/下载动作。
- 不要用定时器伪造 Agent 进度；加载状态必须来自真实请求。
- 所有加载状态来自真实任务事件；模型失败要显示失败原因和重试入口。

## 修改后的自检

修改后至少执行：

```bash
npm run check
npm test
npm run build
npm run dev
curl -s http://127.0.0.1:3001/api/health
```

Worker 变更额外执行：

```bash
npm run db:migrate:local
npm run worker:dry-run
curl -s http://127.0.0.1:8787/api/health
```

另外检查：

```bash
rg -n 'sk-|DEEPSEEK_API_KEY|LLM_API_KEY|OPENAI_API_KEY' --glob '!*.md' --glob '!*.example'
rg -n 'TODO|FIXME|XXX' --glob '!decisions.md'
rg -n 'localhost|127.0.0.1' client/src
```

## 文档维护规则

| 改了什么 | 同步更新 |
|---|---|
| 产品范围、用户、流程 | `project.md` |
| 当前进度、阻塞、下一步 | `status.md` |
| 技术路线、命名、部署方式 | `decisions.md` |
| 启动、构建、环境变量、上线 | `deploy.md` |
| Agent 约束、目录结构、自检命令 | `AGENTS.md`（`agent.md` 仅保留入口） |

## 部署

- 前端产物构建到 `work/wayknow/quotesentry/`；API 部署到 Cloudflare Worker，由 Cloudflare Route 接管 `/quotesentry/api/*`。
- Worker 已通过 Cloudflare Route `wayknow.tech/quotesentry/api/*` 接入，不需要 Nginx 反代这个 API 路径。
- 前端只负责构建、提交并推送 `wayknow` 仓库；**不要尝试 SSH 登录服务器或触发 `git pull`**，生产服务器由用户手动拉取。
- 远程 secret、D1 迁移和重新部署需用户明确要求后执行，细节见 [deploy.md](deploy.md)。
- 不要把 `.dev.vars`、DeepSeek Key、D1 状态或本地 R2 文件提交到任一仓库。

## 许可与上游

- 上游参考：`AnshMNSoni/B2B-RFP-Agent`（MIT）。
- 当前实现为 greenfield thin slice，没有复制上游源码；pin commit 仅记录在 `docs/UPSTREAM.md`，不构成代码依赖。
- 备选参考：`gourav-shokeen/rfq-quote-agent`（MIT），只借鉴计价核心、异常清单和审批设计，不直接复制 n8n/印度税务实现。
- 任何修改版本都必须保留上游版权通知，并在 `NOTICE` 中说明关系与修改范围。
