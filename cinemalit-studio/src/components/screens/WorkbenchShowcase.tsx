// src/components/screens/WorkbenchShowcase.tsx — the landing page's hero
// visual: the real workbench UI, not a mockup. Reuses the actual CSS Modules
// from TopBar / WorkspaceHeader / LeftRail / InspectorPanel / BreakdownView
// so every color, radius and font size is pixel-identical to the real app.
// No store, no API calls, no event handlers with side effects — this is
// UI only, driven by a small local animation loop.
import { useEffect, useRef, useState } from 'react';
import {
  Clapperboard, PanelLeft, PanelRight, Maximize2, Sparkles,
  Loader2, ArrowUp, LayoutDashboard, FileText, Layers, CalendarDays,
  Camera, DollarSign, ClipboardList, Film, Database, Bot, X,
} from 'lucide-react';
import topbarStyles from '../layout/TopBar.module.css';
import tabStyles from '../layout/WorkspaceHeader.module.css';
import railStyles from '../layout/LeftRail.module.css';
import inspectorStyles from '../inspector/InspectorPanel.module.css';
import breakdownStyles from '../views/BreakdownView.module.css';
import styles from './WorkbenchShowcase.module.css';

const TABS = [
  { id: 'canvas', label: 'Scene Flow', title: 'Scene Flow Board', icon: LayoutDashboard },
  { id: 'script', label: 'Screenplay', title: 'Screenplay Reader', icon: FileText },
  { id: 'storyboard', label: 'AI Storyboards', title: 'AI Storyboards', icon: Sparkles },
  { id: 'breakdown', label: 'Breakdown', title: 'Script Breakdown', icon: Layers },
  { id: 'stripboard', label: 'Stripboard', title: 'Stripboard & Schedule', icon: CalendarDays },
  { id: 'shotlist', label: 'Shot List', title: 'Shot List', icon: Camera },
  { id: 'budget', label: 'Budget', title: 'Budget TopSheet', icon: DollarSign },
  { id: 'callsheet', label: 'Call Sheet', title: 'DGA Call Sheet', icon: ClipboardList },
] as const;

/** Scripted Director AI exchange, looped: 0 idle -> 1 user asks -> 2 agent
 *  thinking -> 3 agent answers -> hold -> back to 0. Pure UI theatre, same
 *  copy the real quick-prompts produce (see PRODUCT.md's Rain FX example). */
