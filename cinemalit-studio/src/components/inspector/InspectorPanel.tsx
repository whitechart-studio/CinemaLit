// src/components/inspector/InspectorPanel.tsx
import { useState, useRef, useCallback } from 'react';
import {
  X, MousePointer2, ShieldCheck, FileText, ChevronDown, ChevronRight,
  Folder, LayoutDashboard, Layers, CalendarDays, Camera, DollarSign,
  ClipboardList, Database, Download, GripVertical, Plus, Trash2, Tag,
  CheckCircle2, Users, ChevronUp,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { InspectorTab, ViewId } from '../../types';
import styles from './InspectorPanel.module.css';

interface Gate {
  id: string;
  name: string;
  desc: string;
  status: 'pending' | 'approved';
}

interface TreeFile {
  name: string;
  viewId?: ViewId;
  icon: React.ReactNode;
  isExport?: boolean;
}

interface TreeFolder {
  name: string;
  open: boolean;
  files: TreeFile[];
}

interface ElementDetail {
  id: string;
  name: string;
  category: 'cast' | 'props' | 'ward' | 'vfx' | 'sfx';
  cost: number;
  planStatus: 'SAG-AFTRA DAY RATE' | 'RENTAL' | 'PURCHASED' | 'SAFETY / ARMORER' | 'POST-VFX PASS' | 'ON-SET PRACTICAL';
  status: 'PLANNED' | 'CONFIRMED' | 'BOOKED';
  notes: string;
}

export function InspectorPanel() {
  const {
    inspectorOpen, closeInspector, inspectorTab, setInspectorTab,
    selectedSceneId, scenes, activeView, setActiveView,
  } = useStudioStore();

  const [panelWidth, setPanelWidth] = useState(320);
  const isResizing = useRef(false);
  const [expandedElemId, setExpandedElemId] = useState<string | null>('el-c1');

  const [gates, setGates] = useState<Gate[]>([
    { id: 'gate-budget', name: 'Budget Cap Gate', desc: 'Requires Director sign-off to lock $5,000 budget plan.', status: 'pending' },
    { id: 'gate-stunt', name: 'Stunt & Rain FX Gate', desc: 'Stunt coordinator & safety team sign-off for Sc. 2.', status: 'approved' },
    { id: 'gate-permit', name: 'Location Permit Gate', desc: 'Dock District permit issued & verified.', status: 'approved' },
  ]);

  // Detailed Element State including CAST, Props, Wardrobe, VFX, SFX
  const [elementDetails, setElementDetails] = useState<ElementDetail[]>([
    // CAST MEMBERS
    { id: 'el-c1', name: 'Maya (Lead Hacker)', category: 'cast', cost: 1082, planStatus: 'SAG-AFTRA DAY RATE', status: 'BOOKED', notes: 'SAG-AFTRA ULB Scale ($1,082/day) · Stunt double booked' },
    { id: 'el-c2', name: 'Kai (Enforcer)', category: 'cast', cost: 1082, planStatus: 'SAG-AFTRA DAY RATE', status: 'CONFIRMED', notes: 'SAG-AFTRA ULB Scale ($1,082/day) · Fight choreography pass' },
    { id: 'el-c3', name: 'Armorer / Stunt Extra', category: 'cast', cost: 450, planStatus: 'SAFETY / ARMORER', status: 'CONFIRMED', notes: 'Certified Armorer & Stunt Safety Lead' },

    // PROPS
    { id: 'el-1', name: 'Prop Gun (licensed)', category: 'props', cost: 450, planStatus: 'SAFETY / ARMORER', status: 'CONFIRMED', notes: 'Hollywood Armory · Armorer required on-set' },
    { id: 'el-2', name: 'Glowing Terminal', category: 'props', cost: 250, planStatus: 'ON-SET PRACTICAL', status: 'BOOKED', notes: 'CyberProps Inc · Battery pack included' },
    { id: 'el-3', name: 'Chrome Case', category: 'props', cost: 120, planStatus: 'RENTAL', status: 'PLANNED', notes: 'PropHouse LA rental' },

    // WARDROBE
    { id: 'el-4', name: 'Maya Hacker Rig', category: 'ward', cost: 380, planStatus: 'PURCHASED', status: 'BOOKED', notes: 'Custom LED stitching' },
    { id: 'el-5', name: 'Kai Tactical Coat', category: 'ward', cost: 290, planStatus: 'RENTAL', status: 'CONFIRMED', notes: 'Western Costume Co.' },

    // VFX
    { id: 'el-6', name: 'Cyan Neon Tubes', category: 'vfx', cost: 650, planStatus: 'ON-SET PRACTICAL', status: 'CONFIRMED', notes: 'Neon FX Specialists' },
    { id: 'el-7', name: 'Rain Window Projection', category: 'vfx', cost: 850, planStatus: 'POST-VFX PASS', status: 'PLANNED', notes: 'Nuke composite pass' },

    // SFX
    { id: 'el-8', name: 'City Hum BG Track', category: 'sfx', cost: 150, planStatus: 'PURCHASED', status: 'BOOKED', notes: 'Freesound Pro License' },
    { id: 'el-9', name: 'Rain Practical FX Bar', category: 'sfx', cost: 920, planStatus: 'SAFETY / ARMORER', status: 'PLANNED', notes: 'Rain machine setup + recycling tank' },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newElemName, setNewElemName] = useState('');
  const [newElemCat, setNewElemCat] = useState<'cast' | 'props' | 'ward' | 'vfx' | 'sfx'>('cast');
  const [newElemCost, setNewElemCost] = useState('1082');
  const [newElemPlan, setNewElemPlan] = useState<ElementDetail['planStatus']>('SAG-AFTRA DAY RATE');
  const [newElemNotes, setNewElemNotes] = useState('');

  const [folders, setFolders] = useState<TreeFolder[]>([
    {
      name: '01_boards',
      open: true,
      files: [
        { name: 'scene_flow.board', viewId: 'canvas', icon: <LayoutDashboard size={13} color="var(--gold)" /> },
      ],
    },
    {
      name: '02_script',
      open: true,
      files: [
        { name: 'script.fountain', viewId: 'script', icon: <FileText size={13} color="var(--cyan)" /> },
      ],
    },
    {
      name: '03_breakdown',
      open: true,
      files: [
        { name: 'breakdown.json', viewId: 'breakdown', icon: <Layers size={13} color="var(--pur)" /> },
        { name: 'stripboard.json', viewId: 'stripboard', icon: <CalendarDays size={13} color="var(--gold)" /> },
        { name: 'shot_list.csv', viewId: 'shotlist', icon: <Camera size={13} color="var(--cyan)" /> },
      ],
    },
    {
      name: '04_finance',
      open: true,
      files: [
        { name: 'budget_topsheet.xlsx', viewId: 'budget', icon: <DollarSign size={13} color="var(--grn)" /> },
      ],
    },
    {
      name: '05_production',
      open: true,
      files: [
        { name: 'call_sheet_day1.pdf', viewId: 'callsheet', icon: <ClipboardList size={13} color="var(--gold)" /> },
        { name: 'greenlight_binder.html', icon: <Download size={13} color="var(--t2)" />, isExport: true },
      ],
    },
    {
      name: '06_database',
      open: false,
      files: [
        { name: 'clickhouse_memory.sql', viewId: 'sql', icon: <Database size={13} color="var(--cyan)" /> },
      ],
    },
  ]);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId);

  const approveGate = (id: string) => {
    setGates((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: 'approved' } : g))
    );
  };

  const toggleFolder = (idx: number) => {
    setFolders((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, open: !f.open } : f))
    );
  };

  const handleFileClick = (file: TreeFile) => {
    if (file.isExport) {
      window.open('../greenlight_package.html', '_blank');
    } else if (file.viewId) {
      setActiveView(file.viewId);
    }
  };

  // Horizontal Resize Handler for Right Inspector Panel
  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();

    const onMouseMove = (me: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(260, Math.min(600, window.innerWidth - me.clientX));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Element Actions
  const handleCostChange = (id: string, newCostStr: string) => {
    const cost = parseFloat(newCostStr) || 0;
    setElementDetails((prev) => prev.map((el) => (el.id === id ? { ...el, cost } : el)));
  };

  const cycleStatus = (id: string) => {
    setElementDetails((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        const nextStatus =
          el.status === 'PLANNED' ? 'CONFIRMED' : el.status === 'CONFIRMED' ? 'BOOKED' : 'PLANNED';
        return { ...el, status: nextStatus };
      })
    );
  };

  const deleteElement = (id: string) => {
    setElementDetails((prev) => prev.filter((el) => el.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedElemId((prev) => (prev === id ? null : id));
  };

  const addElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElemName.trim()) return;
    const newElem: ElementDetail = {
      id: `el-${Date.now()}`,
      name: newElemName.trim(),
      category: newElemCat,
      cost: parseFloat(newElemCost) || 0,
      planStatus: newElemPlan,
      status: 'PLANNED',
      notes: newElemNotes.trim() || 'Custom added element',
    };
    setElementDetails((prev) => [...prev, newElem]);
    setNewElemName('');
    setNewElemNotes('');
    setShowAddForm(false);
    setExpandedElemId(newElem.id);
  };

  const totalElemCost = elementDetails.reduce((sum, el) => sum + el.cost, 0);

  return (
    <aside
      className={`${styles.panel} ${inspectorOpen ? styles.open : ''}`}
      style={{ width: `${panelWidth}px` }}
    >
      {/* DRAG RESIZE HANDLE ON LEFT EDGE */}
      <div
        className={styles.resizer}
        onMouseDown={startResizing}
        onDoubleClick={() => setPanelWidth(320)}
        title="Drag horizontally to adjust Project Explorer & Inspector width (Double-click to reset)"
      >
        <GripVertical size={11} className={styles.resizerIcon} />
      </div>

      <div className={styles.header}>
        <span className={styles.title}>
          {inspectorTab === 'files'
            ? 'Project Explorer'
            : inspectorTab === 'plan'
            ? 'Action Plan'
            : inspectorTab === 'elems'
            ? 'Element Breakdown Matrix'
            : selectedScene
            ? `SC.${selectedScene.num} Inspector`
            : 'Scene Inspector'}
        </span>
        <button className={styles.closeBtn} onClick={closeInspector}>
          <X size={14} />
        </button>
      </div>

      <div className={styles.tabs}>
        {(['files', 'info', 'elems', 'shots', 'ai', 'plan'] as InspectorTab[]).map((tab) => (
          <div
            key={tab}
            className={`${styles.tab} ${inspectorTab === tab ? styles.activeTab : ''}`}
            onClick={() => setInspectorTab(tab)}
          >
            {tab.toUpperCase()}
          </div>
        ))}
      </div>

      <div className={styles.body}>
        {/* FILES TAB: FULL PROJECT EXPLORER FOLDER TREE */}
        {inspectorTab === 'files' && (
          <div className={styles.group}>
            <div className={styles.groupTitle}>Project File Directory</div>
            <div className={styles.treeArea}>
              {folders.map((folder, fIdx) => (
                <div key={folder.name} className={styles.folderGroup}>
                  <div className={styles.folderHdr} onClick={() => toggleFolder(fIdx)}>
                    {folder.open ? <ChevronDown size={13} className={styles.chevron} /> : <ChevronRight size={13} className={styles.chevron} />}
                    <Folder size={13} className={styles.folderIcon} />
                    <span>{folder.name}</span>
                  </div>

                  {folder.open && (
                    <div className={styles.fileList}>
                      {folder.files.map((file) => {
                        const isActive = file.viewId && activeView === file.viewId;
                        return (
                          <div
                            key={file.name}
                            className={`${styles.fileItem} ${isActive ? styles.activeFile : ''}`}
                            onClick={() => handleFileClick(file)}
                          >
                            <span className={styles.fileIcon}>{file.icon}</span>
                            <span className={styles.fileName}>{file.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ELEMS TAB: COMPACT CARDS CLICKABLE FOR DETAILED BUDGET & PLAN */}
        {inspectorTab === 'elems' && (
          <div className={styles.elemSection}>
            {/* TOTAL BUDGET SUMMARY CARD */}
            <div className={styles.elemSummaryCard}>
              <div className={styles.summaryHdr}>
                <div>
                  <span className={styles.summaryLbl}>Total Element & Cast Budget</span>
                  <div className={styles.summaryVal}>${totalElemCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
                <button
                  className={styles.addElemBtn}
                  onClick={() => setShowAddForm((v) => !v)}
                  title="Add Breakdown Element"
                >
                  <Plus size={13} /> Add Element
                </button>
              </div>

              {/* CATEGORY SPEND DISTRIBUTION BAR */}
              <div className={styles.catDistributionBar}>
                {['cast', 'props', 'ward', 'vfx', 'sfx'].map((cat) => {
                  const catSpend = elementDetails.filter((e) => e.category === cat).reduce((s, e) => s + e.cost, 0);
                  const pct = totalElemCost > 0 ? (catSpend / totalElemCost) * 100 : 0;
                  return (
                    <div
                      key={cat}
                      className={`${styles.catSeg} ${styles[`seg_${cat}`]}`}
                      style={{ width: `${pct}%` }}
                      title={`${cat.toUpperCase()}: $${catSpend} (${pct.toFixed(0)}%)`}
                    />
                  );
                })}
              </div>
            </div>

            {/* ADD ELEMENT INLINE FORM */}
            {showAddForm && (
              <form className={styles.addForm} onSubmit={addElement}>
                <div className={styles.formRow}>
                  <input
                    className={styles.formInput}
                    placeholder="Name (e.g. Kai or Prop Gun)"
                    value={newElemName}
                    onChange={(e) => setNewElemName(e.target.value)}
                    autoFocus
                  />
                  <select
                    className={styles.formSelect}
                    value={newElemCat}
                    onChange={(e) => setNewElemCat(e.target.value as any)}
                  >
                    <option value="cast">Cast / Actor</option>
                    <option value="props">Props</option>
                    <option value="ward">Wardrobe</option>
                    <option value="vfx">VFX</option>
                    <option value="sfx">SFX</option>
                  </select>
                </div>

                <div className={styles.formRow}>
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="Est. Cost ($)"
                    value={newElemCost}
                    onChange={(e) => setNewElemCost(e.target.value)}
                  />
                  <select
                    className={styles.formSelect}
                    value={newElemPlan}
                    onChange={(e) => setNewElemPlan(e.target.value as any)}
                  >
                    <option value="SAG-AFTRA DAY RATE">SAG-AFTRA Day Rate</option>
                    <option value="RENTAL">Rental</option>
                    <option value="PURCHASED">Purchased</option>
                    <option value="SAFETY / ARMORER">Safety / Armorer</option>
                    <option value="POST-VFX PASS">Post VFX Pass</option>
                    <option value="ON-SET PRACTICAL">On-Set Practical</option>
                  </select>
                </div>

                <input
                  className={styles.formInput}
                  placeholder="Notes (e.g. SAG ULB Scale $1,082/day)"
                  value={newElemNotes}
                  onChange={(e) => setNewElemNotes(e.target.value)}
                />

                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setShowAddForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.saveBtn}>
                    Save Element
                  </button>
                </div>
              </form>
            )}

            {/* CATEGORY GROUPS: CAST, PROPS, WARDROBE, VFX, SFX */}
            {(
              [
                { id: 'cast', label: 'CAST & ACTORS', color: 'var(--gold)', icon: <Users size={12} /> },
                { id: 'props', label: 'PROPS & WEAPONRY', color: 'var(--cyan)', icon: <Tag size={12} /> },
                { id: 'ward', label: 'WARDROBE & COSTUMES', color: 'var(--pur)', icon: <Tag size={12} /> },
                { id: 'vfx', label: 'VISUAL EFFECTS (VFX)', color: 'var(--grn)', icon: <Tag size={12} /> },
                { id: 'sfx', label: 'SPECIAL & SOUND FX (SFX)', color: 'var(--red)', icon: <Tag size={12} /> },
              ] as const
            ).map((catGroup) => {
              const catItems = elementDetails.filter((el) => el.category === catGroup.id);
              if (catItems.length === 0) return null;

              return (
                <div key={catGroup.id} className={styles.catGroupBlock}>
                  <div className={styles.catGroupHeader}>
                    <span className={styles.catDot} style={{ background: catGroup.color }} />
                    <span className={styles.catTitle}>{catGroup.label}</span>
                    <span className={styles.catBadge}>{catItems.length} ITEMS</span>
                  </div>

                  <div className={styles.elemCardList}>
                    {catItems.map((el) => {
                      const isExpanded = expandedElemId === el.id;

                      return (
                        <div
                          key={el.id}
                          className={`${styles.elemCard} ${isExpanded ? styles.elemCardExpanded : ''}`}
                        >
                          {/* CLICKABLE COMPACT HEADER ROW */}
                          <div
                            className={styles.elemCardHeaderRow}
                            onClick={() => toggleExpand(el.id)}
                            title="Click to view budget & procurement details"
                          >
                            <span className={styles.elemIcon} style={{ color: catGroup.color }}>
                              {catGroup.icon}
                            </span>
                            <strong className={styles.elemName}>{el.name}</strong>

                            <span className={styles.compactCostBadge}>
                              ${el.cost.toLocaleString('en-US')}
                            </span>

                            <span
                              className={`${styles.statusToggleBtn} ${
                                el.status === 'BOOKED'
                                  ? styles.stOk
                                  : el.status === 'CONFIRMED'
                                  ? styles.stWarn
                                  : styles.stPlan
                              }`}
                            >
                              {el.status === 'BOOKED' && <CheckCircle2 size={10} />}
                              {el.status}
                            </span>

                            <span className={styles.expandChevron}>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </span>
                          </div>

                          {/* EXPANDABLE BUDGET & PROCUREMENT PLAN DETAILS */}
                          {isExpanded && (
                            <div className={styles.elemExpandedBody}>
                              <div className={styles.elemDetailRow}>
                                <span className={styles.detailLbl}>Budget Amount:</span>
                                <div className={styles.elemCostBox}>
                                  <span className={styles.dollarSign}>$</span>
                                  <input
                                    type="number"
                                    className={styles.elemCostInput}
                                    value={el.cost}
                                    onChange={(e) => handleCostChange(el.id, e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className={styles.elemDetailRow}>
                                <span className={styles.detailLbl}>Plan Status:</span>
                                <span
                                  className={`${styles.planBadge} ${
                                    el.planStatus === 'SAFETY / ARMORER'
                                      ? styles.pbRed
                                      : el.planStatus === 'SAG-AFTRA DAY RATE' || el.planStatus === 'RENTAL'
                                      ? styles.pbGold
                                      : el.planStatus === 'POST-VFX PASS'
                                      ? styles.pbCyan
                                      : styles.pbGrn
                                  }`}
                                >
                                  {el.planStatus}
                                </span>
                              </div>

                              <div className={styles.elemDetailRow}>
                                <span className={styles.detailLbl}>Booking Status:</span>
                                <button
                                  className={`${styles.statusToggleBtn} ${
                                    el.status === 'BOOKED'
                                      ? styles.stOk
                                      : el.status === 'CONFIRMED'
                                      ? styles.stWarn
                                      : styles.stPlan
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cycleStatus(el.id);
                                  }}
                                >
                                  {el.status === 'BOOKED' && <CheckCircle2 size={10} />}
                                  {el.status} (Cycle)
                                </button>
                              </div>

                              {el.notes && (
                                <div className={styles.elemNotes}>
                                  <span>Notes & Supplier:</span> {el.notes}
                                </div>
                              )}

                              <div className={styles.elemCardFooter}>
                                <button
                                  className={styles.deleteElemBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteElement(el.id);
                                  }}
                                >
                                  <Trash2 size={12} /> Remove Element
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PLAN TAB */}
        {inspectorTab === 'plan' && (
          <div className={styles.group}>
            <div className={styles.groupTitle}>Action Plan Governance</div>
            <div className={styles.gateList}>
              {gates.map((g) => (
                <div
                  key={g.id}
                  className={`${styles.gateCard} ${g.status === 'approved' ? styles.gateApproved : styles.gatePending}`}
                >
                  <div className={styles.gateHdr}>
                    <strong>{g.name}</strong>
                    <span className={g.status === 'approved' ? styles.badgeOk : styles.badgeWarn}>
                      {g.status === 'approved' ? '✓ APPROVED' : 'PENDING'}
                    </span>
                  </div>
                  <p className={styles.gateDesc}>{g.desc}</p>
                  {g.status === 'pending' && (
                    <button className={styles.approveBtn} onClick={() => approveGate(g.id)}>
                      <ShieldCheck size={13} /> APPROVE GATE
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCENE TABS */}
        {inspectorTab !== 'files' && inspectorTab !== 'plan' && inspectorTab !== 'elems' && (!selectedScene ? (
          <div className={styles.empty}>
            <MousePointer2 size={22} style={{ display: 'block', margin: '0 auto 9px' }} />
            Click a scene node to inspect
          </div>
        ) : (
          <>
            {inspectorTab === 'info' && selectedScene && (
              <>
                <div className={styles.group}>
                  <div className={styles.groupTitle}>Scene Info</div>
                  <div className={styles.field}><span className={styles.lbl}>Scene #</span><span className={styles.val}>SC.{selectedScene.num}</span></div>
                  <div className={styles.field}><span className={styles.lbl}>Slugline</span><span className={styles.valMono}>{selectedScene.slug}</span></div>
                  <div className={styles.field}><span className={styles.lbl}>Type</span><span className={styles.val}>{selectedScene.type} · {selectedScene.timing}</span></div>
                  <div className={styles.field}><span className={styles.lbl}>Location</span><span className={styles.val}>{selectedScene.loc}</span></div>
                  <div className={styles.field}><span className={styles.lbl}>Pages</span><span className={styles.val}>{selectedScene.pages}</span></div>
                  <div className={styles.field}><span className={styles.lbl}>Shoot Day</span><span className={styles.val}>Day {selectedScene.day}</span></div>
                </div>

                <div className={styles.group}>
                  <div className={styles.groupTitle}>Cast</div>
                  <div className={styles.tagList}>
                    {selectedScene.cast.map((c) => (
                      <span key={c} className={`${styles.tag} ${styles.etCast}`}>{c}</span>
                    ))}
                  </div>
                </div>

                <div className={styles.group}>
                  <div className={styles.groupTitle}>Risk</div>
                  <div className={styles.field}>
                    <span className={styles.lbl}>Level</span>
                    <span className={styles.val}>
                      <span className={`${styles.riskPill} ${selectedScene.risk === 'high' ? styles.rHi : selectedScene.risk === 'med' ? styles.rMd : styles.rLo}`}>
                        {selectedScene.risk.toUpperCase()}
                      </span>
                    </span>
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: '3px' }}>
                    {selectedScene.riskNote}
                  </div>
                </div>
              </>
            )}

            {inspectorTab === 'shots' && selectedScene && (
              <div className={styles.group}>
                <div className={styles.groupTitle}>Shots — SC.{selectedScene.num}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: '9px' }}>
                  {selectedScene.shots} shots planned
                </div>
                {Array.from({ length: selectedScene.shots }, (_, j) => (
                  <div key={j} className={styles.shotRow}>
                    <span style={{ fontSize: '.72rem', fontWeight: 800, color: 'var(--t1)' }}>
                      {selectedScene.num}{String.fromCharCode(65 + j)}
                    </span>
                    <span className={`${styles.statusPill} ${j < 2 ? styles.ssOk : styles.ssPlan}`}>
                      {j < 2 ? '✓ Approved' : 'Planned'}
                    </span>
                  </div>
                ))}
                <button className={styles.openShotBtn} onClick={() => setActiveView('shotlist')}>
                  Open Full Shot List →
                </button>
              </div>
            )}

            {inspectorTab === 'ai' && selectedScene && (
              <div className={styles.aiBox}>
                <div className={styles.aiTitle}>⚡ Director Engine Analysis</div>
                <div className={styles.aiTxt}>
                  {selectedScene.risk === 'high'
                    ? `Scene ${selectedScene.num} has HIGH risk. Suggest: (1) Consolidate rain locations — save ~$800. (2) Block armorer for both prop-weapon days together.`
                    : `Scene ${selectedScene.num} is LOW risk and budget-compliant.`}
                </div>
              </div>
            )}
          </>
        ))}
      </div>
    </aside>
  );
}
