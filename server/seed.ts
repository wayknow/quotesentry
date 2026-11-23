import {
  type RfqDocument,
  type SampleManifest,
} from '../shared/schema.js';
import { dataCache, readSampleText } from './data.js';
import { hashText, makeId, nowIso } from './utils.js';

export function createSeedDocuments(): RfqDocument[] {
  const createdAt = nowIso();
  return dataCache.samples.map((sample, index) => seedDocument(sample, index, createdAt));
}

function seedDocument(sample: SampleManifest, index: number, createdAt: string): RfqDocument {
  const rawText = readSampleText(sample.file);
  const id = `seed-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    title: sample.title,
    sourceType: sample.sourceType,
    customerId: sample.customerId,
    rawText,
    inputHash: hashText(rawText),
    status: 'RECEIVED',
    engineMode: 'rules',
    engineNote: sample.note ?? null,
    createdAt,
    updatedAt: createdAt,
    lines: [],
    quotes: [],
    currentQuoteId: null,
    agentTurns: [],
    audit: [
      {
        id: makeId('aud'),
        at: createdAt,
        type: 'SEEDED',
        actor: 'system',
        message: `加载仿真询价：${sample.file}`,
        model: null,
        promptVersion: null,
        catalogRevision: null,
        pricingRuleVersion: null,
        inputHash: hashText(rawText),
        outputHash: null,
      },
    ],
  };
}
