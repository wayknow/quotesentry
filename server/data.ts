import fs from 'node:fs';
import path from 'node:path';
import {
  catalogSkuSchema,
  customerSchema,
  pricingRulesSchema,
  sampleManifestSchema,
  type CatalogSku,
  type Customer,
  type PricingRules,
  type SampleManifest,
} from '../shared/schema.js';
import { config } from './config.js';
import { hashText } from './utils.js';

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadCatalog(): CatalogSku[] {
  const file = path.join(config.dataDir, 'catalog', 'fasteners.json');
  return catalogSkuSchema.array().parse(readJson(file));
}

export function loadCustomers(): Customer[] {
  const file = path.join(config.dataDir, 'customers.json');
  return customerSchema.array().parse(readJson(file));
}

export function loadPricingRules(): PricingRules {
  const file = path.join(config.dataDir, 'pricing-rules.json');
  return pricingRulesSchema.parse(readJson(file));
}

export function loadSamples(): SampleManifest[] {
  const file = path.join(config.dataDir, 'samples', 'manifest.json');
  return sampleManifestSchema.array().parse(readJson(file));
}

export function readSampleText(file: string): string {
  return fs.readFileSync(path.join(config.dataDir, 'samples', file), 'utf8');
}

export function catalogRevision(catalog: CatalogSku[]): string {
  return hashText(JSON.stringify(catalog)).slice(0, 12);
}

export const dataCache = {
  catalog: loadCatalog(),
  customers: loadCustomers(),
  pricingRules: loadPricingRules(),
  samples: loadSamples(),
};

export const catalogRev = catalogRevision(dataCache.catalog);
