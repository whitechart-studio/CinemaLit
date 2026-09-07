import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Download } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import type { BudgetItem } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import styles from './BudgetView.module.css';

const CONTINGENCY_RATE = 0.1; // 10% production reserve — real business rule, see BudgetView plan notes

export function BudgetView() {
  const { activeProject } = useStudioStore();
  // Starts empty rather than seeded with sample line items — a project with
  // no ClickHouse budget rows yet should read as "no budget entered", not
  // flash fabricated numbers before the real fetch below replaces them.
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [allScenes, setAllScenes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sceneFilter, setSceneFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/clickhouse/budget?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && Array.isArray(data.budget)) {
          setItems(data.budget);
        }
        if (data.status === 'ok' && Array.isArray(data.scenes)) {
          setAllScenes(data.scenes);
        }
      })
      .catch((err) => console.warn('Failed to fetch ClickHouse budget items:', err))
      .finally(() => setLoading(false));
    setSceneFilter('all');
  }, [activeProject.id]);

  // New line item state
  const [newAcct, setNewAcct] = useState('1400');
  const [newCat, setNewCat] = useState('Production');
  const [newDesc, setNewDesc] = useState('');
  const [newEst, setNewEst] = useState(500);
  const [newCap, setNewCap] = useState(500);

  const updateCost = (id: string, newCost: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const diff = newCost - it.cap;
        const status = diff > 0 ? 'over' : 'ok';
        return { ...it, estimated: newCost, status };
      })
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    if (!newDesc.trim()) return;
    const newItem = {
      id: `b${Date.now()}`,
      acct: newAcct,
      category: newCat,
      desc: newDesc,
      estimated: newEst,
      cap: newCap,
      status: newEst > newCap ? ('over' as const) : ('ok' as const),
    };
    setItems((prev) => [...prev, newItem]);
    setNewDesc('');
    setShowAddForm(false);
  };

  const exportCSV = () => {
    let csv = 'Account,Category,Description,Scene,Estimated,Cap,Variance,Status\n';
    filteredItems.forEach((it) => {
      if (!it.isCategory) {
        const varVal = it.estimated - it.cap;
        csv += `"${it.acct}","${it.category}","${it.desc}","${it.sceneNumber || ''}",${it.estimated},${it.cap},${varVal},"${it.status}"\n`;
      }
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.name.toLowerCase().replace(/\s+/g, '_')}_budget.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sceneNumbers = Array.from(
    new Set([...allScenes, ...items.filter((it) => it.sceneNumber).map((it) => it.sceneNumber as string)])
  ).sort();
  const hasUnscoped = items.some((it) => !it.isCategory && !it.sceneNumber);

  const filteredItems = items.filter((it) => {
    if (sceneFilter === 'all') return true;
    if (sceneFilter === 'unscoped') return !it.sceneNumber;
    return it.sceneNumber === sceneFilter;
  });

  const subtotal = filteredItems.reduce((acc, it) => acc + (it.isCategory ? 0 : it.estimated), 0);
  const contingency = Math.round(subtotal * CONTINGENCY_RATE);
  const grandTotal = subtotal + contingency;
  const totalCap = activeProject.budgetCap || 5000;
  const overage = grandTotal - totalCap;

  // Scene-scoped summary — the project's overall Target Cap doesn't mean
  // anything against one scene, so a picked scene compares against the sum
  // of that scene's own line-item caps instead.
  const sceneCap = filteredItems.reduce((acc, it) => acc + (it.isCategory ? 0 : it.cap), 0);
  const sceneVariance = subtotal - sceneCap;
  const sceneOver = sceneVariance > 0;

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <DollarSign size={16} color="var(--accent)" className={styles.titleIcon} />
          <span className={styles.title}>
            Budget TopSheet — {activeProject.name}
            {sceneFilter !== 'all' && (
              <span style={{ color: 'var(--t3)', fontWeight: 400 }}>
                {' '}— {sceneFilter === 'unscoped' ? 'Not Scene-Specific' : `Scene ${sceneFilter}`}
              </span>
            )}
          </span>

          <div className={styles.headerActions}>
            <Select value={sceneFilter} onValueChange={setSceneFilter}>
              <SelectTrigger size="sm" className="w-[170px]"><SelectValue placeholder="All Scenes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scenes</SelectItem>
                {sceneNumbers.map((sn) => (
                  <SelectItem key={sn} value={sn}>Scene {sn}</SelectItem>
                ))}
                {hasUnscoped && <SelectItem value="unscoped">Not Scene-Specific</SelectItem>}
              </SelectContent>
            </Select>
            <button className={styles.hdrBtn} onClick={() => setShowAddForm(true)}>
              <Plus size={13} /> Add Line Item
            </button>
            <button className={styles.hdrBtn} onClick={exportCSV}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        <div className={styles.totals}>
          <div className={styles.totItem}>
            <div className={styles.totLabel}>{sceneFilter === 'all' ? 'Subtotal' : 'Scene Subtotal'}</div>
            <div className={styles.totVal}>${subtotal.toLocaleString()}</div>
          </div>
          <div className={styles.totItem}>
            <div className={styles.totLabel}>{CONTINGENCY_RATE * 100}% Contingency</div>
            <div className={styles.totVal} style={{ color: 'var(--cyan)' }}>+${contingency.toLocaleString()}</div>
          </div>
          <div className={styles.totItem}>
            <div className={styles.totLabel}>{sceneFilter === 'all' ? 'Grand Total' : 'Scene Total'}</div>
            <div className={sceneFilter === 'all' ? `${styles.totVal} ${grandTotal > totalCap ? styles.over : styles.under}` : styles.totVal}>
              ${grandTotal.toLocaleString()}
            </div>
          </div>
          {sceneFilter === 'all' ? (
            <>
              <div className={styles.totItem}>
                <div className={styles.totLabel}>Target Cap</div>
                <div className={styles.totVal}>${totalCap.toLocaleString()}</div>
              </div>
              <div className={styles.totItem}>
                <div className={styles.totLabel}>Variance</div>
                <div className={`${styles.totVal} ${overage > 0 ? styles.over : styles.under}`}>
                  {overage > 0 ? `+$${overage.toLocaleString()}` : `$${overage.toLocaleString()}`}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.totItem}>
                <div className={styles.totLabel}>Scene Cap</div>
                <div className={styles.totVal}>${sceneCap.toLocaleString()}</div>
              </div>
              <div className={styles.totItem}>
                <div className={styles.totLabel}>Scene Variance</div>
                <div className={`${styles.totVal} ${sceneOver ? styles.over : styles.under}`}>
                  {sceneOver ? `+$${sceneVariance.toLocaleString()}` : `$${sceneVariance.toLocaleString()}`}
                </div>
              </div>
              <div className={styles.totItem}>
                <div className={styles.totLabel}>Scene Status</div>
                <div className={styles.totVal}>
                  {filteredItems.length === 0 ? (
                    <Badge variant="outline" className={`${styles.pill} ${styles.pillPlan}`}>No Items</Badge>
                  ) : sceneOver ? (
                    <Badge variant="outline" className={`${styles.pill} ${styles.pillOver}`}>⚠ Over</Badge>
                  ) : (
                    <Badge variant="outline" className={`${styles.pill} ${styles.pillOk}`}>✓ On Track</Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ADD ITEM FORM */}
      {showAddForm && (
        <div className={styles.addFormRow}>
          <Input
            type="text"
            placeholder="Acct #"
            className="w-20"
            value={newAcct}
            onChange={(e) => setNewAcct(e.target.value)}
          />
          <Select value={newCat} onValueChange={setNewCat}>
            <SelectTrigger size="sm" className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Above the Line">Above the Line</SelectItem>
              <SelectItem value="Cast & Talent">Cast &amp; Talent</SelectItem>
              <SelectItem value="Locations">Locations</SelectItem>
              <SelectItem value="Production">Production &amp; Crew</SelectItem>
              <SelectItem value="Post-Production">Post-Production</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Line Item Description (e.g. Armorer / Prop Weapons)"
            className="flex-1 min-w-[200px]"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Estimated $"
            className="w-[110px]"
            value={newEst}
            onChange={(e) => setNewEst(parseFloat(e.target.value) || 0)}
          />
          <Input
            type="number"
            placeholder="Target Cap $"
            className="w-[110px]"
            value={newCap}
            onChange={(e) => setNewCap(parseFloat(e.target.value) || 0)}
          />
          <Button size="sm" onClick={addItem}>Add Row</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
        </div>
      )}

      <div className={styles.body}>
        <Table className={styles.table}>
          <TableHeader>
            <TableRow>
              <TableHead>Acct</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Scene</TableHead>
              <TableHead>Estimated</TableHead>
              <TableHead>Cap</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0 && (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className={styles.emptyState}>
                  No budget line items yet — add one above or wait for the Director Agent's cost breakdown.
                </TableCell>
              </TableRow>
            )}
            {!loading && items.length > 0 && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className={styles.emptyState}>
                  No budget line items for this scene.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((it) => {
              if (it.isCategory) {
                return (
                  <TableRow key={it.id} className={styles.catRow}>
                    <TableCell>{it.acct}</TableCell>
                    <TableCell colSpan={7}>{it.category}</TableCell>
                    <TableCell />
                  </TableRow>
                );
              }

              const variance = it.estimated - it.cap;
              const varText = variance > 0 ? `+$${variance}` : `$${variance}`;

              return (
                <TableRow key={it.id}>
                  <TableCell style={{ color: 'var(--t3)' }}>{it.acct}</TableCell>
                  <TableCell>{it.category}</TableCell>
                  <TableCell>{it.desc}</TableCell>
                  <TableCell style={{ color: 'var(--t3)' }}>{it.sceneNumber || '—'}</TableCell>
                  <TableCell>
                    <div className={styles.estCell}>
                      <span className={styles.dollarSign}>$</span>
                      <Input
                        type="number"
                        className={`${styles.numInput} h-auto`}
                        value={it.estimated}
                        onChange={(e) => updateCost(it.id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>${it.cap}</TableCell>
                  <TableCell className={variance > 0 ? styles.over : styles.under}>{varText}</TableCell>
                  <TableCell>
                    {it.status === 'over' && <Badge variant="outline" className={`${styles.pill} ${styles.pillOver}`}>⚠ Over</Badge>}
                    {it.status === 'ok' && <Badge variant="outline" className={`${styles.pill} ${styles.pillOk}`}>✓</Badge>}
                    {it.status === 'pending' && <Badge variant="outline" className={`${styles.pill} ${styles.pillPlan}`}>Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    <button className={styles.delRowBtn} title="Delete Row" onClick={() => deleteItem(it.id)}>
                      <Trash2 size={12} />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* CONTINGENCY ROW — only meaningful once there's a real subtotal to reserve against */}
            {subtotal > 0 && (
              <TableRow className={styles.contingencyRow}>
                <TableCell>9900</TableCell>
                <TableCell>Contingency</TableCell>
                <TableCell>{CONTINGENCY_RATE * 100}% Production Reserve (Auto-Calculated)</TableCell>
                <TableCell>—</TableCell>
                <TableCell>${contingency.toLocaleString()}</TableCell>
                <TableCell>—</TableCell>
                <TableCell />
                <TableCell><Badge variant="outline" className={`${styles.pill} ${styles.pillPlan}`}>Auto {CONTINGENCY_RATE * 100}%</Badge></TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
