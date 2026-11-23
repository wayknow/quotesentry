import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { z, ZodError } from 'zod';
import type { BootstrapResponse, RfqDocument, SourceType } from '../shared/schema.js';
import { config } from './config.js';
import { catalogRev, dataCache } from './data.js';
import { analyzeDocument } from './domain/analyze.js';
import {
  approveQuote,
  assertSendAllowed,
  buildCustomerExport,
  getCurrentQuote,
  markExported,
  overrideMarginAlert,
} from './domain/workflow.js';
import { AppError } from './errors.js';
import { customerQuoteCsv, customerQuotePdf } from './exporters.js';
import { store } from './store.js';
import { hashText, makeId, nowIso } from './utils.js';
import { hasLlmKey } from './llm/client.js';

export const api = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const createTextSchema = z.object({
  title: z.string().trim().min(1).max(120),
  customerId: z.string().trim().min(1),
  rawText: z.string().trim().min(1).max(100_000),
});

const analyzeSchema = z.object({}).passthrough().optional();
const actorSchema = z.object({ actor: z.string().trim().min(1).max(80) });
const overrideSchema = actorSchema.extend({
  lineId: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(500),
});

api.get('/health', (_req, res) => {
  res.json(healthPayload());
});

api.get('/bootstrap', (_req, res) => {
  const payload: BootstrapResponse = {
    health: healthPayload(),
    customers: dataCache.customers,
    pricingRules: dataCache.pricingRules,
    catalog: dataCache.catalog.map((sku) => ({
      sku: sku.sku,
      name: sku.name,
      standards: sku.standards,
      diameterMm: sku.diameterMm,
      lengthMm: sku.lengthMm,
      material: sku.material,
      strengthGrade: sku.strengthGrade,
      surfaceTreatment: sku.surfaceTreatment,
      baseExwPriceCny: sku.baseExwPriceCny,
      leadTimeDays: sku.leadTimeDays,
    })),
    documents: store.listDocuments(),
    samples: dataCache.samples,
  };
  res.json(payload);
});

api.get('/rfqs', (_req, res) => {
  res.json(store.listDocuments());
});

api.get('/rfqs/:id', (req, res) => {
  res.json(mustGetDocument(req.params.id));
});

api.post('/rfqs', upload.single('file'), asyncRoute(async (req, res) => {
  const document = await createDocument(req);
  res.status(201).json(store.upsertDocument(document));
}));

api.post('/rfqs/:id/analyze', asyncRoute(async (req, res) => {
  analyzeSchema.parse(req.body ?? {});
  const doc = mustGetDocument(req.params.id);
  if (doc.quotes.some((quote) => quote.status === 'APPROVED' || quote.status === 'EXPORTED')) {
    throw new AppError(409, 'QUOTE_LOCKED', '报价已审批或导出，不能重新分析；如需重做，请新建询价。');
  }
  const customer = mustGetCustomer(doc.customerId);
  const next = await analyzeDocument(doc, {
    customer,
    catalog: dataCache.catalog,
    rules: dataCache.pricingRules,
    llm: config.llm,
  });
  res.json(store.upsertDocument(next));
}));

api.post('/rfqs/:id/approve', (req, res) => {
  const { actor } = actorSchema.parse(req.body);
  const doc = mustGetDocument(req.params.id);
  res.json(store.upsertDocument(approveQuote(doc, actor, dataCache.pricingRules.version)));
});

api.post('/rfqs/:id/override', (req, res) => {
  const input = overrideSchema.parse(req.body);
  const doc = mustGetDocument(req.params.id);
  res.json(store.upsertDocument(overrideMarginAlert(doc, input.lineId, input.reason, input.actor)));
});

api.post('/rfqs/:id/send', (req, res) => {
  assertSendAllowed(config.sendMode);
  mustGetDocument(req.params.id);
  res.status(501).json({ error: '发送通道未配置' });
});

api.get('/rfqs/:id/export.csv', (req, res) => {
  const { doc, data } = prepareExport(mustGetDocument(req.params.id), 'sales');
  const csv = `\uFEFF${customerQuoteCsv(data)}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="quotesentry-${doc.id}.csv"`);
  res.send(csv);
});

