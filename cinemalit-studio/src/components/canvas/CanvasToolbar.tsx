// src/components/canvas/CanvasToolbar.tsx
import { MousePointer2, Hand, GitMerge, PlusCircle, ZoomOut, ZoomIn, Maximize, LayoutGrid } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { CanvasTool } from '../../types';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import styles from './CanvasToolbar.module.css';

interface Props { onAddNode: () => void; }

export function CanvasToolbar({ onAddNode }: Props) {
  const { tool, setTool, zoom, setZoom, resetView, autoArrangeCanvas } = useStudioStore();

  return (
    <div className={styles.toolbar}>
      <ToggleGroup
        type="single"
        value={tool}
        onValueChange={(v) => v && setTool(v as CanvasTool)}
      >
        <ToggleGroupItem value="select" title="Select (V)" className={styles.btn}>
          <MousePointer2 size={14} />
        </ToggleGroupItem>
        <ToggleGroupItem value="hand" title="Pan (H)" className={styles.btn}>
          <Hand size={14} />
        </ToggleGroupItem>
        <ToggleGroupItem value="connect" title="Connect (C)" className={styles.btn}>
          <GitMerge size={14} />
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" className={styles.sep} />

      <Button variant="ghost" size="icon" className={styles.btn} title="Add Scene Node" onClick={onAddNode}>
        <PlusCircle size={14} />
      </Button>
      <Button variant="ghost" size="icon" className={styles.btn} title="Auto Arrange Scene Flow Layout" onClick={autoArrangeCanvas}>
        <LayoutGrid size={14} />
      </Button>

      <Separator orientation="vertical" className={styles.sep} />

      <Button variant="ghost" size="icon" className={styles.btn} title="Zoom Out (-)" onClick={() => setZoom(zoom - 0.1)}>
        <ZoomOut size={14} />
      </Button>
      <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" className={styles.btn} title="Zoom In (+)" onClick={() => setZoom(zoom + 0.1)}>
        <ZoomIn size={14} />
      </Button>
      <Button variant="ghost" size="icon" className={styles.btn} title="Fit to Screen (0)" onClick={resetView}>
        <Maximize size={14} />
      </Button>
    </div>
  );
}
