# Key Decisions & Rationale

> 记录产品方向、技术路线和范围取舍。新增决策时追加编号，不覆盖历史。

## 1. 产品名为 QuoteSentry（报价哨兵）

**Decision**：使用 `QuoteSentry / 报价哨兵` 作为项目名。  
**Why**：“哨兵”强调主动检查与保护，比“守门员”更像 Agent，也不把产品锁死在紧固件。  
**Impact**：文档、UI、比赛材料统一使用新名字；旧名 QuoteGate 只作为历史参考。

## 2. 做桌面 Web 应用，不做小程序

**Decision**：产品形态为浏览器访问的 B 端 Web 应用，桌面优先。  
**Why**：核心流程是多文件上传、表格审阅、分栏对照、审批和 PDF/CSV 导出；小程序限制多、演示不稳。  
**Impact**：不做小程序、Electron、原生 App；移动端最多做只读审批摘要。

## 3. 5 天版只做一条垂直切片

**Decision**：一个产品族、33 个仿真 SKU、9 份询价、两种输入、两个核心业务页面 + 对话审单辅助、三条演示链路。
**Why**：原任务书范围按单人估算至少 3-4 周；5 天必须靠收窄换完成度。  
**Impact**：PDF 解析、自由改价/批量自然语言修订、双语 PDF、真实邮箱/ERP、embedding 全部移出 5 天版；对话仅支持有边界的补参与解释。

## 4. 采用 greenfield thin slice，复用思路而非源码

**Decision**：前端、API、Schema、门禁、匹配、计价、审批和审计均从头实现；上游项目只作为架构与交互参考。  
**Why**：上游线缆 RFP Demo 的领域假设差异过大，剥离成本高；thin slice 更容易保证证据、门禁和审批闭环。  
**Impact**：当前仓库没有复制上游源码，`NOTICE` 与 `docs/UPSTREAM.md` 记录参考关系；仍保留上游 MIT 来源披露。

## 5. D1 最终选择 TypeScript/Express 单仓实现

**Decision**：采用 React/Vite + Express + TypeScript + Zod 的 greenfield 单仓，不拉取 `ui-transformation` 或 `main` 作为代码基线。  
**Why**：上游分支与 5 天版所需领域模型不对齐；空仓实现更可控，也避免把线缆/印度税务逻辑带入演示。  
**Impact**：`client/`、`server/`、`shared/` 全部为本项目代码；上游 commit 仅作为调研记录，不构成代码依赖。

## 6. 价格只由确定性引擎计算

**Decision**：LLM 不得生成或修改 `price`、`total`、`cost`、`margin`、汇率、折扣和费用。  
**Why**：报价是财务输出，任何模型幻觉都可能造成真实损失。  
**Impact**：模型输出先过 Schema；报价对象只从计价引擎构造；测试必须覆盖“模型返回伪造价格被忽略”。

## 7. 默认不自动外发

**Decision**：`SEND_MODE=disabled` 时服务端永远拒绝发送；比赛版只做导出和模拟发送。  
**Why**：未经审批的客户外发是不可接受的风险。  
**Impact**：发送接口必须做服务端二次校验；界面显示“模拟发送/仅导出”，不得伪装已发送。

## 8. 证据用“原文片段 + 位置”，不做 bounding box

**Decision**：证据至少包含原文片段，以及页码/工作表/行号；5 天版不做 PDF 坐标高亮。  
**Why**：PDF 坐标定位成本高、稳定性差；原文子串校验已经足以支撑审单和演示。  
**Impact**：找不到原文子串的字段标为“未验证”，不能静默进入正式报价。

## 9. 文档状态与行级状态分离

**Decision**：`RFQDocument` 状态与 `RFQLine` 状态分开，文档状态由行状态聚合。  
**Why**：一封询价里可能一行可报价、一行缺参、一行目录外；单一文档状态无法表达。  
**Impact**：干净行可以继续计价；异常行进入澄清/拒识队列；避免整封询价被一行异常卡死。

## 10. 审批支持主管 override，但必须留痕