api.get('/rfqs/:id/export.pdf', asyncRoute(async (req, res) => {
  const { doc, data } = prepareExport(mustGetDocument(req.params.id), 'sales');
  const bytes = await customerQuotePdf(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="quotesentry-${doc.id}.pdf"`);
  res.send(Buffer.from(bytes));
}));

api.post('/reset-demo', (_req, res) => {
  res.json({ documents: store.resetDemo(), health: healthPayload() });
});

api.use((_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: '请求参数不合法', code: 'VALIDATION_ERROR', issues: error.issues });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: `文件上传失败：${error.message}`, code: 'UPLOAD_ERROR' });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'JSON 请求体格式不合法', code: 'INVALID_JSON' });
    return;
  }
  console.error('[QuoteSentry] unhandled error:', error instanceof Error ? error.message : error);
  res.status(500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
}

function healthPayload() {
  return {
    status: 'ok' as const,
    mode: config.appMode,
    engine: hasLlmKey(config.llm) ? 'llm' as const : 'rules' as const,
    engineLabel: hasLlmKey(config.llm) ? 'DeepSeek 实时抽取' : '确定性规则模式',
    model: config.llm.model,
    catalogRevision: catalogRev,
    pricingRuleVersion: dataCache.pricingRules.version,
    sendMode: config.sendMode,
    llmConfigured: hasLlmKey(config.llm),
  };
}

async function createDocument(req: Request): Promise<RfqDocument> {
  const now = nowIso();
  const bodyCustomerId = typeof req.body?.customerId === 'string' ? req.body.customerId.trim() : '';
  const customer = mustGetCustomer(bodyCustomerId || 'CUST-001');

  let rawText: string;
  let sourceType: SourceType;
  let title: string;

  if (req.file) {
    const extension = path.extname(req.file.originalname).toLowerCase();
    title = cleanTitle(req.body?.title || path.basename(req.file.originalname, extension));
    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new AppError(400, 'EMPTY_WORKBOOK', '工作簿中没有工作表。');
      rawText = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { blankrows: false });
      sourceType = 'xlsx';
    } else if (extension === '.csv') {
      rawText = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      sourceType = 'csv';
    } else if (extension === '.txt') {
      rawText = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
      sourceType = 'text';
    } else {
      throw new AppError(415, 'UNSUPPORTED_FILE', '只支持 .xlsx、.xls、.csv、.txt 文件。');
    }
  } else {
    const parsed = createTextSchema.parse(req.body);
    rawText = parsed.rawText;
    sourceType = 'text';
    title = parsed.title;
  }

  rawText = rawText.trim();
  if (!rawText) throw new AppError(400, 'EMPTY_INPUT', '询价内容为空。');

  return {
    id: makeId('rfq'),
    title,
    sourceType,
    customerId: customer.id,
    rawText,
    inputHash: hashText(rawText),
    status: 'RECEIVED',
    engineMode: 'rules',
    engineNote: null,
    createdAt: now,
    updatedAt: now,
    lines: [],
    quotes: [],
    currentQuoteId: null,
    audit: [{
      id: makeId('aud'),
      at: now,
      type: 'RECEIVED',
      actor: 'sales',
      message: `创建询价：${title}（${sourceType.toUpperCase()}）`,
      inputHash: hashText(rawText),
      detail: { sourceType, fileName: req.file?.originalname ?? null, bytes: Buffer.byteLength(rawText) },
    }],
  };
}

function prepareExport(doc: RfqDocument, actor: string) {
  const quote = getCurrentQuote(doc);
  const customer = mustGetCustomer(doc.customerId);
  const data = buildCustomerExport(quote, customer, dataCache.pricingRules);
  const next = store.upsertDocument(markExported(doc, actor));
  return { doc: next, data };
}

function mustGetDocument(id: string): RfqDocument {
  const doc = store.getDocument(id);
  if (!doc) throw new AppError(404, 'RFQ_NOT_FOUND', '询价不存在。');
  return doc;
}

function mustGetCustomer(id: string) {
  const customer = dataCache.customers.find((item) => item.id === id);
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', '客户不存在。');
  return customer;
}

function cleanTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return title || `询价 ${crypto.randomUUID().slice(0, 6)}`;
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function resolveStaticDir(): string | null {
  const dist = path.resolve(config.root, 'dist');
  return fs.existsSync(dist) ? dist : null;
}
