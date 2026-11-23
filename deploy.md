# Deployment Guide

> 当前状态：前端与 Worker + D1 已上线；R2 未开通，文件默认归档在 D1；DeepSeek 线上 Key 已配置，实时抽取已完成线上验收。

## 1. 当前线上形态

```text
https://wayknow.tech/quotesentry/
  → wayknow 静态前端（仓库目录 quotesentry/）

https://wayknow.tech/quotesentry/api/*
  → Cloudflare Route（拦截请求，不进入 Nginx）
  → Worker: quotesentry-api
  → DeepSeek（配置 Key 后）/ D1
```

- Worker 直连域名：`https://quotesentry-api.jinchanghu1982.workers.dev`（本机网络可能无法直连，以自定义 Route 为准）。
- D1：`quotesentry-db`，`database_id=46d5a6cd-e959-486a-879a-72e3a0939b62`。
- Cloudflare Route：`wayknow.tech/quotesentry/api/*`。
- R2：未开通，不参与当前部署。
- 本地回退：Express + `data/db.json`，不作为生产存储。

## 2. 数据存储

### D1

| 表 | 内容 |
|---|---|
| `rfq_documents` | 完整 `RfqDocument` JSON，以及 id、状态、客户、更新时间等检索列 |
| `quote_artifacts` | 上传原文与客户导出的元数据、SHA-256、可选 R2 key、D1 BLOB |

当前 `storage_backend=d1`：

- 上传原文、客户 CSV/PDF 的字节都存在 `quote_artifacts.content`。
- 单文件上限 1 MB；超过时返回 `413 D1_FILE_TOO_LARGE`。
- 询价正文本身另存于 `rfq_documents.payload`，刷新后可从 D1 恢复。

### R2（后续可选）

`worker/artifacts.ts` 已支持 R2：只要 `wrangler.toml` 配置 `FILES` binding，文件会自动改存 R2，D1 继续保存索引。当前账号未开通 R2，部署时不能保留未创建的 bucket binding。

## 3. 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
# 可选：填入 DEEPSEEK_API_KEY；留空为规则模式
npm run db:migrate:local
npm run dev:worker
```

- Worker API：`http://127.0.0.1:8787/api/health`
- Express 回退：`npm run dev` 或 `npm start`
- `.dev.vars` 已被 git 忽略。

## 4. 前端构建与发布

```bash
npm run check
npm test
npm run build:wayknow
```

构建直接写入：

```text
../wayknow/quotesentry/index.html
../wayknow/quotesentry/assets/*
```

提交并推送 `wayknow` 仓库后，服务器执行：

```bash
ssh ubuntu@43.160.219.45 "cd /var/www/html && sudo git pull"
```

`quotesentry/` 是独立页面，不在主导航、页脚或 sitemap 中。

## 5. Worker 部署

```bash
npm run db:migrate:remote
npm run worker:dry-run
npm run worker:deploy
```

Worker 部署应包含：

- `env.DB` → `quotesentry-db`
- Route `wayknow.tech/quotesentry/api/*`
- `APP_MODE=demo`
- `SEND_MODE=disabled`

## 6. DeepSeek 配置

当前线上已配置 Key，`/quotesentry/api/health` 返回 `engine: "llm"`、`llmConfigured: true`。重新配置时使用：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

可用变量：

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=45000
DEEPSEEK_MAX_RETRIES=1
```

线上已验证 `seed-08`：`PRICED / NEEDS_CLARIFICATION / NO_MATCH`，证据 26/26，客户金额 USD 465.00。Key 不进入前端、D1、日志或导出文件。

## 7. 可选 Basic Auth

```bash
npx wrangler secret put BASIC_AUTH_USER
npx wrangler secret put BASIC_AUTH_PASSWORD
```

- 两项必须同时配置；只配置一项时 API 返回 500。
- Worker 认证只保护 `/quotesentry/api/`，不保护静态页。
- 如要保护静态页，需在 wayknow Nginx 对 `/quotesentry/` 增加 `auth_basic`，不要与 Worker Basic Auth 同时启用。
- 当前演示未配置 Basic Auth。

## 8. 为什么不改 Nginx

API 已通过 Cloudflare Route 在 CDN 层接管 `wayknow.tech/quotesentry/api/*`，请求不会落到 Nginx。因此当前只需静态前端部署，不需要增加 `/quotesentry/api/` 的 `proxy_pass`。

如果以后不再使用 Cloudflare Route，再回退到 Nginx 反代 Worker。

## 9. 验收清单

- [x] `npm run check` 通过。
- [x] `npm test`：8 files / 41 tests 通过。
- [x] `npm run worker:dry-run` 通过。
- [x] 线上静态页 `/quotesentry/` 返回 200。
- [x] 线上 `/quotesentry/api/health` 返回 200，`storage=d1`。
- [x] 线上 bootstrap 返回 9 份样例与 33 个 SKU。
- [x] 线上 `seed-08`：`PRICED / NEEDS_CLARIFICATION / NO_MATCH`，26 条证据，USD 465.00。
- [x] 线上审批成功，整单毛利 21.09%。
- [x] 线上 CSV 310 字节、无成本/毛利字段；PDF 为合法 `%PDF-1.7`。
- [x] 线上 `POST /send` 返回 403 `SEND_DISABLED`。
- [x] 线上文本上传写入 D1，`quote_artifacts.storage_backend=d1`。
- [x] 配置 DeepSeek Key 后复测实时 LLM 抽取：`engine=llm`、`seed-08` 三行状态与 USD 465.00 均正确。

## 10. 已知风险

- 首次访问静态 JS/CSS 偶发较慢，需在比赛前复查 Cloudflare 缓存和现场网络。
- D1 单文件上限 1 MB，不适合大 Excel；比赛样例均远低于上限。
- D1 备份、配额和恢复演练尚未完成。
- API 当前未启用 Basic Auth，正式公开前应加保护。
