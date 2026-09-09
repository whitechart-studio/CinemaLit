// src/components/layout/WorkspaceHeader.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LayoutDashboard, FileText, Layers, CalendarDays,
  Camera, DollarSign, ClipboardList,
  PanelRight, PanelLeft, Maximize2, X, Plus, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { ViewId } from '../../types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './WorkspaceHeader.module.css';

interface TabMeta {
  id: ViewId;
  label: string;
  fileName: string;
  icon: React.ReactNode;
}

const TAB_META: Record<ViewId, TabMeta> = {
  canvas:     { id: 'canvas',     label: 'Scene Flow',  fileName: 'scene_flow.board',      icon: <LayoutDashboard size={13} /> },
  script:     { id: 'script',     label: 'Screenplay',  fileName: 'script.fountain',      icon: <FileText size={13} /> },
  storyboard: { id: 'storyboard', label: 'AI Storyboards', fileName: 'ai_storyboards.board',  icon: <Sparkles size={13} color="var(--accent)" /> },
  breakdown:  { id: 'breakdown',  label: 'Breakdown',   fileName: 'breakdown.json',       icon: <Layers size={13} /> },
  stripboard: { id: 'stripboard', label: 'Stripboard',  fileName: 'stripboard.json',      icon: <CalendarDays size={13} /> },
  shotlist:   { id: 'shotlist',   label: 'Shot List',   fileName: 'shot_list.csv',        icon: <Camera size={13} /> },
  budget:     { id: 'budget',     label: 'Budget',      fileName: 'budget_topsheet.xlsx', icon: <DollarSign size={13} /> },
  callsheet:  { id: 'callsheet',  label: 'Call Sheet',  fileName: 'call_sheet_day1.pdf',  icon: <ClipboardList size={13} /> },
};

const ALL_VIEWS: ViewId[] = ['canvas', 'script', 'storyboard', 'breakdown', 'stripboard', 'shotlist', 'budget', 'callsheet'];

export function WorkspaceHeader() {
  const {
    activeView, openTabs, setActiveView, closeTab,
    inspectorOpen, setInspectorOpen, chatOpen, setChatOpen,
  } = useStudioStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, openTabs.length]);

  // Keep the active tab in view when it changes from elsewhere (e.g. the
  // Inspector's file tree, or a keyboard shortcut) — not just on click here.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>('[data-state="active"]');
    activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeView]);

  const scrollByAmount = (dx: number) => scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const openNextClosedTab = () => {
    const closed = ALL_VIEWS.find((v) => !openTabs.includes(v));
    if (closed) setActiveView(closed);
  };

  return (
    <div className={styles.header}>
      <button
        className={`${styles.btn} ${chatOpen ? styles.activeBtn : ''}`}
        title="Toggle Director AI Chat"
        onClick={() => setChatOpen(!chatOpen)}
      >
        <PanelLeft size={14} />
      </button>
      {canScrollLeft && (
        <button className={styles.scrollBtn} onClick={() => scrollByAmount(-160)} title="Scroll tabs left">
          <ChevronLeft size={14} />
        </button>
      )}
      <div className={styles.tabsScroll} ref={scrollRef}>
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as ViewId)} className="contents">
        <TabsList className={`${styles.tabsWrapper} h-full w-auto justify-start rounded-none bg-transparent p-0`}>
          {openTabs.map((viewId) => {
            const tab = TAB_META[viewId];
            if (!tab) return null;
            const isActive = activeView === viewId;

            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                title={tab.fileName}
                className={`${styles.tab} ${isActive ? styles.active : ''} flex-none justify-start`}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabLabel}>{tab.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  className={styles.closeBtn}
                  title={`Close ${tab.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X size={11} />
                </span>
              </TabsTrigger>
            );
          })}

          {openTabs.length < ALL_VIEWS.length && (
            <button
              className={styles.addTabBtn}
              title="Open next file tab"
              onClick={openNextClosedTab}
            >
              <Plus size={13} />
            </button>
          )}
        </TabsList>
      </Tabs>
      </div>
      {canScrollRight && (
        <button className={styles.scrollBtn} onClick={() => scrollByAmount(160)} title="Scroll tabs right">
          <ChevronRight size={14} />
        </button>
      )}

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${inspectorOpen ? styles.activeBtn : ''}`}
          title="Toggle Inspector Panel"
          onClick={() => setInspectorOpen(!inspectorOpen)}
        >
          <PanelRight size={14} />
        </button>
        <button className={styles.btn} title="Fullscreen" onClick={toggleFullscreen}>
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
