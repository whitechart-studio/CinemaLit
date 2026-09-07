// src/components/inspector/InspectorPanel.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  X, MousePointer2, ShieldCheck, FileText,
  Folder, LayoutDashboard, Layers, CalendarDays, Camera, DollarSign,
  ClipboardList, Download, GripVertical, Plus, Trash2,
  CheckCircle2, Users, Wrench, Shirt, Wand2, Volume2,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { useDrag } from '../../hooks/useDrag';
import { apiFetch } from '../../utils/api';
import type { InspectorTab, ViewId, Shot } from '../../types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import styles from './InspectorPanel.module.css';

interface Gate {
  id: string;
  name: string;
  desc: string;
  autoApproved: boolean;
}

/** Tiny localStorage read/write, scoped per-project so edits made in the
 *  Inspector (element costs, gate sign-offs) don't leak across projects. */
function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — edits just won't persist across reloads */
  }
}

interface TreeFile {
  name: string;
  viewId?: ViewId;
  icon: React.ReactNode;
  isExport?: boolean;
}

interface TreeFolder {
  name: string;
  files: TreeFile[];
}

type ElemCategory = 'cast' | 'props' | 'ward' | 'vfx' | 'sfx';
type PlanStatus = 'SAG-AFTRA DAY RATE' | 'RENTAL' | 'PURCHASED' | 'SAFETY / ARMORER' | 'POST-VFX PASS' | 'ON-SET PRACTICAL';

interface ElementDetail {
  id: string;
  name: string;
  category: ElemCategory;
  cost: number;
  planStatus: PlanStatus;
  status: 'PLANNED' | 'CONFIRMED' | 'BOOKED';
  notes: string;
  /** Derived from the scenes that actually use this element, vs. one the
   *  user typed in manually via "Add Element". */
  custom?: boolean;
}

const DEFAULT_PLAN_STATUS: Record<ElemCategory, PlanStatus> = {
  cast: 'SAG-AFTRA DAY RATE',
  props: 'RENTAL',
  ward: 'RENTAL',
  vfx: 'POST-VFX PASS',
  sfx: 'ON-SET PRACTICAL',
};

/** User edits layered on top of the scene-derived element list — the only
 *  part of the Elements matrix that isn't recomputed from scenes. */
interface ElemLocalState {
  overrides: Record<string, Partial<Pick<ElementDetail, 'cost' | 'status' | 'planStatus' | 'notes'>>>;
  dismissed: string[];
  custom: ElementDetail[];
}

// Project Explorer folder tree — static, nothing here mutates it.
const FOLDERS: TreeFolder[] = [
  {
    name: '01_storyboard',
    files: [
      { name: 'storyboards.board', viewId: 'storyboard', icon: <Camera size={13} color="var(--accent)" /> },
    ],
  },
  {
    name: '02_boards',
    files: [
      { name: 'scene_flow.board', viewId: 'canvas', icon: <LayoutDashboard size={13} color="var(--accent)" /> },
    ],
  },
  {
    name: '02_script',
    files: [
      { name: 'script.fountain', viewId: 'script', icon: <FileText size={13} color="var(--cyan)" /> },
    ],
  },
  {
    name: '03_breakdown',
    files: [
      { name: 'breakdown.json', viewId: 'breakdown', icon: <Layers size={13} color="var(--pur)" /> },
      { name: 'stripboard.json', viewId: 'stripboard', icon: <CalendarDays size={13} color="var(--accent)" /> },
      { name: 'shot_list.csv', viewId: 'shotlist', icon: <Camera size={13} color="var(--cyan)" /> },
    ],
  },
  {
    name: '04_finance',
    files: [
      { name: 'budget_topsheet.xlsx', viewId: 'budget', icon: <DollarSign size={13} color="var(--grn)" /> },
    ],
  },
  {
    name: '05_production',
    files: [
      { name: 'call_sheet_day1.pdf', viewId: 'callsheet', icon: <ClipboardList size={13} color="var(--accent)" /> },
      { name: 'greenlight_package.html', icon: <Download size={13} color="var(--t2)" />, isExport: true },
    ],
  },
];

const DEFAULT_OPEN_FOLDERS = ['01_storyboard', '02_boards', '02_script', '03_breakdown', '04_finance', '05_production'];

const CATEGORY_GROUPS = [
  { id: 'cast', label: 'CAST & ACTORS', color: 'var(--accent)', icon: <Users size={12} /> },
  { id: 'props', label: 'PROPS & WEAPONRY', color: 'var(--cyan)', icon: <Wrench size={12} /> },
  { id: 'ward', label: 'WARDROBE & COSTUMES', color: 'var(--pur)', icon: <Shirt size={12} /> },
  { id: 'vfx', label: 'VISUAL EFFECTS (VFX)', color: 'var(--grn)', icon: <Wand2 size={12} /> },
  { id: 'sfx', label: 'SPECIAL & SOUND FX (SFX)', color: 'var(--red)', icon: <Volume2 size={12} /> },
] as const;

