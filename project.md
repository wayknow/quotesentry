# QuoteSentry（报价哨兵）

> 面向中国高混紧固件外贸商的询价审单 Agent：把混杂 DIN/ISO/GB 的多行询价，转成“可报价 / 待澄清 / 拒识”三类结果，并保留证据和审批链。

## 1. 一句话产品

QuoteSentry 读取外贸企业收到的邮件文本和 Excel 询价，逐行抽取产品规格并回指原文；能确认的行进入目录匹配和确定性计价，缺参、冲突、目录外或毛利越界的行被明确阻断，最终由人审批后才允许导出。

## 2. 目标客户

**第一批假设客户**：高混紧固件外贸商，而不是所有“标准件民营企业”。

- 500-5,000 个活跃 SKU；
- 5-20 个报价/业务人员；
- 每天 20+ 封多行询价；
- DIN、ISO、GB 标准混用；
- 有自有目录、客户价目表和毛利审批规则；
- 询价大量来自平台之外的邮件、PDF 和 Excel。

**用户**：外贸报价员/内销报价员。  
**付费人**：外贸经理、报价主管或老板。  
**购买理由**：减少漏项、错配和返工，让干净询价更快，让风险询价停下来。

> 以上客户假设必须在比赛前用 2-3 次访谈验证，不能直接当成市场结论。

## 3. 为什么紧固件值得做

标准件看起来简单，但真实报价里有几类高频错误：

- 客户只写“M12 bolt 8.8”，缺少长度、表面处理、螺纹类型或标准；
- DIN、ISO、GB 存在可对应但不完全等价的规格；
- 相似 SKU 很多，材质、强度、表面处理和公差不能混用；
- 客户有专属价目表、数量阶梯、币种和贸易术语；
- “same as last time”没有上下文，不能靠模型猜；
- 报错一次的返工、空运和客户信任损失，远高于报价本身。

QuoteSentry 的价值不是“生成一封报价邮件”，而是判断：**这一行能不能报、该匹配哪个 SKU、价格从哪来、异常该找谁、审批后能不能发。**

## 4. 5 天版范围

### 必做

- 一个产品族：六角螺栓（后续可扩螺母、垫圈、螺钉）。
- 33 个仿真 SKU，包含相近但不可互换的规格。
- 9 份仿真询价，覆盖正常、缺参、目录外、单位冲突、毛利越界和“same as last time”。
- 两种输入：XLSX 上传 + 粘贴邮件文本。
- 逐行抽取、字段证据、缺参/冲突检测。
- 目录硬过滤、无匹配、等价 SKU 稳定选择。
- 确定性计价：数量阶梯、客户折扣、汇率、费用、毛利底线。
- 人工审批、主管 override（必须填原因）、CSV/PDF 导出、审计时间线。
- 两个核心业务页面：询价工作台/审单页、审批/导出页；增加“对话审单”辅助视图，用于连续补参与解释。
- 51 个关键测试：计价金标、缺参阻断、目录外阻断、模型价格字段剥离、模型白名单、发送禁用、导出隔离。

### 暂缓

- PDF 解析、扫描件 OCR、CAD 图纸；
- 自由改价/批量自然语言修订、双语 PDF 排版；
- 真实邮箱、企业微信、ERP、库存、物流接口；
- embedding/向量库、多租户、复杂权限、移动 App；
- 完整税/出口退税模型（5 天版只做模拟毛利，并在界面标注口径）。

## 5. 用户流程

```text
上传 XLSX / 粘贴邮件
  → 逐行抽取规格
  → 字段证据回指原文
  → 完整性门禁
  → 目录硬过滤
  → 候选排序
  → 确定性计价
  → 毛利/风险校验
  → 人工审批或 override
  → 导出客户 CSV/PDF
  → 审计时间线
```

### 三种结果

| 结果 | 条件 | 系统行为 |
|---|---|---|
| 可报价 | 必填字段齐全、证据已验证、目录内有硬匹配、毛利达标 | 生成报价草稿，进入审批 |
| 待澄清 | 缺参、冲突、单位不合法、歧义 | 不生成正式价格，生成英文澄清草稿 |
| 拒识 | 目录外 SKU、硬属性冲突、毛利越界且无 override | 不进入正式报价，显示机器可读原因 |

