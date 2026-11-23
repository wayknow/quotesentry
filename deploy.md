# Deployment Guide

> 当前状态：Worker + D1 + R2 已在本机（Wrangler local）完成全链路验证；尚未执行远程 Cloudflare 部署，也尚未配置 wayknow 生产 Nginx。

## 1. 目标形态

```text
https://wayknow.tech/quotesentry/
  → wayknow 静态前端（work/wayknow/quotesentry）

https://wayknow.tech/quotesentry/api/
  → Nginx 反向代理
  → Cloudflare Worker: quotesentry-api
  → DeepSeek / D1 / R2
```

- 前端：React + Vite，构建到 `../wayknow/quotesentry`，`base=/quotesentry/`。
- API：Cloudflare Worker，`worker/index.ts`，与 `app_survey` 一样由服务端读取 DeepSeek Key。
- 数据库：D1 保存询价文档、报价、审批和审计的完整 JSON；`quote_artifacts` 保存 R2 文件索引。
- 文件：R2 保存上传原文与审批后的客户 CSV/PDF。
- 本地回退：`server/` 的 Express + `data/db.json` 仍可运行，用于离线开发与对比，不作为生产存储。

## 2. 首次配置 Cloudflare

先在本机登录 Wrangler。服务器是无头环境，所有 `wrangler` 命令都应在有浏览器的 Mac 上执行。

```bash
npx wrangler login
```

创建 D1，并把输出的 `database_id` 写进 `wrangler.toml`：

```bash
npx wrangler d1 create quotesentry-db
```

仓库中的占位值是 `00000000-0000-0000-0000-000000000000`，只适用于本地模拟。

创建 R2：

```bash
npx wrangler r2 bucket create quotesentry-files
```

执行迁移：

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

配置 DeepSeek Key（不会进入仓库或浏览器）：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

## 3. 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入 DEEPSEEK_API_KEY；留空则显示规则模式
npm run db:migrate:local
npm run dev:worker
```

- Worker API：`http://127.0.0.1:8787/api/health`
- Express 回退：`npm run dev` 或 `npm start`
- `.dev.vars` 已被 git 忽略，不能提交真实 Key。

快速检查：

```bash
curl -s http://127.0.0.1:8787/api/health | jq
curl -s http://127.0.0.1:8787/api/bootstrap | jq '.documents | length'
curl -s -X POST http://127.0.0.1:8787/api/rfqs/seed-08/analyze | jq '.lines[].status'
```

## 4. 构建到 wayknow

```bash
npm run check
npm test
npm run build:wayknow
```

构建结果直接写入：

```text
../wayknow/quotesentry/index.html
../wayknow/quotesentry/assets/*
```

该目录只包含前端产物，不包含 Worker 源码、测试、仿真目录源文件或 Key。

## 5. 部署 Worker

```bash
npm run worker:dry-run
npm run worker:deploy
```

部署后记录 Wrangler 输出的 Worker hostname，例如：

```text
https://quotesentry-api.<account>.workers.dev
```

## 6. wayknow Nginx

在 wayknow 服务器的 Nginx 配置中加入下面两段；长前缀必须位于通用静态 `location /` 之前：

```nginx
location /quotesentry/api/ {
    proxy_pass https://<quotesentry-worker-host>/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /quotesentry/ {
    try_files $uri $uri/ /quotesentry/index.html;
}
```

验证并重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 7. 可选 Basic Auth

预发演示建议开启认证。Worker 支持与 Express 相同的变量：

```bash
npx wrangler secret put BASIC_AUTH_USER
npx wrangler secret put BASIC_AUTH_PASSWORD
```

- 两项必须同时配置；只配置一项时 API 返回 500，属于配置失败而不是放行。
- Worker 认证只保护 `/quotesentry/api/`；如要同时保护静态页面，在 Nginx 对 `/quotesentry/` 配置 `auth_basic`。
- 不要同时在 Nginx 和 Worker 启用，避免双重认证。
- 这是预发保护，不是正式账号、角色或租户体系。

## 8. 数据布局

### D1

| 表 | 内容 |
|---|---|
| `rfq_documents` | 完整 `RfqDocument` JSON，以及 id、状态、客户、更新时间等检索列 |
| `quote_artifacts` | R2 对象索引：文档、报价、类型、格式、key、大小和 SHA-256 |

### R2

```text
rfqs/<documentId>/source/<filename>
rfqs/<documentId>/exports/quotesentry-<documentId>.csv
rfqs/<documentId>/exports/quotesentry-<documentId>.pdf
```

客户 CSV/PDF 不包含成本、毛利、内部异常、置信度或审批人信息。

## 9. 验收清单

- [ ] `npm run check` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run worker:dry-run` 通过。
- [ ] 本地 `/api/health` 返回 `storage: "d1+r2"`。
- [ ] `seed-08` 为 `PRICED / NEEDS_CLARIFICATION / NO_MATCH`，客户金额 USD 465.00。
- [ ] `seed-06` 审批前 409，override 后可审批。
- [ ] `POST /send` 在 `SEND_MODE=disabled` 时返回 403。
- [ ] 文本与 XLSX 上传均写入 R2，询价可在刷新后从 D1 读回。
- [ ] CSV 不含 margin/cost/毛利/成本字段，PDF 以 `%PDF` 开头。
- [ ] `/quotesentry/` 静态资源加载成功。
- [ ] `/quotesentry/api/health` 经 Nginx 返回 200。

未经用户明确要求，不执行远程部署、不修改 wayknow 生产服务器。
