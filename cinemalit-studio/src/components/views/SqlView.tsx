// src/components/views/SqlView.tsx — Live ClickHouse Integration
import { useState, useCallback, useEffect, useRef } from 'react';
import { Table2, Play, Database, Zap, AlertCircle, ChevronRight, ChevronDown, Sparkles, Clock } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import styles from './SqlView.module.css';

// ─── Types ─────────────────────────────────────────────────────────────────
interface ColMeta { name: string; type: string }
interface QueryResult {
  meta: ColMeta[];
  data: (string | number)[][];
  rows: number;
  elapsed?: number;
  error?: string;
}
interface SchemaTable { [table: string]: { column: string; type: string }[] }

// ─── Preset queries ─────────────────────────────────────────────────────────
const PRESETS: { label: string; sql: string; icon: string }[] = [
  {
    label: 'All Scenes',
    icon: '🎬',
    sql: `SELECT scene_number, int_ext, location, time_of_day, page_count, shoot_day, status\nFROM cinemalit.scenes\nORDER BY shoot_day, scene_id`,
  },
  {
    label: 'VFX Scenes',
    icon: '⚡',
    sql: `SELECT scene_number, location, description\nFROM cinemalit.scenes\nWHERE status = 'vfx_required'\nORDER BY shoot_day`,
  },
  {
    label: 'Budget by Category',
    icon: '💰',
    sql: `SELECT category,\n  sum(budgeted_usd) AS budgeted,\n  sum(actual_usd)   AS actual,\n  sum(actual_usd) - sum(budgeted_usd) AS variance\nFROM cinemalit.budget_items\nGROUP BY category\nORDER BY budgeted DESC`,
  },
  {
    label: 'Cast + Days',
    icon: '🎭',
    sql: `SELECT character_name, actor_name, role_type,\n  day_rate_usd,\n  total_days,\n  day_rate_usd * total_days AS total_cost\nFROM cinemalit.cast_members\nORDER BY total_cost DESC`,
  },
  {
    label: 'Night Exteriors',
    icon: '🌙',
    sql: `SELECT s.scene_number, s.location, s.page_count,\n  count(sc.cast_id) AS cast_count\nFROM cinemalit.scenes s\nJOIN cinemalit.scene_cast sc ON s.scene_id = sc.scene_id\nWHERE s.int_ext = 'EXT' AND s.time_of_day = 'NIGHT'\nGROUP BY s.scene_number, s.location, s.page_count\nORDER BY cast_count DESC`,
  },
  {
    label: 'Budget Overruns',
    icon: '🚨',
    sql: `SELECT description, category, budgeted_usd, actual_usd,\n  actual_usd - budgeted_usd AS overrun,\n  vendor\nFROM cinemalit.budget_items\nWHERE actual_usd > budgeted_usd\nORDER BY overrun DESC`,
  },
  {
    label: 'Shot Count / Scene',
    icon: '📷',
    sql: `SELECT s.scene_number, s.location,\n  count(sh.shot_id) AS shots,\n  groupArray(sh.framing) AS framings\nFROM cinemalit.scenes s\nJOIN cinemalit.shots sh ON s.scene_id = sh.scene_id\nGROUP BY s.scene_number, s.location\nORDER BY shots DESC`,
  },
  {
    label: 'All Elements',
    icon: '🎁',
    sql: `SELECT element_type, name, cost_usd, vendor, status\nFROM cinemalit.elements\nORDER BY cost_usd DESC`,
  },
];

