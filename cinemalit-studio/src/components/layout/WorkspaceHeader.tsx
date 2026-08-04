// src/components/layout/WorkspaceHeader.tsx
import {
  LayoutDashboard, FileText, Layers, CalendarDays,
  Camera, DollarSign, ClipboardList, Database,
  PanelRight, Maximize2, X, Plus, Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { ViewId } from '../../types';
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
  storyboard: { id: 'storyboard', label: 'AI Storyboards', fileName: 'ai_storyboards.board',  icon: <Sparkles size={13} color="var(--gold)" /> },
  breakdown:  { id: 'breakdown',  label: 'Breakdown',   fileName: 'breakdown.json',       icon: <Layers size={13} /> },
  stripboard: { id: 'stripboard', label: 'Stripboard',  fileName: 'stripboard.json',      icon: <CalendarDays size={13} /> },
  shotlist:   { id: 'shotlist',   label: 'Shot List',   fileName: 'shot_list.csv',        icon: <Camera size={13} /> },
  budget:     { id: 'budget',     label: 'Budget',      fileName: 'budget_topsheet.xlsx', icon: <DollarSign size={13} /> },
  callsheet:  { id: 'callsheet',  label: 'Call Sheet',  fileName: 'call_sheet_day1.pdf',  icon: <ClipboardList size={13} /> },
  sql:        { id: 'sql',        label: 'ClickHouse',  fileName: 'clickhouse_memory.sql',icon: <Database size={13} /> },
};

const ALL_VIEWS: ViewId[] = ['canvas', 'script', 'storyboard', 'breakdown', 'stripboard', 'shotlist', 'budget', 'callsheet', 'sql'];

export function WorkspaceHeader() {
  const {
    activeView, openTabs, setActiveView, closeTab,
    inspectorOpen, openInspector, closeInspector, selectedSceneId, scenes,
  } = useStudioStore();

  const toggleInspector = () => {
    if (inspectorOpen) {
      closeInspector();
    } else {
      const targetId = selectedSceneId || (scenes.length > 0 ? scenes[0].id : '');
      if (targetId) openInspector(targetId);
    }
  };

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
      <div className={styles.tabsWrapper}>
        {openTabs.map((viewId) => {
          const tab = TAB_META[viewId];
          if (!tab) return null;
          const isActive = activeView === viewId;

          return (
            <div
              key={tab.id}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => setActiveView(tab.id)}
              title={tab.fileName}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
              <button
                className={styles.closeBtn}
                title={`Close ${tab.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
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
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${inspectorOpen ? styles.activeBtn : ''}`}
          title="Toggle Inspector Panel"
          onClick={toggleInspector}
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
