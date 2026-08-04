// src/components/views/StripboardView.tsx
import { useState } from 'react';
import { CalendarDays, Plus, MoveRight } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import styles from './StripboardView.module.css';

const STRIP_CLASS: Record<string, string> = {
  'INT-NIGHT': styles.sSin,
  'EXT-NIGHT': styles.sSen,
  'EXT-DAY':   styles.sSed,
  'INT-DAY':   styles.sSid,
};

export function StripboardView() {
  const { scenes, updateScene, openInspector, activeProject } = useStudioStore();
  const [totalDays, setTotalDays] = useState(2);

  const [doodState, setDoodState] = useState<Record<string, Record<number, string>>>({
    'Maya / A. Portman': { 1: 'SW', 2: 'WF' },
    'Kai / C. Bale': { 1: 'SW', 2: 'WF' },
    'Agents ×4 / Day Players': { 1: 'W', 2: '—' },
  });

  const handleMoveDay = (sceneId: string, currentDay: number) => {
    const nextDay = currentDay >= totalDays ? 1 : currentDay + 1;
    updateScene(sceneId, { day: nextDay });
  };

  const addShootDay = () => {
    setTotalDays((d) => d + 1);
  };

  const toggleDoodStatus = (char: string, day: number) => {
    const statuses = ['SW', 'W', 'H', 'WF', '—'];
    setDoodState((prev) => {
      const cur = prev[char]?.[day] || '—';
      const idx = statuses.indexOf(cur);
      const next = statuses[(idx + 1) % statuses.length];
      return {
        ...prev,
        [char]: { ...prev[char], [day]: next },
      };
    });
  };

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <CalendarDays size={16} color="var(--gold)" />
        <span className={styles.title}>{totalDays}-Day Shooting Schedule — {activeProject.name}</span>

        <button className={styles.addDayBtn} onClick={addShootDay}>
          <Plus size={13} /> Add Shoot Day
        </button>

        <div className={styles.legend}>
          <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sid-a)' }} />INT Day</div>
          <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sed-a)' }} />EXT Day</div>
          <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sen-a)' }} />EXT Night</div>
          <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sin-a)' }} />INT Night</div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          {daysArray.map((dayNum) => {
            const dayScenes = scenes.filter((s) => s.day === dayNum);
            const totalPageSum = dayScenes.reduce((acc, sc) => acc + (parseFloat(sc.pages) || 0), 0).toFixed(2);

            return (
              <div key={dayNum} className={styles.dayCol}>
                <div className={styles.dayHdr}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Day {dayNum} — Shooting Day</div>
                    <div className={styles.daySub}>
                      {dayNum === 1 ? 'Aug 4 · Call: 06:30 · Dock District' : dayNum === 2 ? 'Aug 5 · Call: 07:00 · Studio Lot' : 'Aug 6 · Call: 07:30 · Location B'}
                    </div>
                  </div>
                  <span className={styles.dayPages}>{totalPageSum} pg</span>
                </div>

                {dayScenes.map((sc) => {
                  const cls = STRIP_CLASS[`${sc.type}-${sc.timing}`] || styles.sSin;
                  return (
                    <div
                      key={sc.id}
                      className={`${styles.strip} ${cls}`}
                      onClick={() => openInspector(sc.id)}
                    >
                      <div className={styles.stripTop}>
                        <span className={styles.stripNum}>SC. {sc.num}</span>
                        <button
                          className={styles.moveDayBtn}
                          title={`Move scene to Day ${dayNum >= totalDays ? 1 : dayNum + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveDay(sc.id, sc.day);
                          }}
                        >
                          Move Day <MoveRight size={11} />
                        </button>
                      </div>
                      <div className={styles.stripLoc}>{sc.loc}</div>
                      <div className={styles.stripMeta}>
                        <span>{sc.type}/{sc.timing}</span>
                        <span>·</span>
                        <span>{sc.pages} pg</span>
                        <span>·</span>
                        <span>{sc.cast.join(', ')}</span>
                      </div>
                    </div>
                  );
                })}

                {dayScenes.length === 0 && (
                  <div className={styles.emptyDayDrop}>
                    No scenes scheduled for Day {dayNum}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DOOD Matrix */}
        <div className={styles.doodSec}>
          <div className={styles.doodLbl}>Day Out of Days (DOOD) — Cast Matrix (Click cell to cycle SW/W/H/WF)</div>
          <table className={styles.doodTbl}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Character / Actor</th>
                {daysArray.map((d) => (
                  <th key={d}>Day {d}</th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(doodState).map((char) => (
                <tr key={char}>
                  <td style={{ textAlign: 'left', color: 'var(--t1)', fontWeight: 700 }}>{char}</td>
                  {daysArray.map((d) => {
                    const st = doodState[char]?.[d] || '—';
                    const cellCls = st === 'SW' ? styles.dSw : st === 'W' ? styles.dW : st === 'H' ? styles.dH : st === 'WF' ? styles.dWf : '';
                    return (
                      <td
                        key={d}
                        className={`${styles.doodCell} ${cellCls}`}
                        onClick={() => toggleDoodStatus(char, d)}
                        title="Click to cycle status: SW -> W -> H -> WF -> —"
                      >
                        {st}
                      </td>
                    );
                  })}
                  <td style={{ color: 'var(--t2)' }}>Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
