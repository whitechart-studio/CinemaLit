// src/components/canvas/ConnectorLayer.tsx
import { useStudioStore } from '../../store/studio';

const NODE_W = 220;
const NODE_H = 148;

export function ConnectorLayer() {
  const { scenes, connections, selectedSceneId } = useStudioStore();

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: 'none',
      }}
    >
      <defs>
        <marker id="ah-gold" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#F59E0B" opacity=".85" />
        </marker>
        <marker id="ah-def" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="rgba(255,255,255,.18)" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const from = scenes.find((s) => s.id === conn.from);
        const to   = scenes.find((s) => s.id === conn.to);
        if (!from || !to) return null;

        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        const d  = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

        const isSelected = conn.from === selectedSceneId || conn.to === selectedSceneId;

        return (
          <path
            key={conn.id}
            d={d}
            stroke={isSelected ? '#F59E0B' : 'rgba(255,255,255,.16)'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            fill="none"
            markerEnd={isSelected ? 'url(#ah-gold)' : 'url(#ah-def)'}
          />
        );
      })}
    </svg>
  );
}
