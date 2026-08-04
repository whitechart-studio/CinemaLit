// src/components/views/BreakdownView.tsx
import { Layers } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import styles from './BreakdownView.module.css';

const STRIP_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  'INT-NIGHT': { bg: 'var(--sin)', border: 'var(--sin-a)', color: 'var(--sin-a)' },
  'EXT-NIGHT': { bg: 'var(--sen)', border: 'var(--sen-a)', color: 'var(--sen-a)' },
  'EXT-DAY':   { bg: 'var(--sed)', border: 'var(--sed-a)', color: 'var(--sed-a)' },
  'INT-DAY':   { bg: 'var(--sid)', border: 'var(--sid-a)', color: 'var(--sid-a)' },
};

export function BreakdownView() {
  const { scenes } = useStudioStore();

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <Layers size={16} color="var(--gold)" />
        <span className={styles.title}>Script Breakdown — Neon Echoes</span>
        <span className={styles.subtitle}>{scenes.length} scenes · AI-analyzed</span>
      </div>

      <div className={styles.body}>
        {scenes.map((sc) => {
          const key = `${sc.type}-${sc.timing}`;
          const st = STRIP_STYLE[key] || STRIP_STYLE['INT-NIGHT'];

          return (
            <div key={sc.id} className={styles.card}>
              <div className={styles.cardHeader} style={{ background: st.bg, borderLeft: `3px solid ${st.border}` }}>
                <span className={styles.sceneType} style={{ color: st.color }}>
                  SC.{sc.num} · {sc.type}/{sc.timing}
                </span>
                <span className={styles.cardTitle}>{sc.loc}</span>
                <span className={styles.pgCount}>{sc.pages} pg</span>
              </div>

              <div className={styles.cardGrid}>
                <div>
                  <div className={styles.catLabel}>Cast</div>
                  {sc.cast.map((c) => (
                    <span key={c} className={`${styles.tag} ${styles.etCast}`}>{c}</span>
                  ))}
                </div>

                <div>
                  <div className={styles.catLabel}>Props</div>
                  {sc.props.length > 0 ? (
                    sc.props.map((p) => (
                      <span key={p} className={`${styles.tag} ${styles.etProp}`}>{p}</span>
                    ))
                  ) : (
                    <span className={styles.none}>None</span>
                  )}
                </div>

                <div>
                  <div className={styles.catLabel}>VFX / Lighting</div>
                  {sc.vfx.length > 0 ? (
                    sc.vfx.map((v) => (
                      <span key={v} className={`${styles.tag} ${styles.etVfx}`}>{v}</span>
                    ))
                  ) : (
                    <span className={styles.none}>None</span>
                  )}
                </div>

                <div>
                  <div className={styles.catLabel}>Wardrobe</div>
                  {sc.ward.length > 0 ? (
                    sc.ward.map((w) => (
                      <span key={w} className={`${styles.tag} ${styles.etWard}`}>{w}</span>
                    ))
                  ) : (
                    <span className={styles.none}>None</span>
                  )}
                </div>

                <div>
                  <div className={styles.catLabel}>SFX / Sound</div>
                  {sc.sfx.length > 0 ? (
                    sc.sfx.map((s) => (
                      <span key={s} className={`${styles.tag} ${styles.etSfx}`}>{s}</span>
                    ))
                  ) : (
                    <span className={styles.none}>None</span>
                  )}
                </div>

                <div>
                  <div className={styles.catLabel}>Risk Level</div>
                  <span className={`${styles.tag} ${styles.etSfx}`}>
                    {sc.risk === 'high' ? '🔴 ' : '🟢 '}{sc.riskNote}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