// ─── Component ─────────────────────────────────────────────────────────────
export function SqlView() {
  const [sql, setSql]             = useState(PRESETS[0].sql);
  const [result, setResult]       = useState<QueryResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [chStatus, setChStatus]   = useState<'checking' | 'online' | 'offline'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [schema, setSchema]       = useState<SchemaTable>({});
  const [expanded, setExpanded]   = useState<Record<string,boolean>>({});
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResult, setAiResult]   = useState<{ sql: string; interpretation: string; data: (string|number)[][] ; meta: ColMeta[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql'|'ai'>('sql');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── Health check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const t0 = performance.now();
        const r = await fetch('/api/clickhouse/ping');
        const ms = Math.round(performance.now() - t0);
        if (r.ok) {
          setChStatus('online');
          setLatencyMs(ms);
        } else {
          setChStatus('offline');
        }
      } catch {
        setChStatus('offline');
      }
    };
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, []);

  // ── Schema fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (chStatus !== 'online') return;
    apiFetch('/api/clickhouse/schema')
      .then(r => r.json())
      .then(d => {
        if (d.status === 'ok') setSchema(d.schema);
      })
      .catch(() => {});
  }, [chStatus]);

  // ── Run SQL ───────────────────────────────────────────────────────────────
  const runQuery = useCallback(async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    const t0 = performance.now();
    try {
      const resp = await apiFetch('/api/clickhouse/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const d = await resp.json();
      const elapsed = Math.round(performance.now() - t0);
      if (d.status === 'ok') {
        setResult({ meta: d.meta, data: d.data, rows: d.rows, elapsed });
      } else {
        setResult({ meta: [], data: [], rows: 0, error: d.error });
      }
    } catch (e: unknown) {
      setResult({ meta: [], data: [], rows: 0, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, [sql]);

  // ── Keyboard shortcut: Cmd/Ctrl+Enter ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && activeTab === 'sql') {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runQuery, activeTab]);

  // ── AI Ask ────────────────────────────────────────────────────────────────
  const askAi = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const resp = await apiFetch('/api/ai/ask-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const d = await resp.json();
      if (d.status === 'ok') {
        setAiResult({ sql: d.sql, interpretation: d.interpretation, data: d.data, meta: d.meta });
      } else {
        setAiResult({ sql: '', interpretation: `Error: ${d.error}`, data: [], meta: [] });
      }
    } catch (e: unknown) {
      setAiResult({ sql: '', interpretation: String(e), data: [], meta: [] });
    } finally {
      setAiLoading(false);
    }
  };

  const tableNames = Object.keys(schema);

  return (
    <div className={styles.view}>
      {/* ── Left sidebar ──────────────────────────────────────────────── */}
      <div className={styles.side}>
        <div className={styles.connHeader}>
          <Database size={13} />
          <span>ClickHouse</span>
        </div>
        <div className={`${styles.connStatus} ${chStatus === 'online' ? styles.online : styles.offline}`}>
          <span className={styles.dot} />
          {chStatus === 'checking' ? 'Connecting…' :
           chStatus === 'online'   ? `Connected · ${latencyMs}ms` : 'Offline'}
        </div>
        <div className={styles.dbLabel}>DB: cinemalit</div>

        {/* Schema browser */}
        <div className={styles.sectionLabel}>Schema</div>
        {tableNames.length > 0 ? tableNames.map(tbl => (
          <div key={tbl}>
            <div
              className={styles.schemaTable}
              onClick={() => setExpanded(p => ({ ...p, [tbl]: !p[tbl] }))}
            >
              {expanded[tbl] ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
              <Table2 size={11} color="var(--cyan)" />
              <span>{tbl}</span>
            </div>
            {expanded[tbl] && schema[tbl].map(col => (
              <div key={col.column} className={styles.schemaCol}>
                <span className={styles.colName}>{col.column}</span>
                <span className={styles.colType}>{col.type.split('(')[0]}</span>
              </div>
            ))}
          </div>
        )) : (
          <div className={styles.schemaOffline}>
            {chStatus === 'offline' ? 'Start ClickHouse to browse schema' : 'Loading…'}
          </div>
        )}

        {/* Preset queries */}
        <div className={styles.sectionLabel} style={{ marginTop: 14 }}>Quick Queries</div>
        {PRESETS.map(p => (
          <div
            key={p.label}
            className={styles.presetItem}
            onClick={() => { setSql(p.sql); setActiveTab('sql'); setResult(null); }}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </div>
        ))}
      </div>

      {/* ── Main panel ───────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Tab bar */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'sql' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Play size={11} /> SQL Console
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'ai' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={11} /> Ask AI
          </button>
        </div>

        {activeTab === 'sql' && (
          <>
            {/* Editor */}
            <div className={styles.editorArea}>
              <textarea
                ref={editorRef}
                className={styles.editor}
                value={sql}
                onChange={e => setSql(e.target.value)}
                spellCheck={false}
                placeholder="SELECT * FROM cinemalit.scenes LIMIT 10"
              />
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
              <button
                className={styles.runBtn}
                onClick={runQuery}
                disabled={loading || chStatus !== 'online'}
              >
                <Play size={12} />
                {loading ? 'Running…' : 'Run Query'}
              </button>
              <span className={styles.shortcut}>⌘↵</span>
              {result && !result.error && (
                <span className={styles.statusPill}>
                  <Clock size={10} /> {result.rows} rows · {result.elapsed}ms
                </span>
              )}
              {result?.error && (
                <span className={styles.errorPill}>
                  <AlertCircle size={10} /> Error
                </span>
              )}
            </div>

            {/* Results */}
            <div className={styles.results}>
              {result?.error && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} /> {result.error}
                </div>
              )}
              {result && !result.error && result.meta.length > 0 && (
                <table className={styles.resTable}>
                  <thead>
                    <tr>
                      {result.meta.map(col => (
                        <th key={col.name}>
                          {col.name}
                          <span className={styles.colTypeTag}>{col.type.split('(')[0]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!result && !loading && (
                <div className={styles.emptyState}>
                  <Database size={32} color="var(--t4)" />
                  <p>Run a query to see results from ClickHouse</p>
                </div>
              )}
              {loading && (
                <div className={styles.emptyState}>
                  <div className={styles.spinner} />
                  <p>Querying ClickHouse…</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'ai' && (
          <div className={styles.aiPanel}>
            <div className={styles.aiHeader}>
              <Sparkles size={16} color="var(--gold)" />
              <div>
                <div className={styles.aiTitle}>Ask AI Director</div>
                <div className={styles.aiSubtitle}>Ask in plain English — Gemini writes the SQL, queries ClickHouse, and interprets the results.</div>
              </div>
            </div>

            <div className={styles.aiExamples}>
              {[
                'What is the total budget overrun?',
                'Which scenes need VFX?',
                'Who are the most expensive cast members?',
                'How many night exterior scenes do we have?',
                'What is the total spend on production?',
              ].map(q => (
                <button
                  key={q}
                  className={styles.aiChip}
                  onClick={() => setAiQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className={styles.aiInputRow}>
              <input
                className={styles.aiInput}
                type="text"
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                placeholder="Ask about your production data…"
                onKeyDown={e => e.key === 'Enter' && askAi()}
              />
              <button
                className={styles.aiRunBtn}
                onClick={askAi}
                disabled={aiLoading || !aiQuestion.trim() || chStatus !== 'online'}
              >
                <Zap size={13} />
                {aiLoading ? 'Thinking…' : 'Ask'}
              </button>
            </div>

            {aiLoading && (
              <div className={styles.aiThinking}>
                <div className={styles.spinner} />
                <span>Gemini is writing SQL + querying ClickHouse…</span>
              </div>
            )}

            {aiResult && (
              <div className={styles.aiResults}>
                {/* Generated SQL */}
                {aiResult.sql && (
                  <div className={styles.aiSqlBlock}>
                    <div className={styles.aiSqlLabel}>Generated SQL</div>
                    <pre className={styles.aiSql}>{aiResult.sql}</pre>
                    <button
                      className={styles.useSqlBtn}
                      onClick={() => { setSql(aiResult.sql); setActiveTab('sql'); }}
                    >
                      Open in Console →
                    </button>
                  </div>
                )}

                {/* AI interpretation */}
                <div className={styles.aiInterpretation}>
                  <div className={styles.aiInterpLabel}>
                    <Sparkles size={12} color="var(--gold)" /> AI Insight
                  </div>
                  <p>{aiResult.interpretation}</p>
                </div>

                {/* Raw data table */}
                {aiResult.data.length > 0 && (
                  <table className={styles.resTable} style={{ marginTop: 12 }}>
                    <thead>
                      <tr>{aiResult.meta.map(c => <th key={c.name}>{c.name}</th>)}</tr>
                    </thead>
                    <tbody>
                      {aiResult.data.slice(0, 20).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => <td key={ci}>{String(cell)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
