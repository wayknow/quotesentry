import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type {
  AuditEvent,
  BootstrapResponse,
  Customer,
  RfqDocument,
  RfqLine,
} from '../../shared/schema.js';
import {
  analyzeRfq,
  approveRfq,
  createTextRfq,
  downloadExport,
  getBootstrap,
  overrideRfq,
  resetDemo,
  uploadRfq,
} from './api.js';
import {
  DOC_STATUS_LABEL,
  FIELD_LABEL,
  LINE_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  dimensionLabel,
  formatCny,
  formatDate,
  formatUsd,
  materialLabel,
  round2,
  statusTone,
  surfaceLabel,
} from './ui.js';

type Tab = 'review' | 'approval' | 'audit' | 'catalog';
type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null;
type CatalogItem = BootstrapResponse['catalog'][number];

const SOURCE_LABEL: Record<RfqDocument['sourceType'], string> = {
  text: '邮件文本',
  xlsx: 'Excel',
  csv: 'CSV',
  seed: '样例',
};

const AUDIT_LABEL: Record<string, string> = {
  SEEDED: '载入样例',
  RECEIVED: '收到询价',
  ANALYZED: '完成审单',
  OVERRIDE: '毛利 override',
  APPROVED: '审批通过',
  EXPORTED: '导出客户文件',
};

function tabFromUrl(): Tab {
  const value = new URLSearchParams(window.location.search).get('tab');
  return value === 'approval' || value === 'audit' || value === 'catalog' ? value : 'review';
}

function documentIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('doc');
}

