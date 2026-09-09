// src/hooks/useDrag.ts
// Shared pointer-drag hook — replaces the manual window.addEventListener
// ('mousemove'/'mouseup') pattern that was hand-written separately in
// SceneNode.tsx (node dragging) and InspectorPanel.tsx (panel resizing).
import { useCallback, useRef } from 'react';

interface UseDragOptions {
  onMove: (dx: number, dy: number, e: MouseEvent) => void;
  onEnd?: (e: MouseEvent) => void;
}

export function useDrag({ onMove, onEnd }: UseDragOptions) {
  const last = useRef({ x: 0, y: 0 });

  const start = useCallback(
    (e: React.MouseEvent) => {
      last.current = { x: e.clientX, y: e.clientY };

      const handleMove = (ev: MouseEvent) => {
        const dx = ev.clientX - last.current.x;
        const dy = ev.clientY - last.current.y;
        last.current = { x: ev.clientX, y: ev.clientY };
        onMove(dx, dy, ev);
      };

      const handleUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        onEnd?.(ev);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onMove, onEnd]
  );

  return start;
}