export function InspectorPanel() {
  const {
    inspectorOpen, closeInspector, inspectorTab, setInspectorTab,
    selectedSceneId, scenes, activeView, setActiveView, activeProject,
  } = useStudioStore();

  const [panelWidth, setPanelWidth] = useState(320);
  const [expandedElemId, setExpandedElemId] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<string[]>(DEFAULT_OPEN_FOLDERS);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId);

  // ACTION PLAN GATES — computed from the real project & scene state instead
  // of fixed example text. Only the "approved" flag is a human decision, so
  // that's the only part persisted (per project) across reloads.
  const gates = useMemo<Gate[]>(() => {
    const list: Gate[] = [
      {
        id: 'budget-cap',
        name: 'Budget Cap Gate',
        desc: `Estimated cost $${activeProject.estimatedCost.toLocaleString()} against a $${activeProject.budgetCap.toLocaleString()} cap.`,
        autoApproved: activeProject.estimatedCost <= activeProject.budgetCap,
      },
    ];
    const riskScenes = scenes.filter((s) => s.risk === 'high');
    if (riskScenes.length > 0) {
      list.push({
        id: 'risk-safety',
        name: 'High-Risk Scene Safety Gate',
        desc: `${riskScenes.length} scene(s) flagged high-risk: ${riskScenes.map((s) => `SC.${s.num}`).join(', ')}.`,
        autoApproved: false,
      });
    }
    const uniqueCast = new Set(scenes.flatMap((s) => s.cast));
    if (uniqueCast.size > 0) {
      list.push({
        id: 'cast-crew',
        name: 'Cast & Crew Confirmation Gate',
        desc: `${uniqueCast.size} cast member(s) across ${scenes.length} scene(s) require confirmed availability.`,
        autoApproved: false,
      });
    }
    return list;
  }, [activeProject.estimatedCost, activeProject.budgetCap, scenes]);

  const [approvedGates, setApprovedGates] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setApprovedGates(readLocal(`cinemalit:gates:${activeProject.id}`, {}));
  }, [activeProject.id]);

  const approveGate = (id: string) => {
    setApprovedGates((prev) => {
      const next = { ...prev, [id]: true };
      writeLocal(`cinemalit:gates:${activeProject.id}`, next);
      return next;
    });
  };

  // ELEMENT BREAKDOWN MATRIX — derived from what the scenes actually use
  // (cast/props/wardrobe/vfx/sfx), so it tracks the current project instead
  // of a fixed sample cast. Cost/status/notes are user-editable and
  // persisted per project; anything typed in via "Add Element" is kept
  // alongside the derived rows until removed.
  const derivedElements = useMemo<ElementDetail[]>(() => {
    const seen = new Map<string, ElementDetail>();
    const add = (name: string, category: ElemCategory) => {
      const id = `${category}:${name}`;
      if (!seen.has(id)) {
        seen.set(id, {
          id, name, category,
          cost: 0,
          planStatus: DEFAULT_PLAN_STATUS[category],
          status: 'PLANNED',
          notes: '',
        });
      }
    };
    scenes.forEach((sc) => {
      sc.cast.forEach((c) => add(c, 'cast'));
      sc.props.forEach((p) => add(p, 'props'));
      sc.ward.forEach((w) => add(w, 'ward'));
      sc.vfx.forEach((v) => add(v, 'vfx'));
      sc.sfx.forEach((s) => add(s, 'sfx'));
    });
    return Array.from(seen.values());
  }, [scenes]);

  const [elemLocal, setElemLocal] = useState<ElemLocalState>({ overrides: {}, dismissed: [], custom: [] });
  useEffect(() => {
    setElemLocal(readLocal(`cinemalit:elems:${activeProject.id}`, { overrides: {}, dismissed: [], custom: [] }));
  }, [activeProject.id]);

  const updateElemLocal = (updater: (prev: ElemLocalState) => ElemLocalState) => {
    setElemLocal((prev) => {
      const next = updater(prev);
      writeLocal(`cinemalit:elems:${activeProject.id}`, next);
      return next;
    });
  };

  const elementDetails: ElementDetail[] = [
    ...derivedElements.filter((el) => !elemLocal.dismissed.includes(el.id)),
    ...elemLocal.custom,
  ].map((el) => ({ ...el, ...elemLocal.overrides[el.id] }));

  const [showAddForm, setShowAddForm] = useState(false);
  const [newElemName, setNewElemName] = useState('');
  const [newElemCat, setNewElemCat] = useState<ElemCategory>('cast');
  const [newElemCost, setNewElemCost] = useState('0');
  const [newElemPlan, setNewElemPlan] = useState<PlanStatus>('RENTAL');
  const [newElemNotes, setNewElemNotes] = useState('');

  const handleFileClick = (file: TreeFile) => {
    if (file.isExport) {
      window.open('/greenlight_package.html', '_blank');
    } else if (file.viewId) {
      setActiveView(file.viewId);
    }
  };

  // Horizontal Resize Handler for Right Inspector Panel — shared drag hook
  // instead of a hand-rolled window mousemove/mouseup listener pair.
  const startResizing = useDrag({
    onMove: (dx) => setPanelWidth((w) => Math.max(260, Math.min(600, w - dx))),
  });

  // Element Actions
  const handleCostChange = (id: string, newCostStr: string) => {
    const cost = parseFloat(newCostStr) || 0;
    updateElemLocal((prev) => ({ ...prev, overrides: { ...prev.overrides, [id]: { ...prev.overrides[id], cost } } }));
  };

  const cycleStatus = (id: string) => {
    const current = elementDetails.find((el) => el.id === id);
    if (!current) return;
    const nextStatus =
      current.status === 'PLANNED' ? 'CONFIRMED' : current.status === 'CONFIRMED' ? 'BOOKED' : 'PLANNED';
    updateElemLocal((prev) => ({ ...prev, overrides: { ...prev.overrides, [id]: { ...prev.overrides[id], status: nextStatus } } }));
  };

  const deleteElement = (id: string) => {
    updateElemLocal((prev) => {
      const isCustom = prev.custom.some((el) => el.id === id);
      return {
        ...prev,
        custom: prev.custom.filter((el) => el.id !== id),
        dismissed: isCustom ? prev.dismissed : [...prev.dismissed, id],
      };
    });
  };

  const addElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElemName.trim()) return;
    const newElem: ElementDetail = {
      id: `custom-${Date.now()}`,
      name: newElemName.trim(),
      category: newElemCat,
      cost: parseFloat(newElemCost) || 0,
      planStatus: newElemPlan,
      status: 'PLANNED',
      notes: newElemNotes.trim(),
      custom: true,
    };
    updateElemLocal((prev) => ({ ...prev, custom: [...prev.custom, newElem] }));
    setNewElemName('');
    setNewElemNotes('');
    setShowAddForm(false);
    setExpandedElemId(newElem.id);
  };

  const totalElemCost = elementDetails.reduce((sum, el) => sum + el.cost, 0);

  // SHOTS TAB — the real per-shot plan, fetched the same way ShotListView
  // does, so the Inspector never invents an "Approved" status a shot
  // doesn't actually have.
  const [projectShots, setProjectShots] = useState<Shot[]>([]);
  useEffect(() => {
    apiFetch(`/api/clickhouse/shots?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => setProjectShots(data.status === 'ok' && Array.isArray(data.shots) ? data.shots : []))
      .catch(() => setProjectShots([]));
  }, [activeProject.id]);

  if (!inspectorOpen) return null;

  return (
    <aside
      className={styles.panel}
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

      <Tabs value={inspectorTab} onValueChange={(v) => setInspectorTab(v as InspectorTab)}>
        <TabsList className={styles.tabs}>
          {(['files', 'info', 'elems', 'shots', 'plan'] as InspectorTab[]).map((tab) => (
            <TabsTrigger key={tab} value={tab} className={styles.tab}>
              {tab.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className={styles.body}>
        {/* FILES TAB: FULL PROJECT EXPLORER FOLDER TREE */}
        {inspectorTab === 'files' && (
          <div className={styles.group}>
            <div className={styles.groupTitle}>Project File Directory</div>
            <Accordion type="multiple" value={openFolders} onValueChange={setOpenFolders} className={styles.treeArea}>
              {FOLDERS.map((folder) => (
                <AccordionItem key={folder.name} value={folder.name} className={styles.folderGroup}>
                  <AccordionTrigger className={styles.folderHdr}>
                    {/* Wrapped in one span so only the chevron (the other
                        direct child of the trigger) rotates on open — the
                        folder icon isn't a direct svg child anymore. */}
                    <span className={styles.folderHdrLabel}>
                      <Folder size={13} className={styles.folderIcon} />
                      {folder.name}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className={styles.fileList}>
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
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
                  <Input
                    className={styles.formInput}
                    placeholder="Name (e.g. Kai or Prop Gun)"
                    value={newElemName}
                    onChange={(e) => setNewElemName(e.target.value)}
                    autoFocus
                  />
                  <Select value={newElemCat} onValueChange={(v) => setNewElemCat(v as ElementDetail['category'])}>
                    <SelectTrigger size="sm" className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cast">Cast / Actor</SelectItem>
                      <SelectItem value="props">Props</SelectItem>
                      <SelectItem value="ward">Wardrobe</SelectItem>
                      <SelectItem value="vfx">VFX</SelectItem>
                      <SelectItem value="sfx">SFX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={styles.formRow}>
                  <Input
                    className={styles.formInput}
                    type="number"
                    placeholder="Est. Cost ($)"
                    value={newElemCost}
                    onChange={(e) => setNewElemCost(e.target.value)}
                  />
                  <Select value={newElemPlan} onValueChange={(v) => setNewElemPlan(v as ElementDetail['planStatus'])}>
                    <SelectTrigger size="sm" className="w-[190px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAG-AFTRA DAY RATE">SAG-AFTRA Day Rate</SelectItem>
                      <SelectItem value="RENTAL">Rental</SelectItem>
                      <SelectItem value="PURCHASED">Purchased</SelectItem>
                      <SelectItem value="SAFETY / ARMORER">Safety / Armorer</SelectItem>
                      <SelectItem value="POST-VFX PASS">Post VFX Pass</SelectItem>
                      <SelectItem value="ON-SET PRACTICAL">On-Set Practical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Input
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
            <Accordion type="single" collapsible value={expandedElemId ?? ''} onValueChange={(v) => setExpandedElemId(v || null)}>
              {CATEGORY_GROUPS.map((catGroup) => {
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
                          <AccordionItem
                            key={el.id}
                            value={el.id}
                            className={`${styles.elemCard} ${isExpanded ? styles.elemCardExpanded : ''}`}
                          >
                            {/* CLICKABLE COMPACT HEADER ROW */}
                            <AccordionTrigger
                              className={styles.elemCardHeaderRow}
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
                            </AccordionTrigger>

                            {/* EXPANDABLE BUDGET & PROCUREMENT PLAN DETAILS */}
                            <AccordionContent className={styles.elemExpandedBody}>
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
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* PLAN TAB */}
        {inspectorTab === 'plan' && (
          <div className={styles.group}>
            <div className={styles.groupTitle}>Action Plan Governance</div>
            {gates.length === 0 ? (
              <div className={styles.empty}>No scenes yet — governance gates appear once scenes are ingested.</div>
            ) : (
              <div className={styles.gateList}>
                {gates.map((g) => {
                  const approved = g.autoApproved || approvedGates[g.id] === true;
                  return (
                    <div
                      key={g.id}
                      className={`${styles.gateCard} ${approved ? styles.gateApproved : styles.gatePending}`}
                    >
                      <div className={styles.gateHdr}>
                        <strong>{g.name}</strong>
                        <span className={approved ? styles.badgeOk : styles.badgeWarn}>
                          {approved ? '✓ APPROVED' : 'PENDING'}
                        </span>
                      </div>
                      <p className={styles.gateDesc}>{g.desc}</p>
                      {!approved && (
                        <button className={styles.approveBtn} onClick={() => approveGate(g.id)}>
                          <ShieldCheck size={13} /> APPROVE GATE
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

            {inspectorTab === 'shots' && selectedScene && (() => {
              const sceneShots = projectShots.filter((sh) => sh.sceneNum === selectedScene.num);
              // Nothing loaded for this scene yet (offline, or not shot-listed
              // yet) — show the planned count from the scene itself rather
              // than fabricating per-shot statuses that don't exist.
              const rows = sceneShots.length > 0
                ? sceneShots.map((sh) => ({ label: sh.label, status: sh.status }))
                : Array.from({ length: selectedScene.shots }, (_, j) => ({
                    label: `${selectedScene.num}${String.fromCharCode(65 + j)}`,
                    status: 'planned' as const,
                  }));

              return (
                <div className={styles.group}>
                  <div className={styles.groupTitle}>Shots — SC.{selectedScene.num}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: '9px' }}>
                    {rows.length} shot{rows.length === 1 ? '' : 's'} planned
                  </div>
                  {rows.map((r) => (
                    <div key={r.label} className={styles.shotRow}>
                      <span style={{ fontSize: '.72rem', fontWeight: 800, color: 'var(--t1)' }}>{r.label}</span>
                      <span className={`${styles.statusPill} ${r.status === 'approved' ? styles.ssOk : styles.ssPlan}`}>
                        {r.status === 'approved' ? '✓ Approved' : r.status === 'shot' ? '🎥 Shot' : r.status === 'setup' ? '⚙ Set Up' : 'Planned'}
                      </span>
                    </div>
                  ))}
                  <button className={styles.openShotBtn} onClick={() => setActiveView('shotlist')}>
                    Open Full Shot List →
                  </button>
                </div>
              );
            })()}
          </>
        ))}
      </div>
    </aside>
  );
}
