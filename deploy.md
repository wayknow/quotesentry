# Deployment Guide

> 当前版本为本地演示实现；尚未执行 wayknow 线上部署。

## 1. 目标形态

- 桌面优先 Web：React + Vite 前端，Express API。
- 本地开发：Vite `5173`，API `3001`，Vite 代理 `/api`。
- 本地生产：`npm run build && npm start`，同一 `3001` 端口提供静态页面和 API。
- 线上：预留 `work/wayknow` 站点的 `/quotesentry/` 子目录与 `/quotesentry/api/` 同源路径。
- 数据：`data/db.json`；演示可通过 API 重置。
- 模型：DeepSeek OpenAI 兼容接口，服务端直连 `https://api.deepseek.com/chat/completions`；密钥只在服务端读取。

## 2. 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY；也可以先留空使用规则模式
npm run dev
```

访问：

- 前端：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:3001/api/health`

## 3. 生产构建（本机）

```bash
npm run check
npm test
npm run seed
npm run build
npm start
```

访问 `http://127.0.0.1:3001`。Express 会从 `dist/` 提供前端，并同时提供 `/api`。

## 4. 环境变量

```env
PORT=3001
APP_MODE=demo
SEND_MODE=disabled
DB_PATH=./data/db.json

# 可选：预发/演示阶段的 HTTP Basic Auth；两项同时留空即关闭
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=

LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=45000
DEEPSEEK_MAX_RETRIES=1
```

接入方式与现有 `app_survey` 服务端一致：Express 用 `fetch` 直连 DeepSeek，请求头为 `Authorization: Bearer ${DEEPSEEK_API_KEY}`，请求 `POST /chat/completions`。浏览器永远不会收到 Key，也不直接请求 DeepSeek。

配置后做一次真实连通性检查：

```bash
npm run test:deepseek
```

命令只打印 endpoint、模型、耗时和模型返回内容，不打印 Key。

约束：

- `.env` 已在 `.gitignore` 中，不能提交真实 Key。
- `DEEPSEEK_API_KEY` 不进入前端包、API 响应、日志或导出文件。
- 旧变量 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL` 仍兼容，但新配置统一使用 `DEEPSEEK_*`。
- `SEND_MODE=disabled` 时 `/api/rfqs/:id/send` 始终返回 HTTP 403。
- `APP_MODE=demo` 时前端固定显示“仿真演示”。

### 应用层 Basic Auth

预发和公开演示建议开启 Basic Auth。认证由 Express 在最前面处理，页面、静态资源和 API 都会受到保护；Nginx 只负责反向代理，不需要重复加 `auth_basic`。

```env
BASIC_AUTH_USER=demo
BASIC_AUTH_PASSWORD=<使用随机强密码>
```

- 两项必须同时配置；只配置一项时服务启动失败。
- 未认证或密码错误返回 HTTP 401 和 `WWW-Authenticate: Basic`。
- 本地默认留空，不改变现有演示体验。
- 这是预发保护，不是正式客户身份体系；正式版仍要做登录、角色和租户隔离。

本地验证：

```bash
PORT=3102 BASIC_AUTH_USER=demo BASIC_AUTH_PASSWORD='test-pass-2026' \
  DB_PATH=/tmp/quotesentry-auth-db.json npm start

curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3102/quotesentry/
curl -s -o /dev/null -w '%{http_code}\n' -u demo:test-pass-2026 http://127.0.0.1:3102/quotesentry/
```

## 5. 数据与重置

| 文件 | 内容 |
|---|---|
| `data/catalog/fasteners.json` | 33 个仿真紧固件 SKU |
| `data/customers.json` | 3 个仿真客户与折扣 |
| `data/pricing-rules.json` | 汇率、费用、毛利底线和有效期 |
| `data/samples/` | 9 份仿真询价 |
| `data/db.json` | 运行时询价与审计数据，已被 git 忽略 |

重置：

```bash
curl -s -X POST http://127.0.0.1:3001/api/reset-demo | jq '.documents | length'
```

只校验样例识别是否正常：

```bash
npm run seed
```

## 6. wayknow 子路径构建

```bash
VITE_BASE_PATH=/quotesentry/ npm run build
npm start
```

前端会自动从 `/quotesentry/api` 调 API；本地也支持直接访问：

- `http://127.0.0.1:3001/quotesentry/`
- `http://127.0.0.1:3001/quotesentry/api/health`

