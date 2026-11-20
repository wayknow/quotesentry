export type StandardGroup = 'full_thread' | 'partial_thread';

const STANDARD_GROUPS: Record<StandardGroup, string[]> = {
  full_thread: ['DIN 933', 'ISO 4017', 'GB/T 5783'],
  partial_thread: ['DIN 931', 'ISO 4014', 'GB/T 5782'],
};

export function normalizeStandard(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value.trim().toUpperCase();
  text = text.replace(/GB\s*\/?\s*T\s*/g, 'GB/T ');
  text = text.replace(/DIN\s*/g, 'DIN ');
  text = text.replace(/ISO\s*/g, 'ISO ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^GB\/T\s*(\d+)/, 'GB/T $1');
  return text || null;
}

export function standardGroup(value: string | null | undefined): StandardGroup | null {
  const normalized = normalizeStandard(value);
  if (!normalized) return null;
  for (const [group, standards] of Object.entries(STANDARD_GROUPS) as Array<[StandardGroup, string[]]>) {
    if (standards.includes(normalized)) return group;
  }
  return null;
}

export function standardsCompatible(requested: string | null, catalogStandards: string[]): boolean {
  const group = standardGroup(requested);
  if (!group) return false;
  return catalogStandards.some((standard) => standardGroup(standard) === group);
}

export function standardGroupLabel(group: StandardGroup | null): string {
  if (!group) return '未知标准';
  return group === 'full_thread' ? '全螺纹等价组（DIN 933 / ISO 4017 / GB/T 5783）' : '半螺纹等价组（DIN 931 / ISO 4014 / GB/T 5782）';
}
