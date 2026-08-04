// src/components/layout/NavRail.tsx
import { useState, useRef, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, Folder, FileText, LayoutDashboard,
  Layers, CalendarDays, Camera, DollarSign, ClipboardList, Database,
  Download, GripVertical,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { ViewId } from '../../types';
import { AgentCapsule } from '../agent/AgentCapsule';
import styles from './NavRail.module.css';

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

export function NavRail() {
  const { activeView, setActiveView } = useStudioStore();
  const [railWidth, setRailWidth] = useState(260);
  const isResizing = useRef(false);

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

  // Horizontal Resize Drag Logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();

    const onMouseMove = (me: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(520, me.clientX));
      setRailWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <nav className={styles.rail} style={{ width: `${railWidth}px` }}>
      {/* DRAG RESIZE HANDLE */}
      <div
        className={styles.resizer}
        onMouseDown={startResizing}
        onDoubleClick={() => setRailWidth(260)}
        title="Drag horizontally to resize chat & project explorer (Double-click to reset)"
      >
        <GripVertical size={10} className={styles.resizerIcon} />
      </div>

      <div className={styles.label}>
        <span>Project Explorer</span>
        <span className={styles.rootPill}>neon_echoes</span>
      </div>

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

      {/* Project Stats summary */}
      <div className={styles.statBox}>
        <div className={styles.statRow}>
          <span className={styles.statLbl}>Budget</span>
          <span className={`${styles.statVal} ${styles.bad}`}>$8,110/$5k</span>
        </div>
        <div className={styles.pbar}><div className={`${styles.pfill} ${styles.pfillRed}`} /></div>
        <div className={styles.statRow}>
          <span className={styles.statLbl}>Shoot Days</span>
          <span className={`${styles.statVal} ${styles.warn}`}>2 of 2</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLbl}>Scenes OK</span>
          <span className={`${styles.statVal} ${styles.ok}`}>1/3</span>
        </div>
      </div>

      <div className={styles.bottom}>
        <AgentCapsule />
      </div>
    </nav>
  );
}
