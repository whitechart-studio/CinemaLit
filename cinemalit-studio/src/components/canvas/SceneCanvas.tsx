// src/components/canvas/SceneCanvas.tsx
import { useRef, useCallback, useEffect } from 'react';
import { useStudioStore, makeNewScene, makeConnection } from '../../store/studio';
import { SceneNode } from './SceneNode';
import { ConnectorLayer } from './ConnectorLayer';
import { CanvasToolbar } from './CanvasToolbar';
import { Minimap } from './Minimap';
import styles from './SceneCanvas.module.css';

export function SceneCanvas() {
  const {
    scenes, panX, panY, zoom,
    setPan, tool,
    addScene, addConnection,
    selectedSceneId, selectScene,
    connectFromId, setConnectFrom,
    openInspector,
  } = useStudioStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCvs = useRef(false);
  const pStart = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);

  // Space bar = temp pan tool
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spaceDown.current) {
        const tgt = e.target as HTMLElement;
        if (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT') return;
        spaceDown.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
        e.preventDefault();
      }
    };
    const onKU = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        if (containerRef.current && tool !== 'hand') containerRef.current.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);
    return () => { window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); };
  }, [tool]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const oldZ = useStudioStore.getState().zoom;
    const newZ = Math.max(0.2, Math.min(3, oldZ + delta));
    const nx = cx - (cx - useStudioStore.getState().panX) * (newZ / oldZ);
    const ny = cy - (cy - useStudioStore.getState().panY) * (newZ / oldZ);
    useStudioStore.getState().setZoom(newZ);
    useStudioStore.getState().setPan(nx, ny);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isCanvas = e.target === containerRef.current ||
      (e.target as HTMLElement).id === 'cvBoard' ||
      (e.target as HTMLElement).classList.contains(styles.dotGrid);
    if (!isCanvas) return;
    if (tool === 'hand' || spaceDown.current) {
      isDraggingCvs.current = true;
      pStart.current = { x: e.clientX - panX, y: e.clientY - panY };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }
    // Deselect on canvas click
    selectScene(null);
  }, [tool, panX, panY, selectScene]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingCvs.current) {
      setPan(e.clientX - pStart.current.x, e.clientY - pStart.current.y);
    }
  }, [setPan]);

  const onMouseUp = useCallback(() => {
    isDraggingCvs.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = tool === 'hand' ? 'grab' : tool === 'connect' ? 'crosshair' : 'default';
    }
  }, [tool]);

  const handleNodeClick = useCallback((sceneId: string) => {
    if (tool === 'connect') {
      if (!connectFromId) {
        setConnectFrom(sceneId);
      } else if (connectFromId !== sceneId) {
        const alreadyExists = useStudioStore.getState().connections.some(
          (c) => c.from === connectFromId && c.to === sceneId
        );
        if (!alreadyExists) {
          addConnection(makeConnection(connectFromId, sceneId));
        }
        setConnectFrom(null);
      }
      return;
    }
    selectScene(sceneId);
    openInspector(sceneId);
  }, [tool, connectFromId, setConnectFrom, addConnection, selectScene, openInspector]);

  const handleAddNode = useCallback(() => {
    const current = useStudioStore.getState();
    const newScene = makeNewScene(current.scenes);
    const lastScene = current.scenes[current.scenes.length - 1];
    addScene(newScene);
    addConnection(makeConnection(lastScene.id, newScene.id));
  }, [addScene, addConnection]);

  const cursorStyle = tool === 'hand' ? 'grab' : tool === 'connect' ? 'crosshair' : 'default';

  return (
    <div className={styles.wrapper}>
      <CanvasToolbar onAddNode={handleAddNode} />
      <div
        ref={containerRef}
        className={styles.container}
        style={{ cursor: cursorStyle }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className={styles.dotGrid} />
        <div
          id="cvBoard"
          className={styles.board}
          style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
        >
          <ConnectorLayer />
          {scenes.map((scene) => (
            <SceneNode
              key={scene.id}
              scene={scene}
              isSelected={selectedSceneId === scene.id}
              isConnectFrom={connectFromId === scene.id}
              onClick={() => handleNodeClick(scene.id)}
            />
          ))}
        </div>
        <Minimap containerRef={containerRef} />
        <div className={styles.hints}>
          <span className={styles.kbd}>V</span> Select &nbsp;
          <span className={styles.kbd}>H</span> Pan &nbsp;
          <span className={styles.kbd}>C</span> Connect &nbsp;
          <span className={styles.kbd}>Scroll</span> Zoom &nbsp;
          <span className={styles.kbd}>Esc</span> Deselect
        </div>
      </div>
    </div>
  );
}
