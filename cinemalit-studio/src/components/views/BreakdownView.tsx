// src/components/views/BreakdownView.tsx
import { useMemo, useState } from 'react';
import { Layers, Circle } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from './BreakdownView.module.css';

const STRIP_STYLE: Record<string, { border: string; color: string }> = {
  'INT-NIGHT': { border: 'var(--sin-a)', color: 'var(--sin-a)' },
  'EXT-NIGHT': { border: 'var(--sen-a)', color: 'var(--sen-a)' },
  'EXT-DAY':   { border: 'var(--sed-a)', color: 'var(--sed-a)' },
  'INT-DAY':   { border: 'var(--sid-a)', color: 'var(--sid-a)' },
};

const RISK_COLOR: Record<string, string> = {
  high: 'var(--red)',
  med: 'var(--sed-a)',
  low: 'var(--grn)',
};

const ALL = '__all__';

export function BreakdownView() {
  const { scenes, activeProject } = useStudioStore();
  const [sceneFilter, setSceneFilter] = useState(ALL);
  const [dayFilter, setDayFilter] = useState(ALL);

  const days = useMemo(
    () => Array.from(new Set(scenes.map((sc) => sc.day))).sort((a, b) => a - b),
    [scenes]
  );

  const filteredScenes = useMemo(
    () => scenes.filter((sc) => {
      if (sceneFilter !== ALL && sc.id !== sceneFilter) return false;
      if (dayFilter !== ALL && String(sc.day) !== dayFilter) return false;
      return true;
    }),
    [scenes, sceneFilter, dayFilter]
  );

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <Layers size={16} color="var(--accent)" />
        <span className={styles.title}>Script Breakdown — {activeProject.name}</span>
        <span className={styles.subtitle}>{scenes.length} scenes · AI-analyzed</span>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Scene</span>
          <Select value={sceneFilter} onValueChange={setSceneFilter}>
            <SelectTrigger className={`${styles.filterSelect} w-[220px]`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Scenes</SelectItem>
              {scenes.map((sc, i) => (
                <SelectItem key={sc.id} value={sc.id}>
                  SC.{sc.num || i + 1} — {sc.loc || 'Untitled location'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Shoot Day</span>
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className={`${styles.filterSelect} w-[160px]`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Days</SelectItem>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(sceneFilter !== ALL || dayFilter !== ALL) && (
          <button
            className={styles.clearBtn}
            onClick={() => { setSceneFilter(ALL); setDayFilter(ALL); }}
          >
            Clear filters
          </button>
        )}

        <span className={styles.filterCount}>{filteredScenes.length} shown</span>
      </div>

      <div className={styles.body}>
        {scenes.length === 0 && (
          <div className={styles.empty}>
            No scenes yet — import a script from the Screenplay tab or wait
            for the Director Agent to finish the ingest.
          </div>
        )}
        {scenes.length > 0 && filteredScenes.length === 0 && (
          <div className={styles.empty}>No scenes match the current filters.</div>
        )}
        {filteredScenes.map((sc, i) => {
          const key = `${sc.type}-${sc.timing}`;
          const st = STRIP_STYLE[key] || STRIP_STYLE['INT-NIGHT'];
          const riskColor = RISK_COLOR[sc.risk] || RISK_COLOR.low;
          const elementCount = sc.cast.length + sc.props.length + sc.vfx.length + sc.ward.length + sc.sfx.length;
          // A scene ingested with no slugline metadata at all (num/type/timing/
          // loc every one blank) is a data problem upstream, not "no elements
          // extracted" — flag it distinctly instead of rendering an
          // near-invisible blank header that reads as a stray line.
          const noMetadata = !sc.num && !sc.type && !sc.timing && !sc.loc;

          return (
            <div key={sc.id} className={styles.card} style={{ borderLeft: `3px solid ${st.border}` }}>
              <div className={styles.cardHeader}>
                <span className={styles.sceneType} style={{ color: st.color }}>
                  SC.{sc.num || i + 1} · {sc.type || '—'}/{sc.timing || '—'}
                </span>
                <span className={styles.cardTitle}>{sc.loc || 'Untitled location'}</span>
                <span className={styles.dayTag}>Day {sc.day}</span>
                <span className={styles.pgCount}>{sc.pages || '0.00'} pg</span>
              </div>

              {noMetadata && (
                <div className={styles.cardWarning}>
                  This scene came back from the database with no location/type/
                  timing metadata — likely an ingestion issue for this script,
                  not a rendering bug.
                </div>
              )}

              {elementCount === 0 ? (
                <div className={styles.cardNoElems}>
                  No breakdown elements extracted for this scene yet — cast, props,
                  wardrobe, VFX and SFX all come back empty from the script analysis.
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  <div>
                    <div className={styles.catLabel}>Cast</div>
                    {sc.cast.length > 0 ? (
                      sc.cast.map((c) => <span key={c} className={styles.tag}>{c}</span>)
                    ) : (
                      <span className={styles.none}>None</span>
                    )}
                  </div>

                  <div>
                    <div className={styles.catLabel}>Props</div>
                    {sc.props.length > 0 ? (
                      sc.props.map((p) => <span key={p} className={styles.tag}>{p}</span>)
                    ) : (
                      <span className={styles.none}>None</span>
                    )}
                  </div>

                  <div>
                    <div className={styles.catLabel}>VFX / Lighting</div>
                    {sc.vfx.length > 0 ? (
                      sc.vfx.map((v) => <span key={v} className={styles.tag}>{v}</span>)
                    ) : (
                      <span className={styles.none}>None</span>
                    )}
                  </div>

                  <div>
                    <div className={styles.catLabel}>Wardrobe</div>
                    {sc.ward.length > 0 ? (
                      sc.ward.map((w) => <span key={w} className={styles.tag}>{w}</span>)
                    ) : (
                      <span className={styles.none}>None</span>
                    )}
                  </div>

                  <div>
                    <div className={styles.catLabel}>SFX / Sound</div>
                    {sc.sfx.length > 0 ? (
                      sc.sfx.map((s) => <span key={s} className={styles.tag}>{s}</span>)
                    ) : (
                      <span className={styles.none}>None</span>
                    )}
                  </div>

                  <div>
                    <div className={styles.catLabel}>Risk Level</div>
                    <span className={styles.tag} style={{ color: riskColor }}>
                      <Circle size={8} fill={riskColor} color={riskColor} />
                      {sc.riskNote}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