## 6. 产品原则

- **先效率，后风控**：干净询价要更快通过；只有风险行才进入异常队列。
- **证据优先**：每个字段能回指原文；找不到证据就不算已确认。
- **拒绝也是能力**：无匹配必须显示“无匹配”，不能因为相似度最高就硬选。
- **模型只做辅助**：模型做抽取、解释和澄清草稿；价格、SKU 事实、状态和审批由代码控制。
- **对话只做表达，不做承诺**：对话负责理解、补参和解释；审批、override、导出与外发必须由按钮触发、服务端复核、人工确认。
- **人工负责最后一步**：审批人看到客户报价、内部成本、毛利、异常和规则版本，再决定是否导出。
- **审计可追溯**：每次模型调用、规则版本、修改、审批和导出的记录都可查。

## 7. 架构

```text
┌──────────────────────────────┐
│ React + Vite + TypeScript    │
│ 审单页 / 审批页 / 审计 tab   │
└──────────────┬───────────────┘
               │ /quotesentry/api
┌──────────────▼───────────────┐
│ Cloudflare Worker API        │
│ 上传 / 解析 / 状态 / 审批    │
└──────┬──────────┬────────────┘
       │          │
┌──────▼─────┐ ┌──▼──────────────────┐
│ LLM 网关   │ │ 确定性领域服务       │
│ 抽取/解释  │ │ 门禁/匹配/计价/风险  │
└────────────┘ └──┬──────────────────┘
                  │
          ┌───────▼────────┐      ┌──────────────┐
          │ D1             │      │ R2（可选）   │
          │ 报价/审批/审计 │      │ 原文/导出    │
          └────────────────┘      └──────────────┘
```

Express + 本地 JSON 仅作为离线开发回退，生产与 wayknow 部署使用 Worker + D1；R2 是后续可选归档后端。

### 可复用与必须重写

**复用上游基础设施**：React/Vite、UI 组件、文件上传、XLSX 文本解析、路由骨架、健康检查、构建配置；PDF 解析代码可保留，但 5 天版不启用。

**必须重写**：RFQ/行级 Schema、证据定位、完整性门禁、目录硬过滤、确定性计价、状态机、审批、审计、导出、紧固件仿真目录与测试。

**只参考不复制**：`rfq-quote-agent` 的 `priceLines` 设计、异常清单、毛利提醒、客户 PDF 隔离和审批消息结构。

## 8. 数据模型（MVP）

```text
RFQDocument
- id, filename, sourceType, rawText, inputHash, status, createdAt
- agentTurns[]: user/assistant 文本、结构化 payload、动作建议

RFQLine
- id, documentId, lineIndex, rawText, evidenceRefs[]
- productType, standard, diameter, length, threadPitch
- material, strengthGrade, surfaceTreatment, quantity, unit
- status, missingFields[], conflicts[], matchedSku, confidence

CatalogSKU
- sku, revision, productType, standards[], material, strengthGrade
- diameterRange, lengthRange, surfaceTreatment, unit, moq
- unitCostCny, baseExwPriceCny, quantityTiers[], active

PricingRuleSet
- id, version, currency, cnyPerUnitCurrency
- customerDiscount, quantityTiers, feeRules, minimumMargin
- roundingRule, validUntil

Quote / QuoteLine
- sourceRfqLineId, sku, catalogRevision, quantity
- unitPrice, lineNet, fees, total, currency
- pricingRuleVersion, calculationTrace

AuditEvent
- eventId, documentId, quoteId, eventType, actor
- modelName, promptVersion, schemaVersion, catalogRevision
- pricingRuleVersion, inputHash, outputHash, createdAt
```

`confidence` 只作分诊信号，不能覆盖硬规则失败。证据应区分“直接抽取 / 规范化 / 推断 / 人工填写”。

## 9. 计价模型（5 天版）

```text
netUnitPriceCny = baseExwPriceCny × quantityTierFactor × customerDiscount
lineNetCny      = netUnitPriceCny × normalizedQuantity
netSalesCny     = Σ lineNetCny
totalCostCny    = Σ(catalog.unitCostCny × normalizedQuantity) + configuredFeesCny
margin          = (netSalesCny - totalCostCny) / netSalesCny
foreignAmount   = cnyAmount / cnyPerUnitCurrency
```

