import { z } from 'zod';

export const SOURCE_TYPES = ['text', 'xlsx', 'csv', 'seed'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ENGINE_MODES = ['llm', 'rules'] as const;
export type EngineMode = (typeof ENGINE_MODES)[number];

export const LINE_STATUSES = [
  'READY',
  'NEEDS_CLARIFICATION',
  'NO_MATCH',
  'PRICED',
  'MARGIN_ALERT',
  'APPROVED',
  'REJECTED',
] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export const DOCUMENT_STATUSES = [
  'RECEIVED',
  'EXTRACTING',
  'NEEDS_REVIEW',
  'PRICED',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'EXPORTED',
  'FAILED',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const QUOTE_STATUSES = ['DRAFT', 'READY_FOR_APPROVAL', 'APPROVED', 'EXPORTED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const evidenceSchema = z.object({
  text: z.string(),
  location: z.string(),
  verified: z.boolean(),
  kind: z.enum(['direct', 'normalized', 'inferred', 'human']).default('direct'),
  field: z.string().nullable().optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const pricingLineSchema = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  baseExwPriceCny: z.number().nonnegative(),
  quantityTierFactor: z.number().positive(),
  customerDiscount: z.number().positive(),
  unitPriceCny: z.number().nonnegative(),
  lineNetCny: z.number().nonnegative(),
  unitCostCny: z.number().nonnegative(),
  lineCostCny: z.number().nonnegative(),
  lineMarginCny: z.number(),
  lineMarginPct: z.number(),
  currencyAmount: z.number().nonnegative(),
  tierLabel: z.string(),
});
export type PricingLine = z.infer<typeof pricingLineSchema>;

export const rfqLineSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  lineIndex: z.number().int().nonnegative(),
  rawText: z.string(),
  evidence: z.array(evidenceSchema),
  productType: z.string().nullable(),
  standard: z.string().nullable(),
  diameterMm: z.number().nullable(),
  lengthMm: z.number().nullable(),
  threadPitchMm: z.number().nullable(),
  material: z.string().nullable(),
  strengthGrade: z.string().nullable(),
  surfaceTreatment: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  status: z.enum(LINE_STATUSES),
  missingFields: z.array(z.string()),
  conflicts: z.array(z.string()),
  matchedSku: z.string().nullable(),
  matchedSkuName: z.string().nullable(),
  matchReason: z.string().nullable(),
  clarification: z.string().nullable(),
  pricing: pricingLineSchema.nullable(),
});
export type RfqLine = z.infer<typeof rfqLineSchema>;

export const catalogSkuSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  productType: z.literal('hex_bolt'),
  standards: z.array(z.string()),
  threadType: z.enum(['full', 'partial']),
  diameterMm: z.number().positive(),
  lengthMm: z.number().positive(),
  threadPitchMm: z.number().positive().nullable(),
  material: z.string(),
  strengthGrade: z.string(),
  surfaceTreatment: z.string(),
  unit: z.literal('pcs'),
  moq: z.number().int().positive(),
  leadTimeDays: z.number().int().positive(),
  unitCostCny: z.number().positive(),
  baseExwPriceCny: z.number().positive(),
  quantityTiers: z.array(z.object({ minQty: z.number().positive(), factor: z.number().positive() })),
  active: z.boolean(),
});
export type CatalogSku = z.infer<typeof catalogSkuSchema>;

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  discount: z.number().positive().max(1),
  currency: z.literal('USD'),
  incoterm: z.string(),
  notes: z.string().optional(),
});
export type Customer = z.infer<typeof customerSchema>;

export const pricingRulesSchema = z.object({
  id: z.string(),
  version: z.string(),
  currency: z.literal('USD'),
  cnyPerUnitCurrency: z.number().positive(),
  minimumMarginPct: z.number().min(0).max(100),
  fixedOrderFeeCny: z.number().nonnegative(),
  validDays: z.number().int().positive(),
  rounding: z.literal('2dp'),
});
export type PricingRules = z.infer<typeof pricingRulesSchema>;

export const quoteLineSchema = z.object({
  id: z.string(),
  rfqLineId: z.string(),
  sku: z.string(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitPriceCny: z.number(),
  lineNetCny: z.number(),
  lineCostCny: z.number(),
  lineMarginPct: z.number(),
  currencyAmount: z.number(),
  tierLabel: z.string(),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  version: z.number().int().positive(),
  status: z.enum(QUOTE_STATUSES),
  customerId: z.string(),
  currency: z.literal('USD'),
  incoterm: z.string(),
  lines: z.array(quoteLineSchema),
  netSalesCny: z.number(),
  totalCostCny: z.number(),
  feesCny: z.number(),
  marginCny: z.number(),
  marginPct: z.number(),
  currencyTotal: z.number(),
  validUntil: z.string(),
  overrides: z.array(z.object({ lineId: z.string(), reason: z.string(), actor: z.string(), at: z.string() })),
  createdAt: z.string(),
  approvedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
});
export type Quote = z.infer<typeof quoteSchema>;

export const auditEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: z.string(),
  actor: z.string(),
  message: z.string(),
  model: z.string().nullable().optional(),
  promptVersion: z.string().nullable().optional(),
  catalogRevision: z.string().nullable().optional(),
  pricingRuleVersion: z.string().nullable().optional(),
  inputHash: z.string().nullable().optional(),
  outputHash: z.string().nullable().optional(),
  detail: z.record(z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const rfqDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  customerId: z.string(),
  rawText: z.string(),
  inputHash: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  engineMode: z.enum(ENGINE_MODES),
  engineNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lines: z.array(rfqLineSchema),
  quotes: z.array(quoteSchema),
  currentQuoteId: z.string().nullable(),
  audit: z.array(auditEventSchema),
});
export type RfqDocument = z.infer<typeof rfqDocumentSchema>;

export const sampleManifestSchema = z.object({
  file: z.string(),
  title: z.string(),
  customerId: z.string(),
  sourceType: z.enum(SOURCE_TYPES),
  note: z.string().optional(),
});
export type SampleManifest = z.infer<typeof sampleManifestSchema>;

export const llmLineSchema = z.object({
  lineIndex: z.number().int().nonnegative(),
  sourceLine: z.string(),
  productType: z.string().nullable().default(null),
  standard: z.string().nullable().default(null),
  diameterMm: z.number().nullable().default(null),
  lengthMm: z.number().nullable().default(null),
  threadPitchMm: z.number().nullable().default(null),
  material: z.string().nullable().default(null),
  strengthGrade: z.string().nullable().default(null),
  surfaceTreatment: z.string().nullable().default(null),
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
});
export type LlmLine = z.infer<typeof llmLineSchema>;

export const llmExtractionSchema = z.object({
  lines: z.array(llmLineSchema),
});
export type LlmExtraction = z.infer<typeof llmExtractionSchema>;

export interface BootstrapResponse {
  health: {
    status: 'ok';
    mode: 'demo' | 'production';
    engine: EngineMode;
    engineLabel: string;
    model: string;
    catalogRevision: string;
    pricingRuleVersion: string;
    sendMode: string;
  };
  customers: Customer[];
  pricingRules: PricingRules;
  catalog: Array<Pick<CatalogSku, 'sku' | 'name' | 'standards' | 'diameterMm' | 'lengthMm' | 'material' | 'strengthGrade' | 'surfaceTreatment' | 'baseExwPriceCny' | 'leadTimeDays'>>;
  documents: RfqDocument[];
  samples: SampleManifest[];
}
