import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Download } from 'lucide-react';
import { budgetItems as initialBudgetItems } from '../../data/sampleData';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import styles from './BudgetView.module.css';

export function BudgetView() {
  const { activeProject } = useStudioStore();
  const [items, setItems] = useState(initialBudgetItems);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    apiFetch('/api/clickhouse/budget')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && Array.isArray(data.budget) && data.budget.length > 0) {
          setItems(data.budget);
        }
      })
      .catch((err) => console.warn('Failed to fetch ClickHouse budget items:', err));
  }, []);

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
    let csv = 'Account,Category,Description,Estimated,Cap,Variance,Status\n';
    items.forEach((it) => {
      if (!it.isCategory) {
        const varVal = it.estimated - it.cap;
        csv += `"${it.acct}","${it.category}","${it.desc}",${it.estimated},${it.cap},${varVal},"${it.status}"\n`;
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

  const subtotal = items.reduce((acc, it) => acc + (it.isCategory ? 0 : it.estimated), 0);
  const contingency = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + contingency;
  const totalCap = activeProject.budgetCap || 5000;
  const overage = grandTotal - totalCap;

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <DollarSign size={16} color="var(--gold)" />
        <span className={styles.title}>Budget TopSheet — {activeProject.name}</span>

        <button className={styles.hdrBtn} onClick={() => setShowAddForm(true)}>
          <Plus size={13} /> Add Line Item
        </button>

        <button className={styles.hdrBtn} onClick={exportCSV}>
          <Download size={13} /> Export .CSV
        </button>

        <div className={styles.totals}>
          <div>
            <div className={styles.totLabel}>Subtotal</div>
            <div className={styles.totVal}>${subtotal.toLocaleString()}</div>
          </div>
          <div>
            <div className={styles.totLabel}>10% Contingency</div>
            <div className={styles.totVal} style={{ color: 'var(--cyan)' }}>+${contingency.toLocaleString()}</div>
          </div>
          <div>
            <div className={styles.totLabel}>Grand Total</div>
            <div className={styles.totVal} style={{ color: grandTotal > totalCap ? 'var(--red)' : 'var(--grn)' }}>
              ${grandTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <div className={styles.totLabel}>Target Cap</div>
            <div className={styles.totVal}>${totalCap.toLocaleString()}</div>
          </div>
          <div>
            <div className={styles.totLabel}>Variance</div>
            <div className={styles.totVal} style={{ color: overage > 0 ? 'var(--red)' : 'var(--grn)' }}>
              {overage > 0 ? `+$${overage.toLocaleString()}` : `$${overage.toLocaleString()}`}
            </div>
          </div>
        </div>
      </div>

      {/* ADD ITEM MODAL / FORM */}
      {showAddForm && (
        <div className={styles.addFormRow}>
          <input
            type="text"
            placeholder="Acct #"
            className={styles.addInput}
            style={{ width: '80px' }}
            value={newAcct}
            onChange={(e) => setNewAcct(e.target.value)}
          />
          <select className={styles.addSelect} value={newCat} onChange={(e) => setNewCat(e.target.value)}>
            <option value="Above the Line">Above the Line</option>
            <option value="Cast & Talent">Cast &amp; Talent</option>
            <option value="Locations">Locations</option>
            <option value="Production">Production &amp; Crew</option>
            <option value="Post-Production">Post-Production</option>
          </select>
          <input
            type="text"
            placeholder="Line Item Description (e.g. Armorer / Prop Weapons)"
            className={styles.addInput}
            style={{ flex: 1 }}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <input
            type="number"
            placeholder="Estimated $"
            className={styles.addInput}
            style={{ width: '110px' }}
            value={newEst}
            onChange={(e) => setNewEst(parseFloat(e.target.value) || 0)}
          />
          <input
            type="number"
            placeholder="Target Cap $"
            className={styles.addInput}
            style={{ width: '110px' }}
            value={newCap}
            onChange={(e) => setNewCap(parseFloat(e.target.value) || 0)}
          />
          <button className={styles.submitAddBtn} onClick={addItem}>Add Row</button>
          <button className={styles.cancelAddBtn} onClick={() => setShowAddForm(false)}>Cancel</button>
        </div>
      )}

      <div className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Acct</th>
              <th>Category</th>
              <th>Description</th>
              <th>Estimated</th>
              <th>Cap</th>
              <th>Variance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              if (it.isCategory) {
                return (
                  <tr key={it.id} className={styles.catRow}>
                    <td>{it.acct}</td>
                    <td colSpan={6}>{it.category}</td>
                    <td />
                  </tr>
                );
              }

              const variance = it.estimated - it.cap;
              const varText = variance > 0 ? `+$${variance}` : `$${variance}`;

              return (
                <tr key={it.id}>
                  <td style={{ color: 'var(--t3)' }}>{it.acct}</td>
                  <td>{it.category}</td>
                  <td>{it.desc}</td>
                  <td>
                    $<input
                      type="number"
                      className={styles.numInput}
                      value={it.estimated}
                      onChange={(e) => updateCost(it.id, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td>${it.cap}</td>
                  <td className={variance > 0 ? styles.over : styles.under}>{varText}</td>
                  <td>
                    {it.status === 'over' && <span className={`${styles.pill} ${styles.pillOver}`}>⚠ Over</span>}
                    {it.status === 'ok' && <span className={`${styles.pill} ${styles.pillOk}`}>✓</span>}
                    {it.status === 'pending' && <span className={`${styles.pill} ${styles.pillPlan}`}>Pending</span>}
                  </td>
                  <td>
                    <button className={styles.delRowBtn} title="Delete Row" onClick={() => deleteItem(it.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* CONTINGENCY ROW */}
            <tr className={styles.contingencyRow}>
              <td>9900</td>
              <td>Contingency</td>
              <td>10% Production Reserve (Auto-Calculated)</td>
              <td>${contingency.toLocaleString()}</td>
              <td>$500</td>
              <td className={styles.over}>+${contingency - 500}</td>
              <td><span className={`${styles.pill} ${styles.pillPlan}`}>Auto 10%</span></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
