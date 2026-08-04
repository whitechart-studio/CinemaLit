// src/components/layout/StatusBar.tsx
import { Film, Database, Bot } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import styles from './StatusBar.module.css';

const VIEW_TITLES: Record<string, string> = {
  canvas: 'Scene Flow Board',
  script: 'Screenplay Reader',
  breakdown: 'Script Breakdown',
  stripboard: 'Stripboard & Schedule',
  shotlist: 'Shot List',
  budget: 'Budget TopSheet',
  callsheet: 'DGA Call Sheet',
  sql: 'ClickHouse SQL',
};

export function StatusBar() {
  const { activeView, tool, scenes, zoom } = useStudioStore();

  const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);
  const zoomText = `${Math.round(zoom * 100)}%`;

  return (
    <div className={styles.sbar}>
      <div className={styles.si}>
        <Film size={13} color="var(--gold)" />
        <strong>{VIEW_TITLES[activeView] || activeView}</strong>
      </div>
      <span className={styles.ss}>·</span>
      <div className={styles.si}>
        Tool: <strong>{toolName}</strong>
      </div>
      <span className={styles.ss}>·</span>
      <div className={styles.si}>
        Nodes: <strong>{scenes.length}</strong>
      </div>
      <span className={styles.ss}>·</span>
      <div className={styles.si}>
        Zoom: <strong>{zoomText}</strong>
      </div>

      <div className={styles.sr}>
        <div className={styles.si}>
          <Database size={13} color="var(--cyan)" />
          ClickHouse: <strong style={{ color: 'var(--cyan)' }}>3.8ms</strong>
        </div>
        <div className={styles.si}>
          <Bot size={13} color="var(--gold)" />
          Agents: <strong style={{ color: 'var(--gold)' }}>Active</strong>
        </div>
      </div>
    </div>
  );
}
