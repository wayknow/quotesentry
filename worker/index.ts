import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { BootstrapResponse, RfqDocument, SourceType } from '../shared/schema.js';
import { analyzeDocument } from '../server/domain/analyze.js';
import {
  approveQuote,
  assertSendAllowed,
  buildCustomerExport,
  getCurrentQuote,
  markExported,
  overrideMarginAlert,
} from '../server/domain/workflow.js';
import { AppError } from '../server/errors.js';
import { customerQuoteCsv, customerQuotePdf } from '../server/exporters.js';
import { hasLlmKey, llmConfigFromEnv, type LlmConfig } from '../server/llm/client.js';
import { hashBytes, hashText, makeId, nowIso } from '../server/utils.js';
import { saveArtifact } from './artifacts.js';
import { enforceBasicAuth } from './auth.js';
import { catalogRev, dataCache } from './data.js';
import type { Env, WorkerModule } from './env.js';
import { empty, errorResponse, json, readJsonObject } from './http.js';
import { createSeedDocuments } from './seed.js';
import { D1DocumentStore } from './store.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const createTextSchema = z.object({
  title: z.string().trim().min(1).max(120),
  customerId: z.string().trim().min(1),
  rawText: z.string().trim().min(1).max(100_000),
});

const actorSchema = z.object({ actor: z.string().trim().min(1).max(80) });
const overrideSchema = actorSchema.extend({
  lineId: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(500),
});

const worker: WorkerModule = {
  async fetch(request, env): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') return empty();

      const authFailure = await enforceBasicAuth(request, env);
      if (authFailure) return authFailure;

      const path = apiPath(new URL(request.url).pathname);
      if (!path) return json({ error: 'API route not found', code: 'NOT_FOUND' }, 404);

      if (request.method === 'GET' && path === '/api/health') {
        return json(healthPayload(env));
      }

      assertStorage(env);
      const store = new D1DocumentStore(env.DB);
      if (!(request.method === 'POST' && path === '/api/reset-demo')) {
        await store.ensureSeeded(createSeedDocuments());
      }

      return await route(request, env, store, path);
    } catch (error) {
      return errorResponse(error);
    }
  },
};

export default worker;

async function route(
  request: Request,
  env: Env,
  store: D1DocumentStore,
  path: string,
): Promise<Response> {
  if (path === '/api/bootstrap' && request.method === 'GET') {
    const payload: BootstrapResponse = {
      health: healthPayload(env),
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
      documents: await store.listDocuments(),
      samples: dataCache.samples,
    };
    return json(payload);
  }

  if (path === '/api/rfqs' && request.method === 'GET') {
    return json(await store.listDocuments());
  }

  if (path === '/api/rfqs' && request.method === 'POST') {
    return json(await createDocument(request, env, store), 201);
  }

  if (path === '/api/reset-demo' && request.method === 'POST') {
    const documents = await store.resetDemo(createSeedDocuments());
    return json({ documents, health: healthPayload(env) });
  }

  const match = path.match(/^\/api\/rfqs\/([^/]+)(?:\/(analyze|approve|override|send|export\.csv|export\.pdf))?$/);
  if (!match) return json({ error: 'API route not found', code: 'NOT_FOUND' }, 404);

  const id = decodeURIComponent(match[1]);
  const action = match[2] || 'get';

  if (action === 'get' && request.method === 'GET') {
    return json(await mustGetDocument(store, id));
  }

  if (action === 'analyze' && request.method === 'POST') {
    const document = await mustGetDocument(store, id);
    if (document.quotes.some((quote) => quote.status === 'APPROVED' || quote.status === 'EXPORTED')) {
      throw new AppError(409, 'QUOTE_LOCKED', '报价已审批或导出，不能重新分析；如需重做，请新建询价。');
    }
    const next = await analyzeDocument(document, {
      customer: mustGetCustomer(document.customerId),
      catalog: dataCache.catalog,
      rules: dataCache.pricingRules,
      llm: llmForEnv(env),
    });
    return json(await store.upsertDocument(next));
  }

  if (action === 'approve' && request.method === 'POST') {
    const parsed = actorSchema.parse(await readJsonObject(request));
    const document = await mustGetDocument(store, id);
    const next = approveQuote(document, parsed.actor, dataCache.pricingRules.version);
    return json(await store.upsertDocument(next));
  }

  if (action === 'override' && request.method === 'POST') {
    const parsed = overrideSchema.parse(await readJsonObject(request));
    const document = await mustGetDocument(store, id);
    const next = overrideMarginAlert(document, parsed.lineId, parsed.reason, parsed.actor);
    return json(await store.upsertDocument(next));
  }

  if (action === 'send' && request.method === 'POST') {
    assertSendAllowed(env.SEND_MODE || 'disabled');
    await mustGetDocument(store, id);
    throw new AppError(501, 'SEND_NOT_CONFIGURED', '发送通道未配置');
  }

  if (action === 'export.csv' && request.method === 'GET') {
    return exportQuote(request, env, store, id, 'csv');
  }

  if (action === 'export.pdf' && request.method === 'GET') {
    return exportQuote(request, env, store, id, 'pdf');
  }

  throw new AppError(405, 'METHOD_NOT_ALLOWED', '该 API 不支持当前请求方法。');
}

