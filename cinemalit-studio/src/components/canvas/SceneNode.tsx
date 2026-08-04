// src/components/canvas/SceneNode.tsx
import { useRef, useCallback, useState } from 'react';
import { Copy, Trash2, Edit2, Check } from 'lucide-react';
import type { Scene } from '../../types';
import { useStudioStore } from '../../store/studio';
import styles from './SceneNode.module.css';

interface Props {
  scene: Scene;
  isSelected: boolean;
  isConnectFrom: boolean;
  onClick: () => void;
}

const HDR_CLASS: Record<string, string> = {
  'INT-NIGHT': styles.hdrSin,
  'EXT-NIGHT': styles.hdrSen,
  'EXT-DAY':   styles.hdrSed,
  'INT-DAY':   styles.hdrSid,
  'INT-DAWN':  styles.hdrSid,
  'EXT-DAWN':  styles.hdrSed,
};
const BADGE_CLASS: Record<string, string> = {
  'INT-NIGHT': styles.badgeSin,
  'EXT-NIGHT': styles.badgeSen,
  'EXT-DAY':   styles.badgeSed,
  'INT-DAY':   styles.badgeSid,
};

export function SceneNode({ scene, isSelected, isConnectFrom, onClick }: Props) {
  const { updateScene, deleteScene, duplicateScene } = useStudioStore();
  const isDragging = useRef(false);
  const startPos = useRef({ mx: 0, my: 0, sx: 0, sy: 0 });
  const moved = useRef(false);

  const [isEditingLoc, setIsEditingLoc] = useState(false);
  const [editLocVal, setEditLocVal] = useState(scene.loc);

  const hdrKey = `${scene.type}-${scene.timing}`;
  const hdrCls = HDR_CLASS[hdrKey] ?? styles.hdrSin;
  const badgeCls = BADGE_CLASS[hdrKey] ?? styles.badgeSin;

  const riskCls = scene.risk === 'high' ? styles.rHi : scene.risk === 'med' ? styles.rMd : styles.rLo;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.tagName === 'INPUT' || tgt.tagName === 'BUTTON' || tgt.closest('button')) return;
    isDragging.current = true;
    moved.current = false;
    startPos.current = {
      mx: e.clientX, my: e.clientY,
      sx: scene.x,   sy: scene.y,
    };
    e.stopPropagation();
    e.preventDefault();

    const zoom = useStudioStore.getState().zoom;

    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (me.clientX - startPos.current.mx) / zoom;
      const dy = (me.clientY - startPos.current.my) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;
      updateScene(scene.id, {
        x: startPos.current.sx + dx,
        y: startPos.current.sy + dy,
      });
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [scene.id, scene.x, scene.y, updateScene]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (moved.current) return;
    e.stopPropagation();
    onClick();
  }, [onClick]);

  const saveLocEdit = () => {
    setIsEditingLoc(false);
    if (editLocVal.trim()) {
      updateScene(scene.id, { loc: editLocVal });
    }
  };

  return (
    <div
      className={`${styles.node} ${isSelected ? styles.selected : ''} ${isConnectFrom ? styles.connectFrom : ''}`}
      style={{ left: scene.x, top: scene.y }}
      onMouseDown={onMouseDown}
      onClick={handleClick}
    >
      {/* ACTION BAR ON SELECTION */}
      {isSelected && (
        <div className={styles.nodeActionBar}>
          <button
            className={styles.nodeActBtn}
            title="Duplicate Scene Node"
            onClick={(e) => { e.stopPropagation(); duplicateScene(scene.id); }}
          >
            <Copy size={11} />
          </button>
          <button
            className={styles.nodeActBtn}
            title="Edit Location Title"
            onClick={(e) => { e.stopPropagation(); setIsEditingLoc(!isEditingLoc); }}
          >
            <Edit2 size={11} />
          </button>
          <button
            className={`${styles.nodeActBtn} ${styles.dangerAct}`}
            title="Delete Scene Node"
            onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      <div className={`${styles.header} ${hdrCls}`}>
        <span className={styles.sceneNum}>SC.{scene.num}</span>
        <span className={`${styles.badge} ${badgeCls}`}>{scene.type}·{scene.timing}</span>
      </div>

      <div className={styles.body}>
        {isEditingLoc ? (
          <div className={styles.editLocRow} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className={styles.editLocInput}
              value={editLocVal}
              onChange={(e) => setEditLocVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveLocEdit()}
              autoFocus
            />
            <button className={styles.saveLocBtn} onClick={saveLocEdit}>
              <Check size={11} />
            </button>
          </div>
        ) : (
          <div className={styles.loc}>{scene.loc}</div>
        )}

        <div className={styles.meta}>
          <span>{scene.pages}pg</span>
          <span className={styles.dot} />
          <span>Day {scene.day}</span>
          <span className={styles.dot} />
          <span>{scene.shots} shots</span>
        </div>
        <div className={styles.cast}>
          {scene.cast.map((c) => <span key={c} className={styles.castChip}>{c}</span>)}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={`${styles.risk} ${riskCls}`}>{scene.risk.toUpperCase()}</span>
        <span className={styles.pages}>{scene.pages}p</span>
      </div>
    </div>
  );
}