export default function App() {
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<RfqLine | null>(null);

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (selectedId) url.searchParams.set('doc', selectedId);
    window.history.replaceState(null, '', url);
  }, [data, selectedId, tab]);

  const selectedDoc = data?.documents.find((doc) => doc.id === selectedId) ?? null;
  const customer = selectedDoc
    ? data?.customers.find((item) => item.id === selectedDoc.customerId) ?? null
    : null;

  async function loadInitial() {
    setLoading(true);
    try {
      const next = await getBootstrap();
      setData(next);
      const requestedId = documentIdFromUrl();
      const preferred = next.documents.find((doc) => doc.id === requestedId)
        ?? next.documents.find((doc) => doc.id === 'seed-08')
        ?? next.documents[0];
      setSelectedId(preferred?.id ?? null);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function refresh(preferredId?: string) {
    const next = await getBootstrap();
    setData(next);
    const target = preferredId ?? selectedId;
    if (target && next.documents.some((doc) => doc.id === target)) setSelectedId(target);
    else setSelectedId(next.documents[0]?.id ?? null);
  }

  async function handleAnalyze() {
    if (!selectedDoc) return;
    setBusy('analyze');
    try {
      const next = await analyzeRfq(selectedDoc.id);
      await refresh(next.id);
      setTab('review');
      setNotice({ kind: 'success', message: `审单完成：${next.lines.length} 行已处理。` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate(input: { title: string; customerId: string; rawText?: string; file?: File }) {
    setBusy('create');
    try {
      const created = input.file
        ? await uploadRfq({ title: input.title, customerId: input.customerId, file: input.file })
        : await createTextRfq({
          title: input.title,
          customerId: input.customerId,
          rawText: input.rawText ?? '',
        });
      const analyzed = await analyzeRfq(created.id);
      await refresh(analyzed.id);
      setNewOpen(false);
      setTab('review');
      setNotice({ kind: 'success', message: '询价已创建并完成首轮审单。' });
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove(actor: string) {
    if (!selectedDoc) return;
    setBusy('approve');
    try {
      const next = await approveRfq(selectedDoc.id, actor);
      await refresh(next.id);
      setApproveOpen(false);
      setNotice({ kind: 'success', message: '报价已审批，可以导出客户文件。' });
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function handleOverride(lineId: string, actor: string, reason: string) {
    if (!selectedDoc) return;
    setBusy('override');
    try {
      const next = await overrideRfq(selectedDoc.id, lineId, actor, reason);
      await refresh(next.id);
      setOverrideTarget(null);
      setNotice({ kind: 'success', message: 'override 已记录到审计时间线。' });
    } catch (error) {
      showError(error);
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function handleExport(format: 'csv' | 'pdf') {
    if (!selectedDoc) return;
    setBusy(`export-${format}`);
    try {
      await downloadExport(selectedDoc.id, format);
      await refresh(selectedDoc.id);
      setNotice({ kind: 'success', message: `客户 ${format.toUpperCase()} 已生成，不含成本与毛利。` });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    setBusy('reset');
    try {
      await resetDemo();
      const next = await getBootstrap();
      setData(next);
      setSelectedId(next.documents.find((doc) => doc.id === 'seed-08')?.id ?? next.documents[0]?.id ?? null);
      setTab('review');
      setNotice({ kind: 'info', message: '演示数据已重置。' });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  }

  function showError(error: unknown) {
    setNotice({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="brand-mark large">QS</div>
        <div>
          <div className="boot-title">QuoteSentry</div>
          <div className="boot-note">正在打开报价哨兵工作台…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="boot-screen error">
        <div>
          <div className="boot-title">无法连接 QuoteSentry API</div>
          <div className="boot-note">请确认服务端已在 3001 端口启动，然后刷新页面。</div>
          <button className="btn primary" onClick={() => void loadInitial()}>重新连接</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        data={data}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setTab('review');
        }}
        onNew={() => setNewOpen(true)}
        onReset={() => void handleReset()}
        resetting={busy === 'reset'}
      />

      <main className="main-panel">
        <Topbar data={data} />

        {selectedDoc ? (
          <>
            <DocumentHeader
              doc={selectedDoc}
              customer={customer}
              busy={busy === 'analyze'}
              onAnalyze={() => void handleAnalyze()}
            />
            <TabBar tab={tab} setTab={setTab} doc={selectedDoc} catalogCount={data.catalog.length} />
            <div className="demo-strip">
              <span className="demo-dot" />
              <strong>仿真演示</strong>
              <span>客户、SKU、价格与询价均为虚构数据。系统只导出审批后的客户内容，不连接真实邮箱或 ERP。</span>
              <span className="demo-mode">SEND_MODE={data.health.sendMode}</span>
            </div>

            <div className="content-scroll">
              {tab === 'review' && (
                <ReviewTab doc={selectedDoc} busy={busy === 'analyze'} onAnalyze={() => void handleAnalyze()} />
              )}
              {tab === 'approval' && (
                <ApprovalTab
                  doc={selectedDoc}
                  customer={customer}
                  rules={data.pricingRules}
                  busy={busy}
                  onApprove={() => setApproveOpen(true)}
                  onOverride={(line) => setOverrideTarget(line)}
                  onExport={(format) => void handleExport(format)}
                />
              )}
              {tab === 'audit' && <AuditTab doc={selectedDoc} />}
              {tab === 'catalog' && (
                <CatalogTab catalog={data.catalog} revision={data.health.catalogRevision} />
              )}
            </div>
          </>
        ) : (
          <div className="blank-state">
            <div className="blank-icon">RFQ</div>
            <h2>收件箱还是空的</h2>
            <p>粘贴一封邮件询价，或上传 Excel / CSV，开始第一轮审单。</p>
            <button className="btn primary" onClick={() => setNewOpen(true)}>新建询价</button>
          </div>
        )}
      </main>

      {newOpen && (
        <NewRfqModal
          customers={data.customers}
          busy={busy === 'create'}
          onClose={() => setNewOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {approveOpen && selectedDoc && (
        <ApproveModal
          doc={selectedDoc}
          busy={busy === 'approve'}
          onClose={() => setApproveOpen(false)}
          onSubmit={handleApprove}
        />
      )}

      {overrideTarget && (
        <OverrideModal
          line={overrideTarget}
          busy={busy === 'override'}
          onClose={() => setOverrideTarget(null)}
          onSubmit={handleOverride}
        />
      )}

      {notice && (
        <div className={`toast ${notice.kind}`} role="status">
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
        </div>
      )}
    </div>
  );
}

function Sidebar(props: {
  data: BootstrapResponse;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">QS</div>
        <div>
          <div className="brand-name">QuoteSentry</div>
          <div className="brand-cn">报价哨兵</div>
        </div>
      </div>

      <div className="sidebar-workspace">
        <div className="workspace-label">工作区</div>
        <div className="workspace-name">紧固件外贸报价 <span>DEMO</span></div>
      </div>

      <button className="new-rfq" onClick={props.onNew}>
        <span className="plus">+</span>
        <span>新建询价</span>
      </button>

      <div className="inbox-header">
        <span>询价收件箱</span>
        <span className="count">{props.data.documents.length}</span>
      </div>

      <div className="doc-list">
        {props.data.documents.map((doc) => {
          const customer = props.data.customers.find((item) => item.id === doc.customerId);
          const quote = doc.quotes.find((item) => item.id === doc.currentQuoteId);
          return (
            <button
              key={doc.id}
              className={`doc-item ${props.selectedId === doc.id ? 'selected' : ''}`}
              onClick={() => props.onSelect(doc.id)}
            >
              <div className="doc-item-top">
                <span className={`status-dot ${statusTone(doc.status)}`} />
                <span className="doc-item-title">{doc.title}</span>
                <span className="doc-time">{formatDate(doc.updatedAt, false)}</span>
              </div>
              <div className="doc-item-meta">
                <span>{customer?.name ?? doc.customerId}</span>
                <span>·</span>
                <span>{SOURCE_LABEL[doc.sourceType]}</span>
              </div>
              <div className="doc-item-bottom">
                <span className={`mini-status ${statusTone(doc.status)}`}>{DOC_STATUS_LABEL[doc.status]}</span>
                {doc.lines.length > 0 && <span>{doc.lines.length} 行</span>}
                {quote && <span>{formatUsd(quote.currencyTotal)}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className={`engine-card ${props.data.health.engine}`}>
          <div className="engine-card-head">
            <span className={`pulse ${props.data.health.engine}`} />
            <span>{props.data.health.engine === 'llm' ? 'DeepSeek 已接入' : '规则模式'}</span>
          </div>
          <div className="engine-card-note">
            {props.data.health.engine === 'llm'
              ? `${props.data.health.model} · 仅做字段抽取`
              : '未配置 DEEPSEEK_API_KEY；界面不冒充 AI'}
          </div>
        </div>
        <button className="reset-link" onClick={props.onReset} disabled={props.resetting}>
          {props.resetting ? '正在重置…' : '重置演示数据'}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ data }: { data: BootstrapResponse }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>QuoteSentry</span>
        <span className="slash">/</span>
        <strong>询价审单</strong>
      </div>
      <div className="topbar-actions">
        <div className={`engine-pill ${data.health.engine}`}>
          <span className={`pulse ${data.health.engine}`} />
          {data.health.engine === 'llm' ? `DeepSeek · ${data.health.model}` : '确定性规则引擎'}
        </div>
        <div className={`send-pill ${data.health.sendMode === 'disabled' ? 'off' : ''}`}>
          <span className="lock-dot" />
          客户外发：{data.health.sendMode === 'disabled' ? '已禁用' : data.health.sendMode}
        </div>
      </div>
    </header>
  );
}

function DocumentHeader(props: {
  doc: RfqDocument;
  customer: Customer | null;
  busy: boolean;
  onAnalyze: () => void;
}) {
  const locked = props.doc.quotes.some((quote) => quote.status === 'APPROVED' || quote.status === 'EXPORTED');
  return (
    <section className="doc-header">
      <div className="doc-heading">
        <div className="eyebrow">RFQ · {SOURCE_LABEL[props.doc.sourceType]}</div>
        <h1>{props.doc.title}</h1>
        <div className="doc-subline">
          <span>{props.customer?.name ?? props.doc.customerId}</span>
          <span>·</span>
          <span>{props.customer?.country ?? '—'}</span>
          <span>·</span>
          <span>收到 {formatDate(props.doc.createdAt)}</span>
          <span>·</span>
          <span className="hash">#{props.doc.inputHash.slice(0, 8)}</span>
        </div>
      </div>
      <div className="doc-header-actions">
        <span className={`status-pill large ${statusTone(props.doc.status)}`}>{DOC_STATUS_LABEL[props.doc.status]}</span>
        <button className="btn secondary" onClick={props.onAnalyze} disabled={props.busy || locked}>
          {props.busy ? <span className="spinner" /> : <span className="btn-glyph">↻</span>}
          {props.doc.lines.length > 0 ? '重新分析' : '开始分析'}
        </button>
      </div>
    </section>
  );
}

function TabBar(props: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  doc: RfqDocument;
  catalogCount: number;
}) {
  const quote = props.doc.quotes.find((item) => item.id === props.doc.currentQuoteId);
  const tabs: Array<{ id: Tab; label: string; meta?: string }> = [
    { id: 'review', label: '审单工作台', meta: props.doc.lines.length ? String(props.doc.lines.length) : undefined },
    { id: 'approval', label: '报价审批', meta: quote ? QUOTE_STATUS_LABEL[quote.status] : undefined },
    { id: 'audit', label: '审计时间线', meta: String(props.doc.audit.length) },
    { id: 'catalog', label: '商品目录', meta: String(props.catalogCount) },
  ];
  return (
    <nav className="tab-bar" aria-label="工作区视图">
      {tabs.map((item) => (
        <button
          key={item.id}
          className={`tab ${props.tab === item.id ? 'active' : ''}`}
          onClick={() => props.setTab(item.id)}
        >
          {item.label}
          {item.meta && <span className="tab-meta">{item.meta}</span>}
        </button>
      ))}
    </nav>
  );
}

function ReviewTab(props: { doc: RfqDocument; busy: boolean; onAnalyze: () => void }) {
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const lines = props.doc.lines;
  const counts = {
    priced: lines.filter((line) => line.status === 'PRICED' || line.status === 'APPROVED').length,
    clarify: lines.filter((line) => line.status === 'NEEDS_CLARIFICATION').length,
    noMatch: lines.filter((line) => line.status === 'NO_MATCH').length,
    margin: lines.filter((line) => line.status === 'MARGIN_ALERT').length,
  };

  if (lines.length === 0) {
    return (
      <div className="empty-workspace">
        <div className="empty-illustration">
          <div className="paper-line wide" />
          <div className="paper-line" />
          <div className="paper-line short" />
          <div className="scan-line" />
        </div>
        <h2>{props.doc.status === 'FAILED' ? '没有识别到产品行' : '询价尚未审单'}</h2>
        <p>
          {props.doc.status === 'FAILED'
            ? '模型和规则都没有抽取到可处理的产品行。请检查原文，或换一份更明确的询价。'
            : '系统会逐行抽取规格、回指原文、做完整性门禁，再决定这一行能不能报价。'}
        </p>
        <button className="btn primary" onClick={props.onAnalyze} disabled={props.busy}>
          {props.busy ? <span className="spinner light" /> : null}
          {props.busy ? '正在审单…' : '开始分析'}
        </button>
      </div>
    );
  }

  return (
    <div className="review-wrap">
      <div className="summary-row">
        <SummaryCard label="识别行数" value={lines.length} hint="逐行处理，不合并不同规格" />
        <SummaryCard label="可报价" value={counts.priced} hint="硬匹配 + 毛利达标" tone="ok" />
        <SummaryCard label="待澄清" value={counts.clarify} hint="缺参或单位冲突" tone="warn" />
        <SummaryCard label="目录外" value={counts.noMatch + counts.margin} hint="不硬选相似 SKU" tone="danger" />
      </div>

      <div className="review-grid">
        <SourcePane doc={props.doc} selectedLineId={selectedLineId} />
        <section className="lines-pane">
          <div className="pane-heading">
            <div>
              <h2>逐行审单结果</h2>
              <p>每个字段都能回指原文；异常行不会拖死整封询价。</p>
            </div>
            <span className="engine-note">{props.doc.engineMode === 'llm' ? 'LLM 抽取' : '规则抽取'}</span>
          </div>
          <div className="lines-list">
            {lines.map((line) => (
              <LineCard
                key={line.id}
                line={line}
                selected={selectedLineId === line.id}
                onSelect={() => setSelectedLineId(selectedLineId === line.id ? null : line.id)}
              />
            ))}
          </div>
          {props.doc.engineNote && (
            <div className="engine-footnote">
              <strong>本封引擎说明</strong>
              <span>{props.doc.engineNote}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard(props: { label: string; value: number; hint: string; tone?: string }) {
  return (
    <div className={`summary-card ${props.tone ?? ''}`}>
      <div className="summary-top">
        <span>{props.label}</span>
        <strong>{props.value}</strong>
      </div>
      <div className="summary-hint">{props.hint}</div>
    </div>
  );
}

function SourcePane({ doc, selectedLineId }: { doc: RfqDocument; selectedLineId: string | null }) {
  const selectedLine = doc.lines.find((line) => line.id === selectedLineId) ?? null;
  const rawLines = doc.rawText.split(/\r?\n/);
  const verified = doc.lines.filter((line) => line.evidence.every((item) => item.verified)).length;
  return (
    <aside className="source-pane">
      <div className="source-header">
        <div>
          <div className="source-kicker">SOURCE · {SOURCE_LABEL[doc.sourceType]}</div>
          <h2>原始询价</h2>
        </div>
        <span className="evidence-count">{verified}/{doc.lines.length} 行有证据</span>
      </div>
      <div className="source-code">
        {rawLines.map((rawLine, index) => {
          const converted = doc.lines.find((line) => rawLineMatches(rawLine, line.rawText));
          const active = Boolean(selectedLine && rawLineMatches(rawLine, selectedLine.rawText));
          return (
            <div
              key={`${index}-${rawLine.slice(0, 12)}`}
              className={`source-line ${converted ? 'extracted' : ''} ${active ? 'active' : ''}`}
            >
              <span className="line-number">{index + 1}</span>
              <span className="line-text">{rawLine || ' '}</span>
            </div>
          );
        })}
      </div>
      <div className="source-footer">
        <span className="scan-icon">⌖</span>
        <span>高亮行由抽取出的原文片段匹配；未验证片段不会进入正式报价。</span>
      </div>
    </aside>
  );
}

function rawLineMatches(rawLine: string, extracted: string): boolean {
  const left = normalize(rawLine);
  const right = normalize(extracted);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function LineCard({ line, selected, onSelect }: { line: RfqLine; selected: boolean; onSelect: () => void }) {
  const [copied, setCopied] = useState(false);
  const evidenceOk = line.evidence.length > 0 && line.evidence.every((item) => item.verified);
  async function copyClarification() {
    if (!line.clarification) return;
    try {
      await navigator.clipboard.writeText(line.clarification);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`line-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="line-card-head">
        <div className="line-index">ROW {String(line.lineIndex).padStart(2, '0')}</div>
        <span className={`status-pill ${statusTone(line.status)}`}>{LINE_STATUS_LABEL[line.status]}</span>
        {line.pricing && <span className="sku-badge">{line.pricing.sku}</span>}
      </div>

      <div className="raw-excerpt">“{line.rawText}”</div>

      <div className="spec-grid">
        <Spec label="尺寸" value={dimensionLabel(line)} strong />
        <Spec label="标准" value={line.standard ?? '—'} />
        <Spec label="材质" value={materialLabel(line.material)} />
        <Spec label="强度" value={line.strengthGrade ?? '—'} />
        <Spec label="表面" value={surfaceLabel(line.surfaceTreatment)} />
        <Spec label="数量" value={line.quantity === null ? '—' : `${line.quantity.toLocaleString('en-US')} ${line.unit ?? ''}`} />
      </div>

      {(line.missingFields.length > 0 || line.conflicts.length > 0) && (
        <div className="issue-box">
          {line.missingFields.length > 0 && (
            <div className="issue-row">
              <span className="issue-icon">!</span>
              <span>缺少：{line.missingFields.map((field) => FIELD_LABEL[field] ?? field).join('、')}</span>
            </div>
          )}
          {line.conflicts.map((conflict) => (
            <div className="issue-row conflict" key={conflict}>
              <span className="issue-icon">×</span>
              <span>{conflict}</span>
            </div>
          ))}
        </div>
      )}

      {line.pricing ? (
        <div className="price-box">
          <div className="price-main">
            <span className="price-label">客户单价</span>
            <strong>{formatUsd(line.pricing.currencyAmount / line.pricing.quantity)}</strong>
            <span className="price-unit">/ pc</span>
          </div>
          <div className="price-detail">
            <span>阶梯 {line.pricing.tierLabel}</span>
            <span>折扣 {(line.pricing.customerDiscount * 100).toFixed(0)}%</span>
            <span>行毛利 {line.pricing.lineMarginPct.toFixed(1)}%</span>
          </div>
          <div className="price-total">
            <span>行合计</span>
            <strong>{formatUsd(line.pricing.currencyAmount)}</strong>
          </div>
        </div>
      ) : (
        <div className={`match-box ${line.status === 'NO_MATCH' ? 'negative' : ''}`}>
          <span className="match-icon">{line.status === 'NO_MATCH' ? '∅' : '…'}</span>
          <div>
            <strong>{line.status === 'NO_MATCH' ? '目录内无硬匹配' : '暂不生成正式价格'}</strong>
            <p>{line.matchReason ?? line.conflicts[0] ?? '请先补齐或确认规格。'}</p>
          </div>
        </div>
      )}

      {line.matchReason && line.pricing && <div className="match-reason">{line.matchReason}</div>}

      <div className="line-footer">
        <div className={`evidence-tag ${evidenceOk ? 'ok' : 'bad'}`}>
          <span>{evidenceOk ? '✓' : '×'}</span>
          {evidenceOk ? `证据已回指 ${line.evidence[0]?.location ?? ''}` : '证据未验证'}
        </div>
        {line.clarification && (
          <button
            className="copy-btn"
            onClick={(event) => {
              event.stopPropagation();
              void copyClarification();
            }}
          >
            {copied ? '已复制' : '复制英文澄清草稿'}
          </button>
        )}
      </div>

      {line.clarification && (
        <div className="clarification" onClick={(event) => event.stopPropagation()}>
          <div className="clarification-label">CLARIFICATION DRAFT</div>
          <p>{line.clarification}</p>
        </div>
      )}
    </article>
  );
}

function Spec({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`spec ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ApprovalTab(props: {
  doc: RfqDocument;
  customer: Customer | null;
  rules: BootstrapResponse['pricingRules'];
  busy: string | null;
  onApprove: () => void;
  onOverride: (line: RfqLine) => void;
  onExport: (format: 'csv' | 'pdf') => void;
}) {
  const quote = props.doc.quotes.find((item) => item.id === props.doc.currentQuoteId);
  if (!quote) {
    return (
      <div className="empty-workspace compact">
        <div className="blank-icon">Q</div>
        <h2>还没有生成报价</h2>
        <p>先回到审单工作台完成分析。缺参和目录外的行不会生成正式价格。</p>
      </div>
    );
  }

  const quoteLineIds = new Set(quote.lines.map((line) => line.rfqLineId));
  const excluded = props.doc.lines.filter((line) => !quoteLineIds.has(line.id));
  const marginAlerts = props.doc.lines.filter((line) => line.status === 'MARGIN_ALERT' && quoteLineIds.has(line.id));
  const canApprove = quote.status === 'READY_FOR_APPROVAL' && marginAlerts.length === 0;
  const approved = quote.status === 'APPROVED' || quote.status === 'EXPORTED';
  const fx = props.rules.cnyPerUnitCurrency;

  return (
    <div className="approval-wrap">
      <div className="approval-head">
        <div>
          <div className="eyebrow">QUOTE REVIEW · V{quote.version}</div>
          <h2>报价审批与导出</h2>
          <p>客户视图与内部成本隔离。审批人对毛利、异常和最终导出负责。</p>
        </div>
        <div className="approval-statuses">
          <span className={`status-pill large ${statusTone(quote.status)}`}>{QUOTE_STATUS_LABEL[quote.status]}</span>
          <span className="validity">有效期至 {quote.validUntil}</span>
        </div>
      </div>

      {excluded.length > 0 && (
        <div className="exclusion-banner">
          <span className="issue-icon">!</span>
          <div>
            <strong>本报价仅包含 {quote.lines.length} 条可报价行</strong>
            <p>{excluded.length} 条异常行未进入客户报价：{excluded.map((line) => `ROW ${line.lineIndex} ${LINE_STATUS_LABEL[line.status]}`).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="approval-grid">
        <section className="customer-quote-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">CUSTOMER VIEW</span>
              <h3>客户可见报价</h3>
            </div>
            <span className="isolation-badge">不含成本 / 毛利</span>
          </div>
          <div className="customer-meta">
            <div><span>Bill to</span><strong>{props.customer?.name ?? quote.customerId}</strong></div>
            <div><span>Incoterm</span><strong>{quote.incoterm}</strong></div>
            <div><span>Currency</span><strong>{quote.currency}</strong></div>
            <div><span>Valid</span><strong>{quote.validUntil}</strong></div>
          </div>
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>SKU / 描述</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>金额</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <div className="table-sku">{line.sku}</div>
                      <div className="table-desc">{line.name}</div>
                    </td>
                    <td>{line.quantity.toLocaleString('en-US')} {line.unit}</td>
                    <td>{round2(line.unitPriceCny / fx).toFixed(2)}</td>
                    <td className="amount">{line.currencyAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="customer-total">
            <span>Total · {quote.incoterm}</span>
            <strong>{formatUsd(quote.currencyTotal)}</strong>
          </div>
          <div className="quote-note">
            <strong>Commercial note</strong>
            <p>Prices exclude taxes and bank charges. This demo quotation is not a binding offer.</p>
          </div>
        </section>

        <aside className="internal-card">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">INTERNAL ONLY</span>
              <h3>成本与审批</h3>
            </div>
            <span className="lock-badge">内部</span>
          </div>

          <div className="margin-hero">
            <div className={`margin-ring ${quote.marginPct < props.rules.minimumMarginPct ? 'danger' : 'safe'}`}>
              <strong>{quote.marginPct.toFixed(1)}%</strong>
              <span>毛利率</span>
            </div>
            <div className="margin-copy">
              <span>底线 {props.rules.minimumMarginPct.toFixed(0)}%</span>
              <strong>{quote.marginPct < props.rules.minimumMarginPct ? '低于毛利底线' : '毛利达标'}</strong>
              <p>模拟税前口径，未计出口退税。</p>
            </div>
          </div>

          <div className="cost-grid">
            <CostItem label="销售收入" value={formatCny(quote.netSalesCny)} />
            <CostItem label="总成本" value={formatCny(quote.totalCostCny)} />
            <CostItem label="订单费用" value={formatCny(quote.feesCny)} />
            <CostItem label="毛利" value={formatCny(quote.marginCny)} strong />
          </div>

          <div className="internal-lines">
            <div className="internal-title">行级内部价格</div>
            {quote.lines.map((quoteLine) => {
              const line = props.doc.lines.find((item) => item.id === quoteLine.rfqLineId);
              return (
                <div className="internal-line" key={quoteLine.id}>
                  <div className="internal-line-top">
                    <span>{quoteLine.sku}</span>
                    <span className={quoteLine.lineMarginPct < 0 ? 'negative-text' : ''}>{quoteLine.lineMarginPct.toFixed(1)}%</span>
                  </div>
                  <div className="internal-line-meta">
                    <span>成本 {formatCny(quoteLine.lineCostCny)}</span>
                    <span>{quoteLine.tierLabel}</span>
                    <span>{LINE_STATUS_LABEL[line?.status ?? 'PRICED']}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {marginAlerts.length > 0 && (
            <div className="margin-alert-box">
              <strong>审批已锁定</strong>
              <p>{marginAlerts.length} 行低于毛利底线。只有主管填写 override 原因后才能继续，记录会进入审计。</p>
              {marginAlerts.map((line) => (
                <button className="btn override" key={line.id} onClick={() => props.onOverride(line)}>
                  Override ROW {line.lineIndex} · {line.matchedSku}
                </button>
              ))}
            </div>
          )}

          {quote.overrides.length > 0 && (
            <div className="override-log">
              <div className="internal-title">Override 记录</div>
              {quote.overrides.map((override) => (
                <div className="override-entry" key={`${override.lineId}-${override.at}`}>
                  <span>{override.actor} · {formatDate(override.at)}</span>
                  <p>{override.reason}</p>
                </div>
              ))}
            </div>
          )}

          <div className="approval-actions">
            {!approved ? (
              <button className="btn primary wide" disabled={!canApprove || props.busy === 'approve'} onClick={props.onApprove}>
                {!canApprove && marginAlerts.length > 0 ? '请先处理毛利越界' : '审批这份报价'}
              </button>
            ) : (
              <div className="approved-block">
                <span className="approved-check">✓</span>
                <div>
                  <strong>已由 {quote.approvedBy} 审批</strong>
                  <span>{formatDate(quote.approvedAt)}</span>
                </div>
              </div>
            )}
            <div className="export-row">
              <button className="btn secondary" disabled={!approved || props.busy === 'export-csv'} onClick={() => props.onExport('csv')}>
                {props.busy === 'export-csv' ? <span className="spinner dark" /> : '↓'} CSV
              </button>
              <button className="btn secondary" disabled={!approved || props.busy === 'export-pdf'} onClick={() => props.onExport('pdf')}>
                {props.busy === 'export-pdf' ? <span className="spinner dark" /> : '↓'} PDF
              </button>
              <button className="btn disabled-send" disabled title="SEND_MODE=disabled；比赛版不向客户外发">发送已禁用</button>
            </div>
            {!approved && <p className="approval-hint">审批后才会解锁客户 CSV / PDF 导出。</p>}
          </div>

          <div className="rule-stamp">
            计价规则 {props.rules.version} · 汇率 1 USD = {props.rules.cnyPerUnitCurrency} CNY
          </div>
        </aside>
      </div>
    </div>
  );
}

function CostItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`cost-item ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuditTab({ doc }: { doc: RfqDocument }) {
  const events = [...doc.audit].reverse();
  return (
    <div className="audit-wrap">
      <div className="section-heading">
        <div>
          <div className="eyebrow">AUDIT TRAIL</div>
          <h2>可追溯的每一步</h2>
          <p>模型、规则版本、输入输出哈希、审批人与 override 原因都写入追加式事件。</p>
        </div>
        <span className="audit-count">{events.length} 条事件</span>
      </div>
      <div className="audit-list">
        {events.map((event, index) => (
          <AuditItem key={event.id} event={event} last={index === events.length - 1} />
        ))}
      </div>
    </div>
  );
}

function AuditItem({ event, last }: { event: AuditEvent; last: boolean }) {
  const tone = event.type === 'OVERRIDE' ? 'warn' : event.type === 'APPROVED' || event.type === 'EXPORTED' ? 'ok' : 'info';
  return (
    <div className="audit-item">
      <div className="audit-rail">
        <span className={`audit-dot ${tone}`} />
        {!last && <span className="audit-line" />}
      </div>
      <div className="audit-body">
        <div className="audit-top">
          <div>
            <span className={`audit-type ${tone}`}>{AUDIT_LABEL[event.type] ?? event.type}</span>
            <span className="audit-actor">{event.actor}</span>
          </div>
          <span className="audit-time">{formatDate(event.at)}</span>
        </div>
        <p>{event.message}</p>
        <div className="audit-meta">
          {event.model && <span>model: {event.model}</span>}
          {event.pricingRuleVersion && <span>rule: {event.pricingRuleVersion}</span>}
          {event.catalogRevision && <span>catalog: {event.catalogRevision}</span>}
          {event.inputHash && <span>input: {event.inputHash.slice(0, 10)}</span>}
          {event.outputHash && <span>output: {event.outputHash.slice(0, 10)}</span>}
        </div>
      </div>
    </div>
  );
}

function CatalogTab({ catalog, revision }: { catalog: CatalogItem[]; revision: string }) {
  const [query, setQuery] = useState('');
  const filtered = catalog.filter((sku) => {
    const haystack = `${sku.sku} ${sku.name} ${sku.standards.join(' ')} ${sku.material} ${sku.strengthGrade} ${sku.surfaceTreatment}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  return (
    <div className="catalog-wrap">
      <div className="section-heading catalog-heading">
        <div>
          <div className="eyebrow">CATALOG · REV {revision}</div>
          <h2>仿真商品目录</h2>
          <p>{catalog.length} 个在售六角螺栓 SKU；匹配采用硬过滤，不使用相似度替代。</p>
        </div>
        <label className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU / 标准 / 材质" />
        </label>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>规格</th>
              <th>标准组</th>
              <th>材质 / 强度</th>
              <th>表面</th>
              <th>基础 EXW</th>
              <th>交期</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sku) => (
              <tr key={sku.sku}>
                <td><span className="sku-badge static">{sku.sku}</span></td>
                <td><strong>M{sku.diameterMm} × {sku.lengthMm}</strong><span className="catalog-name">{sku.name}</span></td>
                <td>{sku.standards.slice(0, 2).join(' / ')}</td>
                <td>{materialLabel(sku.material)} · {sku.strengthGrade}</td>
                <td>{surfaceLabel(sku.surfaceTreatment)}</td>
                <td className="amount">{formatCny(sku.baseExwPriceCny)}</td>
                <td>{sku.leadTimeDays} 天</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="no-results">没有匹配的 SKU。</div>}
      </div>
    </div>
  );
}

function NewRfqModal(props: {
  customers: Customer[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; customerId: string; rawText?: string; file?: File }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState(props.customers[0]?.id ?? 'CUST-001');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!file && !rawText.trim()) {
      setError('请粘贴询价文本，或选择一个 Excel / CSV / TXT 文件。');
      return;
    }
    if (!file && !title.trim()) {
      setError('请填写询价标题。');
      return;
    }
    try {
      await props.onSubmit({
        title: title.trim() || file?.name || '新询价',
        customerId,
        rawText: file ? undefined : rawText,
        file: file ?? undefined,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }

  return (
    <Modal title="新建询价" subtitle="粘贴邮件，或上传 Excel / CSV" onClose={props.onClose} busy={props.busy} wide>
      <form onSubmit={(event) => void submit(event)} className="modal-form">
        <div className="form-row two">
          <label>
            <span>询价标题</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：德国客户三行询价" autoFocus />
          </label>
          <label>
            <span>客户</span>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              {props.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name} · {customer.country}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="file-drop">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              if (event.target.files?.[0] && !title) {
                setTitle(event.target.files[0].name.replace(/\.[^.]+$/, ''));
              }
            }}
          />
          <span className="file-icon">XLS</span>
          <div>
            <strong>{file ? file.name : '选择询价文件'}</strong>
            <p>{file ? `${(file.size / 1024).toFixed(1)} KB · 上传后将使用表头规则抽取` : '支持 .xlsx / .xls / .csv / .txt，最大 5 MB'}</p>
          </div>
        </label>

        <div className="or-divider"><span>或者粘贴邮件正文</span></div>
        <label>
          <span>询价原文</span>
          <textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={'Subject: RFQ M12x75\n\nPlease quote 200 pcs M12x75 hex bolt DIN 933 grade 8.8 carbon steel zinc plated.'}
            rows={9}
            disabled={Boolean(file)}
          />
        </label>
        <div className="form-note">创建后会自动分析；模型不可用时会明确降级为规则模式，不会冒充 AI。</div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={props.onClose} disabled={props.busy}>取消</button>
          <button type="submit" className="btn primary" disabled={props.busy}>
            {props.busy ? <span className="spinner light" /> : null}
            {props.busy ? '正在创建并审单…' : '创建并分析'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ApproveModal(props: {
  doc: RfqDocument;
  busy: boolean;
  onClose: () => void;
  onSubmit: (actor: string) => Promise<void>;
}) {
  const quote = props.doc.quotes.find((item) => item.id === props.doc.currentQuoteId);
  const [actor, setActor] = useState('王主管 / Supervisor');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await props.onSubmit(actor.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }
  return (
    <Modal title="确认审批" subtitle="审批后报价将锁定，并解锁客户导出" onClose={props.onClose} busy={props.busy}>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <div className="approval-summary-box">
          <div><span>报价版本</span><strong>v{quote?.version}</strong></div>
          <div><span>客户金额</span><strong>{formatUsd(quote?.currencyTotal ?? 0)}</strong></div>
          <div><span>毛利率</span><strong>{(quote?.marginPct ?? 0).toFixed(1)}%</strong></div>
          <div><span>可报价行</span><strong>{quote?.lines.length ?? 0}</strong></div>
        </div>
        <label>
          <span>审批人</span>
          <input value={actor} onChange={(event) => setActor(event.target.value)} autoFocus />
        </label>
        <div className="form-note">点击审批即表示你已核对客户报价、内部成本、毛利与异常说明。该动作会写入审计时间线。</div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={props.onClose} disabled={props.busy}>取消</button>
          <button type="submit" className="btn primary" disabled={props.busy || !actor.trim()}>
            {props.busy && <span className="spinner light" />}
            确认审批
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OverrideModal(props: {
  line: RfqLine;
  busy: boolean;
  onClose: () => void;
  onSubmit: (lineId: string, actor: string, reason: string) => Promise<void>;
}) {
  const [actor, setActor] = useState('王主管 / Supervisor');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await props.onSubmit(props.line.id, actor.trim(), reason.trim());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    }
  }
  return (
    <Modal title="毛利越界 Override" subtitle="该动作将被永久记录" onClose={props.onClose} busy={props.busy}>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <div className="warning-box">
          <strong>{props.line.matchedSku} · ROW {props.line.lineIndex}</strong>
          <p>{props.line.conflicts[0] ?? '当前报价低于毛利底线。'}</p>
        </div>
        <label>
          <span>主管 / 审批人</span>
          <input value={actor} onChange={(event) => setActor(event.target.value)} autoFocus />
        </label>
        <label>
          <span>Override 原因</span>
          <textarea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="例如：客户为年度框架客户，本单用于补件，接受本轮毛利低于底线。"
          />
        </label>
        <div className="form-note">缺参和目录外行不能被 override；只有毛利底线可以通过主管审批例外处理。</div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={props.onClose} disabled={props.busy}>取消</button>
          <button type="submit" className="btn danger-btn" disabled={props.busy || reason.trim().length < 5 || !actor.trim()}>
            {props.busy && <span className="spinner light" />}
            记录 override
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal(props: {
  title: string;
  subtitle: string;
  busy: boolean;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!props.busy) props.onClose(); }}>
      <div className={`modal ${props.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{props.title}</h2>
            <p>{props.subtitle}</p>
          </div>
          <button className="modal-close" onClick={props.onClose} disabled={props.busy} aria-label="关闭">×</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}
