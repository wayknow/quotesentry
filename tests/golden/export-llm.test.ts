import { describe, expect, it } from 'vitest';
import { llmExtractionSchema } from '../../shared/schema.js';
import { dataCache } from '../../server/data.js';
import { approveQuote, buildCustomerExport } from '../../server/domain/workflow.js';
import { customerQuoteCsv, customerQuotePdf } from '../../server/exporters.js';
import { parseJsonContent } from '../../server/llm/client.js';
import { analyzeText } from './helpers.js';

describe('customer export isolation', () => {
  it('contains no cost, margin or internal alert fields', () => {
    const doc = analyzeText('01-clean-email.txt', 'CUST-001');
    const approved = approveQuote(doc, 'Supervisor');
    const quote = approved.quotes[0];
    const data = buildCustomerExport(quote, dataCache.customers[0], dataCache.pricingRules);
    const csv = customerQuoteCsv(data);

    expect(Object.keys(data).sort()).toEqual([
      'currency', 'customerName', 'incoterm', 'lines', 'quoteId', 'totalUsd', 'validUntil',
    ]);
    expect(Object.keys(data.lines[0]).sort()).toEqual([
      'amountUsd', 'description', 'quantity', 'sku', 'unit', 'unitPriceUsd',
    ]);
    expect(csv).not.toMatch(/margin|成本|毛利|unitCost|lineCost|discount|12\.61|2522/i);
    expect(csv).toContain('HB-M12X75-88-ZN');
    expect(csv).toContain('465.00');
    expect(csv).toContain('Demo data only');
  });

  it('renders a valid PDF from customer-safe data', async () => {
    const doc = analyzeText('01-clean-email.txt', 'CUST-001');
    const approved = approveQuote(doc, 'Supervisor');
    const data = buildCustomerExport(approved.quotes[0], dataCache.customers[0], dataCache.pricingRules);
    const bytes = await customerQuotePdf(data);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe('LLM boundary', () => {
  it('strips hallucinated price fields during schema validation', () => {
    const parsed = llmExtractionSchema.parse({
      lines: [{
        lineIndex: 1,
        sourceLine: '200 pcs M12x75 hex bolt',
        productType: 'hex_bolt',
        quantity: 200,
        unit: 'pcs',
        unitPrice: 0.01,
        margin: 99,
      }],
    });
    expect(parsed.lines[0]).not.toHaveProperty('unitPrice');
    expect(parsed.lines[0]).not.toHaveProperty('margin');
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    expect(parseJsonContent('```json\n{"lines":[]}\n```')).toEqual({ lines: [] });
  });

  it('throws a clear parse error for non-JSON model output', () => {
    expect(() => parseJsonContent('I cannot provide that.')).toThrowError(/不是合法 JSON/);
  });
});