async function createDocument(
  request: Request,
  env: Env,
  store: D1DocumentStore,
): Promise<RfqDocument> {
  const contentType = request.headers.get('Content-Type') || '';
  let title: string;
  let customerId = 'CUST-001';
  let rawText: string;
  let sourceType: SourceType;
  let sourceFile: {
    bytes: Uint8Array;
    filename: string;
    contentType: string;
    format: string;
  } | null = null;

  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AppError(400, 'FILE_REQUIRED', '请选择要上传的文件。');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError(413, 'FILE_TOO_LARGE', '文件不能超过 5 MB。');
    }

    customerId = stringValue(form.get('customerId')) || customerId;
    const extension = fileExtension(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseUploadedFile(bytes, extension);
    rawText = parsed.rawText;
    sourceType = parsed.sourceType;
    title = cleanTitle(stringValue(form.get('title')) || baseName(file.name));
    sourceFile = {
      bytes,
      filename: file.name || `upload${extension}`,
      contentType: file.type || parsed.contentType,
      format: extension.replace(/^\./, '') || 'bin',
    };
  } else {
    const parsed = createTextSchema.parse(await readJsonObject(request));
    title = cleanTitle(parsed.title);
    customerId = parsed.customerId;
    rawText = parsed.rawText;
    sourceType = 'text';
  }

  rawText = rawText.trim();
  if (!rawText) throw new AppError(400, 'EMPTY_INPUT', '询价内容为空。');

  const customer = mustGetCustomer(customerId);
  const now = nowIso();
  const document: RfqDocument = {
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
      detail: {
        sourceType,
        fileName: sourceFile?.filename ?? null,
        textBytes: new TextEncoder().encode(rawText).byteLength,
      },
    }],
  };

  if (sourceFile) {
    const artifact = await saveArtifact(env.DB, env.FILES, {
      documentId: document.id,
      kind: 'source',
      format: sourceFile.format,
      filename: sourceFile.filename,
      contentType: sourceFile.contentType,
      bytes: sourceFile.bytes,
    });
    document.audit[0].detail = {
      ...document.audit[0].detail,
      sourceBytes: sourceFile.bytes.byteLength,
      sourceArtifact: artifact.key,
      sourceSha256: artifact.sha256,
    };
  }

  return store.upsertDocument(document);
}

