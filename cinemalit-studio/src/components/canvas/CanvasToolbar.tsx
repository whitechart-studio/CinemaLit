// src/components/canvas/CanvasToolbar.tsx
import { MousePointer2, Hand, GitMerge, PlusCircle, ZoomOut, ZoomIn, Maximize, LayoutGrid } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { CanvasTool } from '../../types';
import styles from './CanvasToolbar.module.css';

interface Props { onAddNode: () => void; }

export function CanvasToolbar({ onAddNode }: Props) {
  const { tool, setTool, zoom, setZoom, resetView, autoArrangeCanvas } = useStudioStore();

  const ToolBtn = ({ id, title, icon }: { id: CanvasTool; title: string; icon: React.ReactNode }) => (
    <button
      className={`${styles.btn} ${tool === id ? styles.active : ''}`}
      title={`${title} (${id === 'select' ? 'V' : id === 'hand' ? 'H' : 'C'})`}
      onClick={() => setTool(id)}
    >
      {icon}
    </button>
  );

  return (
    <div className={styles.toolbar}>
      <ToolBtn id="select"  title="Select"  icon={<MousePointer2 size={14} />} />
      <ToolBtn id="hand"    title="Pan"     icon={<Hand size={14} />} />
      <ToolBtn id="connect" title="Connect" icon={<GitMerge size={14} />} />
      <div className={styles.sep} />
      <button className={styles.btn} title="Add Scene Node" onClick={onAddNode}>
        <PlusCircle size={14} />
      </button>
      <button className={styles.btn} title="Auto Arrange Scene Flow Layout" onClick={autoArrangeCanvas}>
        <LayoutGrid size={14} />
      </button>
      <div className={styles.sep} />
      <button className={styles.btn} title="Zoom Out (-)" onClick={() => setZoom(zoom - 0.1)}>
        <ZoomOut size={14} />
      </button>
      <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>
      <button className={styles.btn} title="Zoom In (+)" onClick={() => setZoom(zoom + 0.1)}>
        <ZoomIn size={14} />
      </button>
      <button className={styles.btn} title="Fit to Screen (0)" onClick={resetView}>
        <Maximize size={14} />
      </button>
    </div>
  );
}
