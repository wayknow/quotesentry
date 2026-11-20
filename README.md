# QuoteSentry（报价哨兵）

> 面向中国高混紧固件外贸商的询价审单 Agent。桌面优先 Web 应用。

## 当前状态

MVP 已可运行：33 个仿真 SKU、9 份仿真询价、邮件文本 + Excel/CSV 输入、逐行证据、目录硬匹配、确定性计价、人工审批、毛利 override、CSV/PDF 导出和审计时间线。

```bash
npm install
npm run dev
```

- 前端：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:3001`
- 生产构建：`npm run build && npm start`，访问 `http://127.0.0.1:3001`

DeepSeek 默认走 OpenAI 兼容接口。复制 `.env.example` 为 `.env`，填入 `DEEPSEEK_API_KEY` 后重启服务端即可；Key 只由 Express 服务端读取，不进入浏览器。未配置 Key 时界面明确显示“规则模式”，不会冒充 AI。配置后可运行 `npm run test:deepseek` 做一次真实连通性 smoke test。

## 产品一句话

QuoteSentry 读取邮件文本和 Excel 询价，逐行抽取规格并回指原文；能确认的行进入目录匹配和确定性计价，缺参、冲突、目录外或毛利越界的行被明确阻断，最终由人审批后才允许导出。

## 演示主场景

打开 `演示主场景 · 三行询价`（`seed-08`）：

1. `M12x75 8.8 ZN` → 目录硬匹配 → 确定性计价 → 可审批。
2. `M12x75 8.8` 缺表面处理 → 待澄清，不生成正式价格。
3. `M14x60` → 目录无匹配，不硬选相似 SKU。

然后进入“报价审批”查看客户视图与内部成本/毛利隔离；审批后导出 CSV/PDF，在“审计时间线”核对模型、规则版本、哈希和责任人。

## 核心安全边界

- LLM 只做字段抽取；价格、折扣、汇率、费用、毛利、合计全部由确定性代码计算。
- LLM 返回的原文片段必须能在询价中找到，否则标为未验证并阻断。
- 模型返回的 SKU/价格字段不参与业务事实，SKU 只来自目录硬过滤。
- `SEND_MODE=disabled` 时服务端始终拒绝发送；比赛版只允许审批后导出。
- 客户 CSV/PDF 不含成本、毛利、内部异常、审批人或模型信息。
- 所有客户、SKU、价格和询价均为仿真数据，界面固定展示演示横幅。

## 技术栈

- 前端：React 18 + Vite + TypeScript，桌面优先。
- 后端：Express + TypeScript + Zod。
- 模型：DeepSeek OpenAI 兼容接口；失败时降级规则抽取并显著标注。
- 数据：本机 JSON 持久化，`POST /api/reset-demo` 可重置演示。
- 文件：`xlsx` 解析 Excel，`pdf-lib` 生成客户 PDF。

## 常用命令

```bash
npm run dev       # 同时启动 Vite 和 Express
npm run check     # TypeScript 类型检查
npm test          # 31 个金标/领域测试
npm run test:deepseek  # 用真实 Key 直连 DeepSeek 做 smoke test
npm run seed      # 校验 9 份仿真询价均可识别
npm run build     # 生产构建
npm start         # 运行生产构建 + API
```

## 目录

```text
client/               React 工作台
server/               API、领域规则、DeepSeek 网关、导出
server/domain/        抽取、门禁、硬匹配、计价、审批、审计
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
| [AGENTS.md](AGENTS.md) | 面向编码 Agent 的仓库约束与自检 |

## 当前限制

- DeepSeek 服务端连通性、`seed-08` 真实 LLM 抽取、审批和导出已实测通过；仍需准备规则模式录屏兜底。
- 不做 PDF 原文件解析、OCR、真实邮箱/ERP、多租户、登录权限。
- 毛利为税前、未计出口退税的演示口径。
- JSON 持久化与无鉴权 API 只适合本地演示，不适合直接暴露公网。

## 上游与许可

- 设计与架构参考：`AnshMNSoni/B2B-RFP-Agent`（MIT）、`gourav-shokeen/rfq-quote-agent`（MIT）。
- 当前实现为 greenfield thin slice，尚未复制上述仓库源码；详见 [docs/UPSTREAM.md](docs/UPSTREAM.md) 与 [NOTICE](NOTICE)。
