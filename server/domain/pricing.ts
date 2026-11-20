import type { CatalogSku, Customer, PricingLine, PricingRules } from '../../shared/schema.js';
import { round2 } from '../utils.js';

export interface PriceInput {
  sku: CatalogSku;
  quantity: number;
  customer: Customer;
  rules: PricingRules;
}

export interface QuoteTotals {
  netSalesCny: number;
  totalCostCny: number;
  feesCny: number;
  marginCny: number;
  marginPct: number;
  currencyTotal: number;
}

export function priceCatalogLine(input: PriceInput): PricingLine {
  const { sku, quantity, customer, rules } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('数量必须是大于 0 的有限数字。');
  }

  const tier = pickQuantityTier(sku, quantity);
  const baseExwPriceCents = toCents(sku.baseExwPriceCny);
  const unitPriceCents = Math.round(baseExwPriceCents * tier.factor * customer.discount);
  const lineNetCents = Math.round(unitPriceCents * quantity);
  const lineCostCents = Math.round(toCents(sku.unitCostCny) * quantity);
  const lineMarginCents = lineNetCents - lineCostCents;
  const lineMarginPct = lineNetCents === 0 ? 0 : round2((lineMarginCents / lineNetCents) * 100);
  const currencyAmountCents = Math.round(lineNetCents / rules.cnyPerUnitCurrency);
  const unitPriceCny = fromCents(unitPriceCents);
  const lineNetCny = fromCents(lineNetCents);
  const lineCostCny = fromCents(lineCostCents);
  const lineMarginCny = fromCents(lineMarginCents);
  const currencyAmount = fromCents(currencyAmountCents);

  return {
    sku: sku.sku,
    name: sku.name,
    quantity,
    unit: 'pcs',
    baseExwPriceCny: sku.baseExwPriceCny,
    quantityTierFactor: tier.factor,
    customerDiscount: customer.discount,
    unitPriceCny,
    lineNetCny,
    unitCostCny: sku.unitCostCny,
    lineCostCny,
    lineMarginCny,
    lineMarginPct,
    currencyAmount,
    tierLabel: tier.label,
  };
}

export function pickQuantityTier(sku: CatalogSku, quantity: number): { factor: number; label: string } {
  const tiers = [...sku.quantityTiers]
    .filter((tier) => tier.minQty <= quantity)
    .sort((a, b) => b.minQty - a.minQty);
  const selected = tiers[0] ?? { minQty: 1, factor: 1 };
  return {
    factor: selected.factor,
    label: `≥ ${selected.minQty.toLocaleString('en-US')} pcs · ${selected.factor.toFixed(2)}×`,
  };
}

export function calculateQuoteTotals(lines: PricingLine[], rules: PricingRules): QuoteTotals {
  const netSalesCents = lines.reduce((sum, line) => sum + toCents(line.lineNetCny), 0);
  const lineCostCents = lines.reduce((sum, line) => sum + toCents(line.lineCostCny), 0);
  const feesCents = toCents(rules.fixedOrderFeeCny);
  const totalCostCents = lineCostCents + feesCents;
  const marginCents = netSalesCents - totalCostCents;
  const marginPct = netSalesCents === 0 ? 0 : round2((marginCents / netSalesCents) * 100);
  const currencyTotalCents = Math.round(netSalesCents / rules.cnyPerUnitCurrency);

  return {
    netSalesCny: fromCents(netSalesCents),
    totalCostCny: fromCents(totalCostCents),
    feesCny: fromCents(feesCents),
    marginCny: fromCents(marginCents),
    marginPct,
    currencyTotal: fromCents(currencyTotalCents),
  };
}

export function isBelowMarginFloor(totals: QuoteTotals, rules: PricingRules): boolean {
  return totals.marginPct < rules.minimumMarginPct;
}

function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}
