// src/components/canvas/Minimap.tsx
import { useRef, useEffect } from 'react';
import { useStudioStore } from '../../store/studio';
import styles from './Minimap.module.css';

interface Props { containerRef: React.RefObject<HTMLDivElement | null>; }

const W = 154, H = 104, BW = 4000, BH = 3000;
const SX = W / BW, SY = H / BH;

export function Minimap({ containerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scenes, connections, selectedSceneId, panX, panY, zoom } = useStudioStore();

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(9,9,14,.85)';
    ctx.fillRect(0, 0, W, H);

    // Draw connections
    connections.forEach((conn) => {
      const f = scenes.find((s) => s.id === conn.from);
      const t = scenes.find((s) => s.id === conn.to);
      if (!f || !t) return;
      ctx.strokeStyle = 'rgba(255,255,255,.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo((f.x + 220) * SX, (f.y + 74) * SY);
      ctx.lineTo(t.x * SX, (t.y + 74) * SY);
      ctx.stroke();
    });

    // Draw nodes
    scenes.forEach((sc) => {
      ctx.fillStyle = sc.id === selectedSceneId ? 'rgba(245,158,11,.55)' : 'rgba(35,35,55,.9)';
      ctx.strokeStyle = sc.id === selectedSceneId ? '#F59E0B' : 'rgba(255,255,255,.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sc.x * SX, sc.y * SY, 220 * SX, 140 * SY, 2);
      ctx.fill(); ctx.stroke();
    });

    // Viewport rect
    const cont = containerRef.current;
    if (!cont) return;
    const vpx = (-panX / zoom) * SX;
    const vpy = (-panY / zoom) * SY;
    const vpw = (cont.clientWidth / zoom) * SX;
    const vph = (cont.clientHeight / zoom) * SY;
    ctx.strokeStyle = 'rgba(245,158,11,.65)';
    ctx.fillStyle = 'rgba(245,158,11,.05)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(Math.max(0, vpx), Math.max(0, vpy), Math.min(W, vpw), Math.min(H, vph), 2);
    ctx.fill(); ctx.stroke();
  }, [scenes, connections, selectedSceneId, panX, panY, zoom, containerRef]);

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={W} height={H} />
    </div>
  );
}
