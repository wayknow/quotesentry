import path from 'node:path';
import express from 'express';
import { basicAuth } from './auth.js';
import { config } from './config.js';
import { store } from './store.js';
import { api, errorHandler, resolveStaticDir } from './routes.js';

store.init();

const app = express();
app.disable('x-powered-by');
if (Boolean(config.basicAuth.user) !== Boolean(config.basicAuth.password)) {
  throw new Error('BASIC_AUTH_USER 和 BASIC_AUTH_PASSWORD 必须同时配置，或同时留空。');
}
if (config.basicAuth.user) {
  app.use(basicAuth(config.basicAuth.user, config.basicAuth.password));
}
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use('/api', api);
app.use('/quotesentry/api', api);

const dist = resolveStaticDir();
if (dist) {
  app.use(express.static(dist, { index: false }));
  app.use('/quotesentry', express.static(dist, { index: false }));
  const indexFile = path.join(dist, 'index.html');
  const sendIndex = (_req: express.Request, res: express.Response) => res.sendFile(indexFile);
  app.get('/', sendIndex);
  app.get('/quotesentry', sendIndex);
  app.get('/quotesentry/*', sendIndex);
}

app.use(errorHandler);

app.listen(config.port, '127.0.0.1', () => {
  console.log(`QuoteSentry API listening on http://127.0.0.1:${config.port}`);
  console.log(`Mode: ${config.appMode} · engine: ${config.llm.apiKey ? config.llm.flashModel : 'rules'} · send: ${config.sendMode}`);
});
