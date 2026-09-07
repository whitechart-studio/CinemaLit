// src/components/views/StripboardView.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, MoveRight, ChevronLeft, ChevronRight, Users, ListChecks, Palette } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './StripboardView.module.css';

const STRIP_CLASS: Record<string, string> = {
  'INT-NIGHT': styles.sSin,
  'EXT-NIGHT': styles.sSen,
  'EXT-DAY':   styles.sSed,
  'INT-DAY':   styles.sSid,
};

const DOOD_CYCLE = ['SW', 'W', 'H', 'WF', ''];
const MATRIX_SCROLL_STEP = 240;

export function StripboardView() {
  const { scenes, updateScene, openInspector, activeProject } = useStudioStore();

  // Timeline is a single scrubber, 0 (nothing yet) to totalDays (everything) —
  // a price-range-style cutoff, not a per-day picker. Everything on both tabs
  // reads off this one value.
  const [totalDays, setTotalDays] = useState(() => Math.max(activeProject.shootDays || 0, 1));
  const [timelineDay, setTimelineDay] = useState(() => Math.max(activeProject.shootDays || 0, 1));
  const [castFilter, setCastFilter] = useState<'active' | 'all'>('active');
  const matrixScrollRef = useRef<HTMLDivElement>(null);

  // Real cast list, derived from the scenes actually in this project.
  const castList = useMemo(
    () => Array.from(new Set(scenes.flatMap((s) => s.cast))).filter(Boolean),
    [scenes]
  );

  // Manual overrides layered on top of the computed DOOD status — empty
  // until a user clicks a cell, so the table isn't blank on first load.
  const [doodOverrides, setDoodOverrides] = useState<Record<string, Record<number, string>>>({});

  // Re-seed the timeline from the real project/scene data whenever the
  // project changes, so nothing is left pointed at a stale day count.
  useEffect(() => {
    const maxSceneDay = scenes.reduce((m, s) => Math.max(m, s.day || 0), 0);
    const days = Math.max(activeProject.shootDays || 0, maxSceneDay, 1);
    setTotalDays(days);
    setTimelineDay(days);
    setDoodOverrides({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject.id]);

  const handleMoveDay = (sceneId: string, currentDay: number) => {
    const nextDay = currentDay >= totalDays ? 1 : currentDay + 1;
    updateScene(sceneId, { day: nextDay });
  };

  const addShootDay = () => {
    setTotalDays((d) => {
      const next = d + 1;
      setTimelineDay(next);
      return next;
    });
  };

  // DOOD status per character/day, computed from which days that actor's
  // scenes actually fall on — start work / work / hold / work finish —
  // instead of leaving every cell blank until manually toggled.
  const computeDoodStatus = (char: string, day: number): string => {
    const workDays = scenes.filter((s) => s.cast.includes(char)).map((s) => s.day);
    if (workDays.length === 0 || day <= 0) return '';
    const first = Math.min(...workDays);
    const last = Math.max(...workDays);
    if (day < first || day > last) return '';
    if (workDays.includes(day)) return first === last ? 'SW' : day === first ? 'SW' : day === last ? 'WF' : 'W';
    return 'H';
  };

  const doodStatusFor = (char: string, day: number) => doodOverrides[char]?.[day] ?? computeDoodStatus(char, day);

  const toggleDoodStatus = (char: string, day: number) => {
    setDoodOverrides((prev) => {
      const cur = prev[char]?.[day] ?? computeDoodStatus(char, day);
      const idx = DOOD_CYCLE.indexOf(cur);
      const next = DOOD_CYCLE[(idx + 1) % DOOD_CYCLE.length];
      return { ...prev, [char]: { ...prev[char], [day]: next } };
    });
  };

  const daysToRender = Array.from({ length: timelineDay }, (_, i) => i + 1);

  // Toggle: "Active" hides anyone with no tag (---) across the whole
  // Day 1..timeline range; "All" shows the full cast regardless — the
  // per-day tags themselves never change based on this toggle.
  const visibleCast = castFilter === 'all'
    ? castList
    : castList.filter((char) => daysToRender.some((d) => doodStatusFor(char, d) !== ''));

  const tickStep = totalDays <= 15 ? 1 : Math.ceil(totalDays / 10);
  const ticks = Array.from({ length: Math.floor(totalDays / tickStep) + 1 }, (_, i) => i * tickStep).filter((d) => d <= totalDays);
  if (ticks[ticks.length - 1] !== totalDays) ticks.push(totalDays);

  const pct = totalDays === 0 ? 0 : (timelineDay / totalDays) * 100;

  const scrollMatrix = (dir: number) => {
    matrixScrollRef.current?.scrollBy({ left: dir * MATRIX_SCROLL_STEP, behavior: 'smooth' });
  };

  const handleMatrixKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollMatrix(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); scrollMatrix(-1); }
  };

  return (
    <div className={styles.view}>
      {/* TOP BAR — title, add-day, and the timeline scrubber share one row;
          the scene-type legend moves into a hover tooltip to keep it clear. */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <CalendarDays size={16} color="var(--accent)" />
          <span className={styles.title}>Shooting Schedule: {activeProject.name}</span>
          <button className={styles.addDayBtn} onClick={addShootDay}>
            <Plus size={13} /> Add Shoot Day
          </button>
        </div>

        <div className={styles.timelineGroup}>
          <button className={styles.timelineArrow} onClick={() => setTimelineDay((d) => Math.max(0, d - 1))} disabled={timelineDay <= 0}>
            <ChevronLeft size={14} />
          </button>

          <div className={styles.sliderWrap}>
            <div className={styles.sliderBadge} style={{ left: `${pct}%` }}>
              {timelineDay === 0 ? 'Start' : `Day ${timelineDay}`}
            </div>
            <input
              type="range"
              min={0}
              max={totalDays}
              step={1}
              value={timelineDay}
              onChange={(e) => setTimelineDay(Number(e.target.value))}
              className={styles.slider}
              style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--bg-elev) ${pct}%)` }}
            />
            <div className={styles.sliderTicks}>
              {ticks.map((t) => (
                <span key={t} className={styles.sliderTick} style={{ left: totalDays === 0 ? 0 : `${(t / totalDays) * 100}%` }}>{t}</span>
              ))}
            </div>
          </div>

          <button className={styles.timelineArrow} onClick={() => setTimelineDay((d) => Math.min(totalDays, d + 1))} disabled={timelineDay >= totalDays}>
            <ChevronRight size={14} />
          </button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button className={styles.legendBtn} aria-label="Scene type color key">
              <Palette size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            <div className={styles.legend}>
              <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sid-a)' }} />INT Day</div>
              <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sed-a)' }} />EXT Day</div>
              <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sen-a)' }} />EXT Night</div>
              <div className={styles.legItem}><div className={styles.legSquare} style={{ background: 'var(--sin-a)' }} />INT Night</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="schedule" className={styles.tabsRoot}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="schedule" className={styles.tabBtn}>
            <ListChecks size={13} /> Schedule
          </TabsTrigger>
          <TabsTrigger value="matrix" className={styles.tabBtn}>
            <Users size={13} /> Cast Matrix (DOOD)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className={styles.tabBody}>
          {daysToRender.length === 0 && (
            <div className={styles.emptyDayDrop}>Drag the timeline forward to reveal shoot days.</div>
          )}
          {/* GRID — cards fill the row instead of stacking full-width; every
              card in a row stretches to match the tallest one (native grid
              stretch), so the busiest day sets the row height, not itself. */}
          <div className={styles.scheduleGrid}>
            {daysToRender.map((d) => {
              const dayScenes = scenes.filter((s) => s.day === d);
              const dayPageSum = dayScenes.reduce((acc, sc) => acc + (parseFloat(sc.pages) || 0), 0).toFixed(2);
              const dayLocations = Array.from(new Set(dayScenes.map((s) => s.loc))).filter(Boolean);
              return (
                <div key={d} className={styles.dayPanel} style={{ animationDelay: `${Math.min(d, 12) * 0.03}s` }}>
                  <div className={styles.dayHdr}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Day {d} — Shooting Day</div>
                      <div className={styles.daySub}>
                        {dayLocations.length > 0 ? dayLocations.join(' · ') : 'No locations scheduled yet'}
                      </div>
                    </div>
                    <span className={styles.dayPages}>{dayPageSum} pg</span>
                  </div>

                  {dayScenes.map((sc) => {
                    const cls = STRIP_CLASS[`${sc.type}-${sc.timing}`] || styles.sSin;
                    return (
                      <div key={sc.id} className={`${styles.strip} ${cls}`} onClick={() => openInspector(sc.id)}>
                        <div className={styles.stripTop}>
                          <span className={styles.stripNum}>SC. {sc.num}</span>
                          <button
                            className={styles.moveDayBtn}
                            title={`Move scene to Day ${sc.day >= totalDays ? 1 : sc.day + 1}`}
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
                    <div className={styles.emptyDayDrop}>No scenes scheduled for Day {d}</div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className={styles.tabBody}>
          <div className={styles.doodSec}>
            <div className={styles.doodTopRow}>
              <div className={styles.doodLbl}>
                Day Out of Days (DOOD) — Cast Matrix, Day 1–{Math.max(timelineDay, 1)} (click a cell to cycle SW/W/H/WF)
              </div>
              <ToggleGroup
                type="single"
                value={castFilter}
                onValueChange={(v) => v && setCastFilter(v as 'active' | 'all')}
                className={styles.castToggle}
              >
                <ToggleGroupItem value="active" className={styles.castToggleBtn}>Active Only</ToggleGroupItem>
                <ToggleGroupItem value="all" className={styles.castToggleBtn}>All Cast</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {daysToRender.length === 0 ? (
              <div className={styles.emptyDayDrop}>Drag the timeline forward to reveal cast days.</div>
            ) : (
              <div className={styles.doodScrollOuter}>
                <button className={styles.doodArrow} onClick={() => scrollMatrix(-1)} aria-label="Scroll to earlier days">
                  <ChevronLeft size={14} />
                </button>

                <div
                  className={styles.doodScrollInner}
                  ref={matrixScrollRef}
                  tabIndex={0}
                  onKeyDown={handleMatrixKeyDown}
                >
                  {/* Plain table, not the shadcn <Table> — that component wraps
                      itself in its own overflow-auto div, which would create a
                      second, unreachable scroll container instead of this one. */}
                  <table className={styles.doodTbl}>
                    <thead>
                      <tr>
                        <th className={`${styles.doodNameCell} ${styles.doodNameHead}`}>Character / Actor</th>
                        {daysToRender.map((d) => (
                          <th key={d} className={styles.doodDayHead}>Day {d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCast.length === 0 && (
                        <tr>
                          <td colSpan={daysToRender.length + 1} className={styles.doodEmpty}>
                            {castList.length === 0
                              ? 'No cast assigned to any scene yet.'
                              : 'No cast tagged across this range — switch to "All Cast" to see everyone.'}
                          </td>
                        </tr>
                      )}
                      {visibleCast.map((char) => (
                        <tr key={char}>
                          <td className={styles.doodNameCell}>{char}</td>
                          {daysToRender.map((d) => {
                            const st = doodStatusFor(char, d);
                            const cellCls = st === 'SW' ? styles.dSw : st === 'W' ? styles.dW : st === 'H' ? styles.dH : st === 'WF' ? styles.dWf : styles.dBlank;
                            return (
                              <td
                                key={d}
                                className={`${styles.doodCell} ${cellCls}`}
                                onClick={() => toggleDoodStatus(char, d)}
                                title="Click to cycle status: SW -> W -> H -> WF -> (none)"
                              >
                                {st || '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button className={styles.doodArrow} onClick={() => scrollMatrix(1)} aria-label="Scroll to later days">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
