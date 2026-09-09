// src/components/views/CallSheetView.tsx
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import styles from './CallSheetView.module.css';

const SLOT_COLORS = ['var(--sin)', 'var(--sen)'];
const SLOT_ACCENTS = ['var(--sin-a)', 'var(--sen-a)'];

export function CallSheetView() {
  const { scenes, activeProject } = useStudioStore();
  const shootDays = Array.from(new Set(scenes.map((s) => s.day))).sort((a, b) => a - b);
  const [day, setDay] = useState(shootDays[0] ?? 1);

  const dayScenes = scenes.filter((s) => s.day === day);
  // One row per character actually called that day, earliest scene first.
  const cast = Array.from(new Set(dayScenes.flatMap((s) => s.cast))).filter(Boolean);
  const totalPages = dayScenes.reduce((sum, s) => sum + parseFloat(s.pages || '0'), 0);
  const hazards = Array.from(
    new Set(dayScenes.flatMap((s) => [...s.sfx, ...s.vfx]))
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.view}>
      <div className={styles.doc}>
        <div className={styles.banner}>
          <div>
            <div className={styles.prodTitle}>
              {activeProject.name.toUpperCase()} — Official Call Sheet
            </div>
            <div className={styles.dayInfo}>
              Shoot Day {day} of {shootDays.length || 1} · {dayScenes.length} scenes ·{' '}
              {totalPages.toFixed(2)} pages
              {shootDays.length > 1 && (
                <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                  <SelectTrigger size="sm" className={styles.daySelect}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shootDays.map((d) => (
                      <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className={styles.bannerRight}>
            <div className={styles.rev}>Rev. 3 · Issued 17:00</div>
            <button className={styles.printBtn} onClick={handlePrint}>
              <Printer size={13} />Print
            </button>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>General Production Info</div>
          <div className={styles.grid}>
            <div><div className={styles.fLabel}>Production Co.</div><div className={styles.fVal}>CinemaLit Pictures</div></div>
            <div><div className={styles.fLabel}>Director</div><div className={styles.fVal}>A. Kubrick</div></div>
            <div><div className={styles.fLabel}>1st AD</div><div className={styles.fVal}>M. DePalma</div></div>
            <div><div className={styles.fLabel}>DP / Camera</div><div className={styles.fVal}>J. Deakins</div></div>
            <div><div className={styles.fLabel}>Crew Call</div><div className={`${styles.fVal} ${styles.accentVal}`}>06:30 AM</div></div>
            <div><div className={styles.fLabel}>First Shot</div><div className={styles.fVal}>08:00 AM</div></div>
            <div><div className={styles.fLabel}>Locations</div><div className={styles.fVal}>{Array.from(new Set(dayScenes.map((s) => s.loc))).join(' · ') || '—'}</div></div>
            <div><div className={styles.fLabel}>Nearest Hospital</div><div className={`${styles.fVal} ${styles.dangerVal}`}>City General ER — 0.8 mi · (555) 019-2831</div></div>
            <div><div className={styles.fLabel}>Effects On Set</div><div className={styles.fVal} style={{ color: hazards.length ? 'var(--red)' : undefined }}>{hazards.join(', ') || 'None flagged'}</div></div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>Cast Call Times</div>
          <Table className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHead>Character</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Makeup</TableHead>
                <TableHead>Wardrobe</TableHead>
                <TableHead>Set Call</TableHead>
                <TableHead>Scenes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cast.length === 0 && (
                <TableRow><TableCell colSpan={6} className={styles.emptyNote}>No cast scheduled for this day yet.</TableCell></TableRow>
              )}
              {cast.map((character, i) => {
                const inScenes = dayScenes.filter((sc) => sc.cast.includes(character));
                return (
                  <TableRow key={character}>
                    <TableCell className={styles.castNameCell}>{character}</TableCell>
                    <TableCell>TBC</TableCell>
                    <TableCell>{`0${5 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`}</TableCell>
                    <TableCell>{`0${6 + Math.floor(i / 2)}:${i % 2 ? '00' : '30'}`}</TableCell>
                    <TableCell className={styles.accentVal}>07:00</TableCell>
                    <TableCell>{inScenes.map((sc) => sc.num).join(', ')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className={`${styles.sec} ${styles.secNoBorder}`}>
          <div className={styles.secTitle}>Today's Scenes</div>
          <div className={styles.scenesList}>
            {dayScenes.length === 0 && (
              <div className={styles.emptyNote}>
                No scenes scheduled for day {day}.
              </div>
            )}
            {dayScenes.map((sc, i) => (
              <div
                key={sc.id}
                className={styles.sceneRow}
                style={{
                  background: SLOT_COLORS[i % SLOT_COLORS.length],
                  borderLeft: `3px solid ${SLOT_ACCENTS[i % SLOT_ACCENTS.length]}`,
                }}
              >
                <div className={styles.sceneRowLabel} style={{ color: SLOT_ACCENTS[i % SLOT_ACCENTS.length] }}>
                  SC.{sc.num} — {sc.slug}
                </div>
                <div className={styles.sceneRowMeta}>
                  {sc.pages} pages · {sc.cast.join(', ') || 'No cast'}
                  {sc.risk !== 'low' && ` · ⚠ ${sc.riskNote}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
