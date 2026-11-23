import catalogJson from '../data/catalog/fasteners.json';
import customersJson from '../data/customers.json';
import pricingRulesJson from '../data/pricing-rules.json';
import samplesJson from '../data/samples/manifest.json';
import sample01 from '../data/samples/01-clean-email.txt';
import sample02 from '../data/samples/02-missing-finish.txt';
import sample03 from '../data/samples/03-out-of-catalog.txt';
import sample04 from '../data/samples/04-unit-conflict.txt';
import sample05 from '../data/samples/05-same-as-last-time.txt';
import sample06 from '../data/samples/06-margin-breach.txt';
import sample07 from '../data/samples/07-partial-thread.txt';
import sample08 from '../data/samples/08-multi-line.txt';
import sample09 from '../data/samples/09-clean-list.csv';
import {
  catalogSkuSchema,
  customerSchema,
  pricingRulesSchema,
  sampleManifestSchema,
} from '../shared/schema.js';
import { hashText } from '../server/utils.js';

export const dataCache = {
  catalog: catalogSkuSchema.array().parse(catalogJson),
  customers: customerSchema.array().parse(customersJson),
  pricingRules: pricingRulesSchema.parse(pricingRulesJson),
  samples: sampleManifestSchema.array().parse(samplesJson),
};

const SAMPLE_TEXT: Record<string, string> = {
  '01-clean-email.txt': sample01,
  '02-missing-finish.txt': sample02,
  '03-out-of-catalog.txt': sample03,
  '04-unit-conflict.txt': sample04,
  '05-same-as-last-time.txt': sample05,
  '06-margin-breach.txt': sample06,
  '07-partial-thread.txt': sample07,
  '08-multi-line.txt': sample08,
  '09-clean-list.csv': sample09,
};

export function readSampleText(file: string): string {
  const text = SAMPLE_TEXT[file];
  if (text === undefined) throw new Error(`Unknown sample file: ${file}`);
  return text;
}

export const catalogRev = hashText(JSON.stringify(dataCache.catalog)).slice(0, 12);