- 金额使用整数最小货币单位或 decimal 库。
- 汇率、费用、折扣和最低毛利必须带版本。
- 5 天版不处理完整税/出口退税；界面明确标注“税前/未计退税的模拟毛利”。
- 任何模型返回的 `price`、`total`、`cost`、`margin` 字段一律忽略。

## 10. 演示脚本

**第一幕**：一封 3 行询价。

- 第 1 行：完整规格 → 匹配成功 → 生成报价草稿。
- 第 2 行：缺少表面处理/强度等级 → 待澄清 → 生成英文问题。
- 第 3 行：目录外材质或规格 → 无匹配 → 不生成正式价格。

**第二幕**：审批第 1 行。

- 展示客户可见内容与内部成本/毛利分栏；
- 证明客户 PDF 不含内部信息；
- 点击批准，导出 CSV/PDF。

**第三幕**：审计。

- 展示模型版本、目录版本、规则版本、修改人、审批人和状态变化；
- 用一句话收尾：不是让 AI 乱报价，而是让每一次报价都有证据、有边界、有人负责。

## 11. 指标

### 5 天版工程指标

- 金标价格一致率 100%；
- 缺参、目录外、幻觉 SKU 进入正式报价的数量为 0；
- `SEND_MODE=disabled` 时发送接口 100% 拒绝；
- 客户导出中成本/毛利泄露为 0；
- 所有展示字段可回指真实原文；
- 三条演示链路可重复运行。

### 赛后商业验证指标

- 3 家设计伙伴；
- 50-100 份真实脱敏询价；
- 人工原流程 vs Agent 流程的耗时、漏项率、返工率；
- 至少 1-2 家愿意付费试点；
- 单家目录初始化成本和报价员采用率。

## 12. 护城河

不是“用了大模型”，而是：

- 企业私有目录和客户价目表；
- 跨 DIN/ISO/GB 的等价关系与不可替代差异；
- 人工纠错、异常类型和审批规则沉淀的数据；
- 报价版本、证据链和审计带来的责任闭环；
- 与 ERP/CRM/邮箱的轻集成能力。

大模型会吃掉翻译、抽取和草稿；QuoteSentry 要守住的是**企业报价决策的工作流和数据**。

## 13. 5 天计划与当前状态

| 天 | 目标 | 状态 |
|---|---|---|
| D1 | 定 Schema、准备 33 SKU 和 9 份询价、可点击骨架 | ✅ 完成 |
| D2 | 抽取 + 原文证据 + 行级状态 + 缺参/冲突门禁 | ✅ 完成 |
| D3 | 目录硬过滤 + 确定性计价 + 金标测试 + 审批状态 | ✅ 完成 |
| D4 | 审单界面、审批/override、CSV/PDF 导出、审计时间线 | ✅ 完成 |
| D5 | 真实 DeepSeek smoke test、录 3 分钟以内 demo、参赛说明 | ✅ 完成 |

**当前结论**：已采用 greenfield thin slice，主链路、三轮对话补参、51 个测试、Flash / V4 Pro 模型选择、真实模型调用、Worker + D1 线上链路、2 分 50 秒参赛视频、A4 一页纸和 8 模块提交材料均已完成；剩余工作是签署身份材料、填写真实联系人信息并发送提交邮件。

## 14. 相关文档

- [status.md](status.md)：当前进度、风险和下一步。
- [decisions.md](decisions.md)：关键技术/产品决策及原因。
- [deploy.md](deploy.md)：本地运行与 wayknow 子目录部署。
- [docs/DEMO.md](docs/DEMO.md)：固定演示脚本、预期结果和故障兜底。
- [docs/PITCH.md](docs/PITCH.md)：一页纸结构与路演问答。
- [demo/QuoteSentry-one-pager.pdf](demo/QuoteSentry-one-pager.pdf)：A4 单页路演稿，严格 1 页。
- [demo/QuoteSentry-one-pager.png](demo/QuoteSentry-one-pager.png)：一页纸高清预览图。
- [demo/QuoteSentry-demo-zh.mp4](demo/QuoteSentry-demo-zh.mp4)：2 分 50 秒中文旁白演示视频（含三轮对话）。
- [AGENTS.md](AGENTS.md)：Agent 编码约束与自检。