async function exportQuote(
  _request: Request,
  env: Env,
  store: D1DocumentStore,
  id: string,
  format: 'csv' | 'pdf',
): Promise<Response> {
  const document = await mustGetDocument(store, id);
  const quote = getCurrentQuote(document);
  const customer = mustGetCustomer(document.customerId);
  const data = buildCustomerExport(quote, customer, dataCache.pricingRules);
  const filename = `quotesentry-${document.id}.${format}`;
  const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf';

  let bytes: Uint8Array;
  if (format === 'csv') {
    bytes = new TextEncoder().encode(`\uFEFF${customerQuoteCsv(data)}`);
  } else {
    bytes = await customerQuotePdf(data);
  }

  await saveArtifact(env.DB, env.FILES, {
    documentId: document.id,
    quoteId: quote.id,
    kind: 'export',
    format,
    filename,
    contentType,
    bytes,
  });
  const next = markExported(document, 'sales');
  await store.upsertDocument(next);

  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function parseUploadedFile(
  bytes: Uint8Array,
  extension: string,
): { rawText: string; sourceType: SourceType; contentType: string } {
  if (extension === '.xlsx' || extension === '.xls') {
    try {
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new AppError(400, 'EMPTY_WORKBOOK', '工作簿中没有工作表。');
      return {
        rawText: XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { blankrows: false }),
        sourceType: 'xlsx',
        contentType: extension === '.xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(400, 'INVALID_WORKBOOK', '无法解析 Excel 文件，请检查文件是否损坏。');
    }
  }

  if (extension === '.csv') {
    return {
      rawText: decodeText(bytes),
      sourceType: 'csv',
      contentType: 'text/csv',
    };
  }

  if (extension === '.txt') {
    return {
      rawText: decodeText(bytes),
      sourceType: 'text',
      contentType: 'text/plain',
    };
  }

  throw new AppError(415, 'UNSUPPORTED_FILE', '只支持 .xlsx、.xls、.csv、.txt 文件。');
}

async function mustGetDocument(store: D1DocumentStore, id: string): Promise<RfqDocument> {
  const document = await store.getDocument(id);
  if (!document) throw new AppError(404, 'RFQ_NOT_FOUND', '询价不存在。');
  return document;
}

function mustGetCustomer(id: string) {
  const customer = dataCache.customers.find((item) => item.id === id);
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', '客户不存在。');
  return customer;
}

function healthPayload(env: Env) {
  const llm = llmForEnv(env);
  return {
    status: 'ok' as const,
    mode: env.APP_MODE === 'production' ? 'production' as const : 'demo' as const,
    engine: hasLlmKey(llm) ? 'llm' as const : 'rules' as const,
    engineLabel: hasLlmKey(llm) ? 'DeepSeek 实时抽取' : '确定性规则模式',
    model: llm.model,
    catalogRevision: catalogRev,
    pricingRuleVersion: dataCache.pricingRules.version,
    sendMode: env.SEND_MODE || 'disabled',
    llmConfigured: hasLlmKey(llm),
    storage: env.FILES ? 'd1+r2' : 'd1',
  };
}

function llmForEnv(env: Env): LlmConfig {
  return llmConfigFromEnv({
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: env.DEEPSEEK_MODEL,
    DEEPSEEK_TIMEOUT_MS: env.DEEPSEEK_TIMEOUT_MS,
    DEEPSEEK_MAX_RETRIES: env.DEEPSEEK_MAX_RETRIES,
    LLM_API_KEY: env.LLM_API_KEY,
    LLM_BASE_URL: env.LLM_BASE_URL,
    LLM_MODEL: env.LLM_MODEL,
    LLM_TIMEOUT_MS: env.LLM_TIMEOUT_MS,
    LLM_MAX_RETRIES: env.LLM_MAX_RETRIES,
  });
}

function assertStorage(env: Env): void {
  if (!env.DB) {
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'D1 绑定未配置。');
  }
}

function apiPath(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const prefix of ['/quotesentry/api', '/api']) {
    if (clean === prefix) return '/api';
    if (clean.startsWith(`${prefix}/`)) return `/api${clean.slice(prefix.length)}`;
  }
  return null;
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function fileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index).toLowerCase() : '';
}

function baseName(filename: string): string {
  const normalized = filename.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function cleanTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return title || `询价 ${makeId('rfq').slice(-6)}`;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}