如果 API 使用独立域名，可设置 `VITE_API_BASE_URL`，并自行配置 CORS 白名单。

本地验证记录（2026-11-23）：

- `VITE_BASE_PATH=/quotesentry/ npm run build` 通过，资源路径均为 `/quotesentry/assets/...`。
- `PORT=3101 DB_PATH=/tmp/quotesentry-subpath-db.json npm start` 通过。
- `/quotesentry/`、`/quotesentry/assets/*`、`/quotesentry/api/health` 均返回 200。
- `/quotesentry` 正确 301 到 `/quotesentry/`；`/quotesentry/some/deep/path` 回退到应用入口。
- 子路径下完成 `seed-08` 分析、审批、CSV/PDF 导出和发送 403 验证。

## 7. Nginx 草案

> 执行前先确认 `work/wayknow` 现有 Nginx 配置、HTTPS 和部署流程；以下仅为草案。

> 认证已在 Express 应用层实现；如果改用 Nginx `auth_basic`，不要和 `BASIC_AUTH_*` 同时开启，避免重复认证。

### 方案 A：整站反代到 QuoteSentry Express

```nginx
location /quotesentry/ {
    proxy_pass http://127.0.0.1:3001/quotesentry/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 方案 B：静态文件 + API 分开代理

```nginx
location /quotesentry/ {
    alias /srv/quotesentry/dist/;
    try_files $uri $uri/ /quotesentry/index.html;
}

location /quotesentry/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 8. 演示脚本

固定使用 `seed-08` 三行询价：

1. 展示原文高亮与逐行证据。
2. 一行可报、一行缺表面处理、一行 M14 目录外。
3. 打开审批页，展示客户内容与内部成本/毛利隔离。
4. 审批后导出 CSV/PDF。
5. 打开审计时间线，展示模型/规则版本、输入输出哈希和审批人。
6. 用 `seed-06` 展示毛利越界：审批被锁 → 主管填写 override 原因 → 审计留痕。

## 9. 生产前必须补

- 登录、角色权限、CSRF、审计日志防篡改。
- PostgreSQL 或 SQLite 正式数据库、备份和迁移。
- 上传隔离、病毒扫描、文件类型/大小限制、ZIP bomb 防护。
- Prompt injection 防护、模型调用配额和日志脱敏。
- Nginx/HTTPS/域名/监控/限流。
- 真实目录导入、客户价目表版本和 ERP/CRM 轻集成。
- 真实税/出口退税/币种规则。

## 10. 部署检查清单

- [x] 本地 `npm run check`、`npm test`、`npm run build` 通过。
- [x] 客户导出不含成本/毛利/内部异常。
- [x] `SEND_MODE=disabled` 时发送接口拒绝。
- [x] 仿真数据横幅可见。
- [x] 真实 DeepSeek Key smoke test：`npm run test:deepseek`。
- [x] `seed-08` 真实 LLM 抽取、审批、CSV/PDF 导出与发送阻断通过。
- [x] 子路径 `VITE_BASE_PATH=/quotesentry/` 在本地生产构建验证。
- [x] 刷新深层页面不 404。
- [x] `/quotesentry/api/health` 可访问。
- [x] 可选 Basic Auth 本地验证：401/200、静态资源和 API 鉴权通过。
- [ ] 在 wayknow 预发环境验证。
- [ ] 录屏备份和路演脚本准备完毕。

## 11. 执行原则

未经用户明确要求，不执行部署、不修改 `work/wayknow`、不推送代码。  
部署前先在本机用生产构建和子路径跑一遍，不要直接在生产服务器上试错。