**Decision**：异常行默认阻断；主管可以 override，但必须填写原因并进入审计。  
**Why**：完全不可 override 会被业务绕开；无理由 override 又会让审批变成橡皮章。  
**Impact**：5 天版做简单 override 弹窗；风险分层和双人审批留到赛后。

## 11. 5 天版使用本地 JSON

**Decision**：演示版不引入 Postgres/多租户，使用单文件 JSON（`data/db.json`）。  
**Why**：Docker/数据库初始化会拖慢演示；审计和报价版本用追加事件即可。  
**Impact**：仓库层保持可替换；生产化时再评估 Postgres 和备份方案。

## 12. 只使用仿真数据

**Decision**：5 天版的目录、客户、价格、询价全部为虚构数据，并在界面和文档标注。  
**Why**：避免隐私、授权和“冒充真实客户成果”的风险。  
**Impact**：参赛材料不得出现真实客户名、未实测准确率、ROI 或融资承诺。

## 13. 5 天版不处理完整税/出口退税

**Decision**：MVP 计价只做目录价、阶梯、折扣、汇率、费用和模拟毛利；税/退税明确标注限制。  
**Why**：完整税务模型会显著扩大范围，且需要真实企业规则验证。  
**Impact**：界面写“税前/未计退税的模拟毛利”；不把模拟毛利说成真实财务口径。

## 14. 部署目标为 wayknow 站点下的 `/quotesentry/`

**Decision**：后续在 `work/wayknow` 站点下以 `/quotesentry/` 子目录接入，API 走同源 `/quotesentry/api/` 或独立子域。  
**Why**：用户已有站点和部署基础设施，子目录接入成本低于新建域名。  
**Impact**：Vite `base`、前端路由 `basename`、Nginx `location` 和 API 代理必须一起配置；部署前先本地验证子路径。

## 15. 保留 MIT 来源与修改说明

**Decision**：保留上游 LICENSE 和版权声明，新增 `NOTICE`、`docs/UPSTREAM.md` 和修改记录。  
**Why**：MIT 允许改造，但要求保留版权与许可；比赛材料也应主动披露来源。  
**Impact**：任何复制的代码/文档都要有来源记录；不要把“上游项目国内化”写成主要创新。

## 16. 演示固定为“三行询价、三种结果”

**Decision**：5 分钟 demo 固定展示一行可报价、一行待澄清、一行目录外，然后审批、导出、审计。  
**Why**：评委记住的是“能报的报准、不能报的停下”，不是功能数量。  
**Impact**：自由改价/批量自然语言修订、复杂图表和额外行业都不得挤占主演示时间。

## 17. DeepSeek 只负责字段抽取

**Decision**：默认 `deepseek-chat`，OpenAI 兼容 `/chat/completions`；模型只返回字段和原文片段。`deepseek-chat` 是 DeepSeek 的服务端模型别名，代码不写死 V3 或 V4 Flash。
**Why**：DeepSeek 的结构化输出足够支撑抽取，但不应拥有报价事实或财务计算能力。  
**Impact**：Zod 剥离未知字段；模型失败自动降级规则模式；Key 只在服务端读取。

## 18. 金额内部以“分”计算

**Decision**：CNY 金额内部使用整数分，数量阶梯、折扣、成本、毛利和合计都在整数分上完成，最后再转成展示金额。  
**Why**：避免浮点累计误差进入报价和导出。  
**Impact**：`server/domain/pricing.ts` 是唯一计价入口；金标测试覆盖舍入和毛利边界。

## 19. 演示状态可通过 URL 深链

**Decision**：支持 `?doc=seed-08&tab=approval` 打开指定询价和视图。  
**Why**：方便录屏、截图、评委复现和售后排障。  
**Impact**：前端 Tab/文档切换会同步 query string；不引入前端路由库。

## 20. 比赛版不带登录鉴权

**Decision**：本地演示不实现账号、权限、CSRF 和多租户；API 只绑定 `127.0.0.1`。  
**Why**：5 天版要把时间放在审单闭环，而不是身份系统。  
**Impact**：不得直接暴露公网；部署到 wayknow 前必须加反向代理鉴权或访问限制。

