# Project Status

> Last updated: 2026-11-20

## 总览

| 项目 | 状态 |
|---|---|
| 产品方向 | ✅ QuoteSentry（报价哨兵） |
| 产品形态 | ✅ 桌面优先 Web 应用 |
| 5 天 MVP 范围 | ✅ 已冻结 |
| 技术底座 | ✅ React + Vite + TypeScript + Express + Zod + JSON |
| 代码实现 | ✅ 主链路可运行 |
| Demo 数据 | ✅ 33 SKU / 9 份仿真询价 / 3 客户 |
| 自动化测试 | ✅ 31 个测试通过 |
| DeepSeek 实调用 | ✅ 服务端直连 smoke 已通过 |
| wayknow 部署 | ⏳ 未执行；按 deploy.md 手工接入 |
| 比赛录屏/路演材料 | ⏳ 待制作 |

## ✅ Done

- 建立 React/Vite 桌面工作台与 Express API。
- 实现邮件文本、CSV、XLSX 三种上传/输入路径。
- 实现 DeepSeek OpenAI 兼容网关：服务端直连、JSON 校验、超时、有限重试、代码块兼容、失败降级。
- 对齐 `app_survey` 的服务端接入方式：`DEEPSEEK_API_KEY` + `Bearer` + `https://api.deepseek.com/chat/completions`，并提供真实 Key smoke 命令。
- 用真实 Key 完成服务端直连 smoke：HTTP 请求成功并返回合法 JSON，确认端点、鉴权和模型名可用。
- 实现逐行抽取、原文回指、缺参/冲突/单位门禁、目录硬匹配。
- 实现整数分为单位的确定性计价：数量阶梯、客户折扣、汇率、固定费用和毛利底线。
- 实现三行询价（可报价 / 待澄清 / 目录外）并行处理，异常行不拖死整封询价。
- 实现人工审批、毛利 override（强制原因）、审计时间线。
- 实现审批后的客户 CSV/PDF 导出，内部成本/毛利不进入客户文件。
- 实现 `SEND_MODE=disabled` 服务端拒绝外发。
- 实现演示数据重置、健康检查、bootstrap、询价 CRUD 与导出 API。
- 完成 1440px 桌面浏览器渲染检查。

## 验证结果

```text
npm run check    ✅
npm test         ✅ 5 files / 31 tests
npm run seed     ✅ 9/9 samples recognized
npm run build    ✅
```

手动验证：

- `seed-08`：`PRICED / NEEDS_CLARIFICATION / NO_MATCH`，报价仅含 1 条可报行。
- `seed-06`：毛利越界时审批返回 409；override 后可审批。
- `seed-01` / `seed-07` / `seed-09`：干净询价全部可进入审批。
- CSV 导出不含 margin/cost/毛利/成本等字段。
- PDF 返回合法 `%PDF` 文件。
- `POST /send` 在 `SEND_MODE=disabled` 时返回 HTTP 403。
- XLSX 上传后可完成表头规则抽取和计价。

## 🚧 In Progress

- 用真实询价做一次 LLM 抽取回归，确认字段、证据回指和降级提示符合预期。
- 录制 3-5 分钟演示视频。
- 制作比赛一页纸：问题、客户、演示、边界、商业化。

## ⏳ Pending

| 任务 | 完成定义 |
|---|---|
| 真实询价 LLM 回归 | 同一份邮件切换到 LLM 模式，保留原文证据并跑完审批链路 |
| 演示录屏 | 三行询价 → override / 审批 → CSV/PDF → 审计，全链路无手工修数据库 |
| wayknow 子路径 | 先本地 `VITE_BASE_PATH=/quotesentry/` 验证，再改 Nginx |
| 路演材料 | 不宣称真实客户 ROI；明确仿真数据和规则口径 |

## ⚠️ Risks

| 风险 | 影响 | 应对 |
|---|---|---|
| 现场网络/限流 | 演示时模型调用可能超时 | 已通过 API smoke；保留规则模式与录屏兜底 |
| 模型输出漂移 | 字段缺失或证据不对齐 | Zod 校验 + 原文子串验证 + 失败降级 |
| JSON 文件持久化 | 并发/生产可靠性不足 | 仅用于本地演示；生产换数据库 |
| API 无鉴权 | 不可公网裸露 | 部署在受控内网/Nginx 鉴权后 |
| xlsx 依赖安全告警 | 恶意表格风险 | 只接收可信文件；生产加隔离解析/病毒扫描 |
| 极端低价毛利率展示 | 毛利率可能小于 -100% | UI 显示真实数字；路演明确这是模拟口径 |

## 下一步

1. 用 `seed-08` 跑一次真实 LLM 抽取，核对字段、证据回指和降级提示。
2. 用 `seed-08` 录制主演示，用 `seed-06` 录 override 分支。
3. 确认是否接入 `work/wayknow` 的 `/quotesentry/` 子目录；未确认前不修改站点。
