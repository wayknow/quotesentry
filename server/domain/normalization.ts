export function normalizeMaterial(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/\s+/g, ' ');
  if (/\b(ss\s*304|a2|stainless)\b/.test(text) && !/\ba4\b/.test(text)) return 'SS304';
  if (/\b(ss\s*316|a4)\b/.test(text)) return 'SS316';
  if (/\b(carbon|steel|cs)\b/.test(text)) return 'carbon_steel';
  return value.trim();
}

export function normalizeStrength(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toUpperCase().replace(/\s+/g, '');
  if (/\b10\.9\b/.test(text)) return '10.9';
  if (/\b12\.9\b/.test(text)) return '12.9';
  if (/\b8\.8\b/.test(text)) return '8.8';
  if (/A4-?80/.test(text)) return 'A4-80';
  if (/A2-?70|A2GRADE/.test(text)) return 'A2-70';
  return value.trim();
}

export function normalizeSurface(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/\s+/g, ' ');
  if (/\b(hdg|hot[- ]?dip|hot dip|galvanized)\b/.test(text)) return 'hdg';
  if (/\b(zinc|zn|electro[- ]?zinc)\b/.test(text)) return 'zinc';
  if (/\b(plain|black|uncoated)\b/.test(text)) return 'plain';
  return value.trim();
}

export function normalizeUnit(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/\s+/g, '');
  if (['pcs', 'pc', 'piece', 'pieces', 'unit', 'units'].includes(text)) return 'pcs';
  if (text === 'box' || text === 'boxes') return 'boxes';
  if (text === 'set' || text === 'sets') return 'sets';
  if (text === 'kg' || text === 'kgs') return 'kg';
  return text;
}

export function normalizeProductType(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/\s+/g, '_');
  if (text.includes('bolt')) return 'hex_bolt';
  if (text.includes('screw')) return 'screw';
  if (text.includes('nut')) return 'hex_nut';
  if (text.includes('washer')) return 'washer';
  return text;
}

export function displayMaterial(value: string | null): string {
  if (!value) return '未提供';
  if (value === 'carbon_steel') return '碳钢';
  if (value === 'SS304') return '不锈钢 A2 / SS304';
  if (value === 'SS316') return '不锈钢 A4 / SS316';
  return value;
}

export function displaySurface(value: string | null): string {
  if (!value) return '未提供';
  if (value === 'zinc') return '镀锌';
  if (value === 'hdg') return '热镀锌';
  if (value === 'plain') return '本色/发黑';
  return value;
}
