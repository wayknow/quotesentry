import { dataCache, readSampleText } from '../server/data.js';
import { applyExtraction } from '../server/domain/analyze.js';
import { extractCsvLines, extractTextLines } from '../server/domain/extraction.js';
import type { RfqDocument, SourceType } from '../shared/schema.js';
import { hashText, nowIso } from '../server/utils.js';

let failures = 0;

for (const [index, sample] of dataCache.samples.entries()) {
  const rawText = readSampleText(sample.file);
  const lines = sample.sourceType === 'csv' || sample.sourceType === 'xlsx'
    ? extractCsvLines(rawText)
    : extractTextLines(rawText);
  const customer = dataCache.customers.find((item) => item.id === sample.customerId);
  if (!customer) {
    console.error(`✗ ${sample.file}: 客户 ${sample.customerId} 不存在`);
    failures += 1;
    continue;
  }

  const at = nowIso();
  const doc: RfqDocument = {
    id: `seed-check-${index + 1}`,
    title: sample.title,
    sourceType: sample.sourceType as SourceType,
    customerId: sample.customerId,
    rawText,
    inputHash: hashText(rawText),
    status: 'RECEIVED',
    engineMode: 'rules',
    engineNote: null,
    createdAt: at,
    updatedAt: at,
    lines: [],
    quotes: [],
    currentQuoteId: null,
    agentTurns: [],
    audit: [],
  };
  const analyzed = applyExtraction(doc, {
    lines,
    engineMode: 'rules',
    engineNote: 'seed-check',
    model: null,
  }, {
    customer,
    catalog: dataCache.catalog,
    rules: dataCache.pricingRules,
  });

  if (analyzed.lines.length === 0) {
    console.error(`✗ ${sample.file}: 未识别到产品行`);
    failures += 1;
    continue;
  }

  const statuses = analyzed.lines.map((line) => `${line.lineIndex}:${line.status}`).join(', ');
  console.log(`✓ ${sample.file.padEnd(26)} ${analyzed.status.padEnd(20)} ${statuses}`);
}

console.log(`\nCatalog: ${dataCache.catalog.length} SKUs · Customers: ${dataCache.customers.length} · Rules: ${dataCache.pricingRules.version}`);
if (failures > 0) {
  console.error(`${failures} sample(s) failed.`);
  process.exit(1);
}