## 21. DeepSeek 接入沿用 app_survey 的服务端直连方式

**Decision**：使用 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`，由 Express 服务端直接请求 `https://api.deepseek.com/chat/completions`；与现有 `app_survey` 的请求方式保持一致。
**Why**：已有服务端已验证这条路可用，统一变量名和调用方式能减少部署时的配置分叉；Key 不进入浏览器也能避免泄露。
**Impact**：保留旧 `LLM_*` 变量兼容；新增 `npm run test:deepseek` 用于配置真实 Key 后验证端点和鉴权。

## 22. 正式部署迁移到 Cloudflare Worker + D1 + R2

**Decision**：生产形态改为 `wayknow/quotesentry` 静态前端 + Cloudflare Worker API；询价/报价/审批/审计写入 D1，上传原文与客户导出写入 R2。Express + `data/db.json` 保留为本地回退。

**Why**：用户要求沿用 `app_survey` 的部署方式；单台 Nginx 服务器不适合托管需要持久化和文件归档的 API。Worker 与现有 Cloudflare 基础设施一致，D1 省去数据库运维，R2 让原始询价和导出文件可追溯。

**Impact**：

- D1 `rfq_documents` 保存完整 `RfqDocument` JSON，避免过早拆表；`quote_artifacts` 记录 R2 key、大小和 SHA-256。
- R2 key 固定为 `rfqs/<documentId>/source/*` 与 `rfqs/<documentId>/exports/*`。
- Worker 复用 `server/domain/`，不复制计价、门禁、审批规则。
- DeepSeek Key 改为 Worker secret；`.dev.vars` 只用于本地且禁止提交。
- 前端通过 `/quotesentry/api` 同源访问，Nginx 反代到 Worker。
- 远程部署、D1/R2 创建和 Nginx 变更仍需用户明确要求后执行。

## 23. R2 推迟，当前使用 D1-only 文件归档

**Decision**：当前部署不启用 R2。上传原文和客户导出的字节写入 D1 `quote_artifacts.content`，单文件上限 1 MB；保留可选 R2 后端，开通后只需增加 `FILES` binding 即可切换。

**Why**：Cloudflare 账号开通 R2 需要绑定银行卡，用户当前不希望启用。Worker 部署不能绑定不存在的 bucket，因此 R2 会直接阻断上线。D1-only 能保留完整演示闭环，且不需要新增服务。

**Impact**：

- `wrangler.toml` 移除 R2 binding 并保留注释，增加 `wayknow.tech/quotesentry/api/*` Cloudflare Route。
- D1 migration `0002_d1_artifacts.sql` 新增 `storage_backend` 与 `content BLOB`。
- 健康检查线上返回 `storage: "d1"`。
- 大文件超过 1 MB 返回 `413 D1_FILE_TOO_LARGE`；比赛样例不受影响。
- 以后开通 R2 时恢复 binding 和 bucket 名，其余业务代码不需要改。

## 24. 对话只做补参与解释，不自动审批或导出

**Decision**：新增“对话审单”视图，支持至少三轮有效对话：首轮审单、按行补充规格并重算、解释异常原因。对话可以返回结构化行结果、报价摘要和动作建议，但不直接调用审批或导出。

**Why**：真实业务中需要自然语言补充缺参和追问原因，这比纯按钮更高效；但审批、override 和客户文件导出是承诺动作，不能让模型或聊天文本代替责任人。这样既能满足参赛的连续对话要求，又不会把产品变成“聊天指挥财务动作”的高风险形态。

**Impact**：

- `POST /api/rfqs/:id/chat` 只修改规格、证据和对话记录，不改变报价审批状态。
- 用户说“审批并导出 CSV”时，Agent 只返回“去报价审批”的动作按钮；实际审批仍走 `POST /api/rfqs/:id/approve` 和审批弹窗。
- 人工补充字段写入 `evidence.kind = "human"` 与 `CHAT_UPDATE` 审计事件。
- 已审批报价锁定，后续对话不得修改规格或价格。
- 不把聊天做成首页，也不使用定时器伪造 Agent 进度。
