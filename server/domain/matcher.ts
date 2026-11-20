import type { CatalogSku } from '../../shared/schema.js';
import type { ExtractedLine } from './extraction.js';
import { standardsCompatible } from './standards.js';

export interface MatchResult {
  sku: CatalogSku | null;
  reason: string;
}

export function matchCatalog(line: ExtractedLine, catalog: CatalogSku[]): MatchResult {
  const candidates = catalog.filter((sku) => {
    if (!sku.active) return false;
    if (sku.productType !== line.productType) return false;
    if (!standardsCompatible(line.standard, sku.standards)) return false;
    if (sku.diameterMm !== line.diameterMm) return false;
    if (sku.lengthMm !== line.lengthMm) return false;
    if (sku.material !== line.material) return false;
    if (sku.strengthGrade !== line.strengthGrade) return false;
    if (sku.surfaceTreatment !== line.surfaceTreatment) return false;
    if (line.threadPitchMm !== null && sku.threadPitchMm !== line.threadPitchMm) return false;
    return true;
  });

  if (candidates.length === 1) {
    return {
      sku: candidates[0],
      reason: `硬匹配成功：产品、标准等价组、尺寸、材质、强度、表面处理${line.threadPitchMm !== null ? '和螺距' : ''}全部一致。`,
    };
  }

  if (candidates.length > 1) {
    candidates.sort((a, b) => a.sku.localeCompare(b.sku));
    return {
      sku: candidates[0],
      reason: `找到 ${candidates.length} 个完全等价的目录 SKU，按 SKU 编号稳定选择 ${candidates[0].sku}。`,
    };
  }

  return {
    sku: null,
    reason: `目录中没有同时满足 ${describeLine(line)} 的在售 SKU；系统不会用相似规格替代。`,
  };
}

function describeLine(line: ExtractedLine): string {
  const pitch = line.threadPitchMm === null ? '' : ` P${line.threadPitchMm}`;
  return [
    line.productType ?? '未知产品',
    line.standard ?? '未知标准',
    `M${line.diameterMm ?? '?'}x${line.lengthMm ?? '?'}${pitch}`,
    line.material ?? '未知材质',
    line.strengthGrade ?? '未知强度',
    line.surfaceTreatment ?? '未知表面',
  ].join(' / ');
}