function useChatPhase() {
  const [phase, setPhase] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(3);
      return;
    }
    const id = setInterval(() => {
      if (!pausedRef.current) setPhase((p) => (p + 1) % 4);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return { phase, pausedRef };
}

export function WorkbenchShowcase() {
  const { phase, pausedRef } = useChatPhase();

  return (
    <div
      className={styles.workbench}
      aria-hidden="true"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Real TopBar, static */}
      <div className={topbarStyles.topbar}>
        <div className={topbarStyles.brand}>
          <div className={topbarStyles.brandMark}><Clapperboard size={18} /></div>
          <span className={topbarStyles.brandName}>Cinema<span>Lit</span></span>
        </div>
        <div className={`${topbarStyles.center} ${styles.projWrap}`}>
          <div className={topbarStyles.projTrigger}>
            <span className={topbarStyles.projName}>Gotham Nights</span>
            <span className={`${topbarStyles.projPhase} ${styles.projPhase}`}>PRE-PRODUCTION</span>
          </div>
        </div>
        <div className={topbarStyles.right} />
      </div>

      {/* Real WorkspaceHeader tab strip — active tab cycles automatically */}
      <div className={tabStyles.header}>
        <button className={tabStyles.btn} tabIndex={-1}><PanelLeft size={14} /></button>
        <div className={tabStyles.tabsScroll}>
          <div className={tabStyles.tabsWrapper}>
            {TABS.map((t) => (
              <span key={t.id} className={`${styles.cycleTab} ${tabStyles.tab} flex-none justify-start`}>
                <span className={tabStyles.tabIcon}><t.icon size={13} /></span>
                <span className={tabStyles.tabLabel}>{t.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className={tabStyles.actions}>
          <button className={tabStyles.btn} tabIndex={-1}><PanelRight size={14} /></button>
          <button className={tabStyles.btn} tabIndex={-1}><Maximize2 size={14} /></button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Real LeftRail — director agent chat, scripted exchange looping */}
        <div className={railStyles.rail} style={{ width: 240 }}>
          <div className={railStyles.header}>
            <div className={railStyles.brand}>
              <Sparkles size={13} color="var(--accent)" />
              <span className={railStyles.title}>Director AI</span>
            </div>
            <button className={railStyles.expandModalBtn} tabIndex={-1}><Maximize2 size={13} /></button>
          </div>

          <div className={railStyles.chatLog}>
            {phase >= 1 && (
              <div className={`${railStyles.msgRow} ${railStyles.userRow}`}>
                <div className={railStyles.msgMeta}><span className={railStyles.roleName}>You</span></div>
                <div className={railStyles.msgBubble}>What&apos;s driving Scene 2 over budget?</div>
              </div>
            )}
            {phase === 2 && (
              <div className={railStyles.typingBox}>
                <Loader2 size={12} className={railStyles.spinner} /> Director AI is thinking…
              </div>
            )}
            {phase >= 3 && (
              <div className={`${railStyles.msgRow} ${railStyles.agentRow}`}>
                <div className={railStyles.msgMeta}><span className={railStyles.roleName}>Director AI</span></div>
                <div className={railStyles.msgBubble}>Gotham Rooftop rain FX flagged. Consolidate ext. locations to save ~$800.</div>
              </div>
            )}
          </div>

          <div className={railStyles.quickBar}>
            <span className={railStyles.qpChip}>Rain FX Optimization</span>
            <span className={railStyles.qpChip}>Budget Cap Analysis</span>
            <span className={railStyles.qpChip}>Review DGA Compliance</span>
          </div>

          <div className={railStyles.inputArea}>
            <div className={railStyles.textarea}>Ask Director Agent…</div>
            <span className={railStyles.sendBtn}><ArrowUp size={13} /></span>
          </div>
        </div>

        {/* Content pane — cycles through the 8 real views */}
        <div className={styles.content}>
          <div className={styles.stage}>
            <div className={styles.canvasRow}>
              <div className={styles.sceneCard}>
                <div className={`${styles.sceneHdr} ${styles.hdrIn}`}><span>SC.01</span><span>INT·NIGHT</span></div>
                <div className={styles.sceneLoc}>Wayne Manor</div>
                <div className={styles.sceneMeta}>0.31pg · Day 1 · 4 shots</div>
                <div className={styles.sceneCast}><span className={styles.castChip}>Bruce</span><span className={styles.castChip}>Alfred</span></div>
                <div className={styles.riskRow}><span className={styles.riskHigh}>HIGH</span></div>
              </div>
              <div className={styles.sceneCard}>
                <div className={`${styles.sceneHdr} ${styles.hdrEx}`}><span>SC.02</span><span>EXT·NIGHT</span></div>
                <div className={styles.sceneLoc}>Gotham Rooftop</div>
                <div className={styles.sceneMeta}>0.25pg · Day 1 · 3 shots</div>
                <div className={styles.sceneCast}><span className={styles.castChip}>Bruce</span><span className={styles.castChip}>Gordon</span></div>
                <div className={styles.riskRow}><span className={styles.riskHigh}>HIGH</span></div>
              </div>
              <div className={styles.sceneCard}>
                <div className={`${styles.sceneHdr} ${styles.hdrIn}`}><span>SC.03</span><span>INT·NIGHT</span></div>
                <div className={styles.sceneLoc}>Batcave</div>
                <div className={styles.sceneMeta}>0.19pg · Day 2 · 3 shots</div>
                <div className={styles.sceneCast}><span className={styles.castChip}>Bruce</span><span className={styles.castChip}>Alfred</span></div>
                <div className={styles.riskRow}><span className={styles.riskLow}>LOW</span></div>
              </div>
            </div>
          </div>

          <div className={styles.stage}>
            <div className={styles.scriptSlug}>INT. WAYNE MANOR — NIGHT</div>
            <p className={styles.scriptAction}>Bruce descends the study stairs, thunder rattling the windows. Alfred waits by the fire.</p>
            <div className={styles.scriptChar}>ALFRED</div>
            <p className={styles.scriptLine}>Another late night, Master Wayne?</p>
            <div className={styles.scriptChar}>BRUCE <span>(quiet)</span></div>
            <p className={styles.scriptLine}>Gotham doesn&apos;t sleep. Neither can I.</p>
          </div>

          <div className={styles.stage}>
            <div className={styles.frameRow}>
              <div className={styles.frame} style={{ backgroundImage: 'url(/storyboards/p3078b6bb532f/scene_01/frame_01.jpg)' }}>
                <span className={styles.frameCaption}>50mm · Dolly In · 0:00–0:04</span>
              </div>
              <div className={styles.frame} style={{ backgroundImage: 'url(/storyboards/p3078b6bb532f/scene_01/frame_02.jpg)' }}>
                <span className={styles.frameCaption}>24mm · Crane Down · 0:04–0:09</span>
              </div>
              <div className={styles.frame} style={{ backgroundImage: 'url(/storyboards/p3078b6bb532f/scene_02/frame_01.jpg)' }}>
                <span className={styles.frameCaption}>35mm · Handheld · 0:09–0:14</span>
              </div>
            </div>
          </div>

          <div className={breakdownStyles.view} style={{ background: 'transparent' }}>
            <div className={breakdownStyles.header} style={{ background: 'transparent', border: 'none', padding: '0 0 10px' }}>
              <Layers size={15} color="var(--accent)" />
              <span className={breakdownStyles.title}>Script Breakdown — Gotham Nights</span>
              <span className={breakdownStyles.subtitle}>3 scenes · AI-analyzed</span>
            </div>
            <div className={breakdownStyles.card} style={{ borderLeft: '3px solid var(--sin-a)' }}>
              <div className={breakdownStyles.cardHeader}>
                <span className={breakdownStyles.sceneType} style={{ color: 'var(--sin-a)' }}>SC.01 · INT/NIGHT</span>
                <span className={breakdownStyles.cardTitle}>Wayne Manor</span>
                <span className={breakdownStyles.dayTag}>Day 1</span>
                <span className={breakdownStyles.pgCount}>0.31 pg</span>
              </div>
              <div className={breakdownStyles.cardGrid}>
                <div>
                  <div className={breakdownStyles.catLabel}>Cast</div>
                  <span className={breakdownStyles.tag}>Bruce</span>
                  <span className={breakdownStyles.tag}>Alfred</span>
                </div>
                <div>
                  <div className={breakdownStyles.catLabel}>Props</div>
                  <span className={breakdownStyles.tag}>Grandfather Clock</span>
                </div>
                <div>
                  <div className={breakdownStyles.catLabel}>VFX</div>
                  <span className={breakdownStyles.tag}>Lightning Flash</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stage}>
            <div className={`${styles.strip} ${styles.stripA}`}>Day 1 — Wayne Manor · Gotham Rooftop</div>
            <div className={`${styles.strip} ${styles.stripB}`}>Day 2 — Batcave</div>
          </div>

          <div className={styles.stage}>
            <div className={styles.shotRow}><span>1A</span><span>WS</span><span>28mm</span><span className={styles.shotApproved}>Approved</span></div>
            <div className={styles.shotRow}><span>1B</span><span>MS</span><span>50mm</span><span className={styles.shotPlanned}>Planned</span></div>
            <div className={styles.shotRow}><span>2A</span><span>POV</span><span>24mm</span><span className={styles.shotPlanned}>Planned</span></div>
          </div>

          <div className={styles.stage}>
            <div className={styles.budgetRow}><span>Cast</span><span>$2,400</span><span className={styles.riskLow}>OK</span></div>
            <div className={styles.budgetRow}><span>VFX / SFX</span><span>$1,850</span><span className={styles.riskHigh}>OVER</span></div>
            <div className={styles.budgetRow}><span>Locations</span><span>$600</span><span className={styles.riskLow}>OK</span></div>
          </div>

          <div className={styles.stage}>
            <div className={styles.callHead}>DAY 1 — 8 scenes · 4.2 pages</div>
            <div className={styles.callRow}><span>Bruce</span><span>6:00 AM</span></div>
            <div className={styles.callRow}><span>Alfred</span><span>6:30 AM</span></div>
          </div>
        </div>

        {/* Real InspectorPanel, peeking open at the edge */}
        <div className={inspectorStyles.panel} style={{ width: 46, flexShrink: 0 }}>
          <div className={inspectorStyles.header} style={{ padding: '0 10px', justifyContent: 'center' }}>
            <X size={13} color="var(--t3)" />
          </div>
        </div>
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusLeft}>
          <Film size={11} />
          {TABS.map((t) => <span key={t.id} className={styles.statusTitle}>{t.title}</span>)}
        </span>
        <span className={styles.statusRight}>
          <Database size={11} color="var(--cyan)" /> ClickHouse Connected
          <Bot size={11} color="var(--accent)" /> Agent Active
        </span>
      </div>
    </div>
  );
}
