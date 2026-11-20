# Upstream Sources

> 记录本项目参考/引入的上游仓库、分支、commit、许可和复用边界。引入代码后必须继续更新本文件。

## 1. 主上游：B2B-RFP-Agent

- Repository: `https://github.com/AnshMNSoni/B2B-RFP-Agent`
- License: MIT, `Copyright (c) 2025 ansh.mn.soni`
- Inspected: 2026-11-20
- Default branch inspected: `main`
- `main` commit: `c38adade63bea45555836bf62e51345817c924a6`
- TypeScript/Express branch: `ui-transformation`
- `ui-transformation` commit: `32530b56aad2cd4c74f4b9123bdd5166fb548bd1`
- `scale` / `fix-scale` commit: `abede1588016662f4d7cfdec6c7b2ccb79ca23d6`

### 实际状态

- `main` 已迁移为 React + FastAPI + LangGraph，后端在 `backend/`；README 仍残留 Express/TypeScript 描述。
- `ui-transformation` 保留 `server/` 的 TypeScript/Express 实现，包含 `server/agents/`、`server/routes.ts`、`server/services/documentParser.ts`。
- `main` 有 Dockerfile、SSE 流式接口和 pytest 基线；`ui-transformation` 没有测试和持久化。
- 两版都是线缆 RFP Demo：文档级摘要、Top 3 SKU 匹配、线缆定价、无审批/审计/数据库。

### 实际复用

- 仅参考产品架构、审单优先的交互思路和“文档先解析、再做结构化”的流程。
- 当前仓库没有复制上游源码、组件、样式或配置。

### 本项目独立实现

- 紧固件 RFQ Schema、逐行抽取、证据回指、完整性门禁、目录硬过滤、整数分计价、审批/override、审计和 CSV/PDF 导出。
- 文档级摘要改为行级结果；Top 3 相似匹配改为“硬匹配或明确无匹配”。
- React/Vite 页面、Express API 和构建配置均为本仓库自有代码。

## 2. 设计参考：rfq-quote-agent

- Repository: `https://github.com/gourav-shokeen/rfq-quote-agent`
- License: MIT, `Copyright (c) 2026 Gourav Shokeen`
- Commit inspected: `712cdc93061829a7c0d1c76accab515d902d82e5`
- Inspected: 2026-11-20

### 参考内容

- 一个 `priceLines` 计价核心同时服务首次报价和修订报价。
- LLM 只返回 SKU/置信度，不返回价格。
- 异常清单、低置信度、库存、毛利提醒、客户 PDF 隔离。
- 审批消息同时展示客户报价与内部风险。

### 不复用内容

- n8n workflow 生成器、Gmail/Sheets/Telegram/LlamaParse 依赖。
- 印度 GST/HSN/INR 计价与税务实现。
- 未经验证的行业统计数字。

## 3. 许可处理

- 本项目当前没有复制上述仓库代码；如果未来复制，必须保留对应 LICENSE 和版权通知，并更新 `NOTICE`。
- 新增/更新 `NOTICE`，说明 QuoteSentry 与上游作者无背书关系。
- 比赛材料和 README 主动披露上游来源、修改范围和使用方式。
