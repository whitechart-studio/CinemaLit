// src/hooks/useKeyboard.ts
import { useEffect } from 'react';
import { useStudioStore } from '../store/studio';

export function useKeyboard() {
  const { setTool, closeInspector, selectScene, resetView } = useStudioStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === 'TEXTAREA' ||
        tag === 'INPUT' ||
        (e.target as HTMLElement).isContentEditable;
      if (isEditable) return;

      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'h': setTool('hand'); break;
        case 'c': setTool('connect'); break;
        case 'escape':
          closeInspector();
          setTool('select');
          selectScene(null);
          break;
        case '+':
        case '=': {
          const s = useStudioStore.getState();
          s.setZoom(s.zoom + 0.1);
          break;
        }
        case '-': {
          const s = useStudioStore.getState();
          s.setZoom(s.zoom - 0.1);
          break;
        }
        case '0': resetView(); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setTool, closeInspector, selectScene, resetView]);
}
