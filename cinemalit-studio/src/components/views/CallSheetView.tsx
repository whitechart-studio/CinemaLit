// src/components/views/CallSheetView.tsx
import { Printer } from 'lucide-react';
import { castCallEntries } from '../../data/sampleData';
import styles from './CallSheetView.module.css';

export function CallSheetView() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.view}>
      <div className={styles.doc}>
        <div className={styles.banner}>
          <div>
            <div className={styles.prodTitle}>NEON ECHOES — Official Call Sheet</div>
            <div className={styles.dayInfo}>Shoot Day 1 of 2 · Monday, August 4, 2026</div>
          </div>
          <div style={{ textAlign: 'right' }}>
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
            <div><div className={styles.fLabel}>Crew Call</div><div className={styles.fVal} style={{ color: 'var(--gold)' }}>06:30 AM</div></div>
            <div><div className={styles.fLabel}>First Shot</div><div className={styles.fVal}>08:00 AM</div></div>
            <div><div className={styles.fLabel}>Set Address</div><div className={styles.fVal}>9 Dock Street, Warehouse District</div></div>
            <div><div className={styles.fLabel}>Nearest Hospital</div><div className={styles.fVal} style={{ color: 'var(--red)' }}>City General ER — 0.8 mi · (555) 019-2831</div></div>
            <div><div className={styles.fLabel}>Weather</div><div className={styles.fVal}>🌧 58°F, Rain (use practical for Sc.2!)</div></div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>Cast Call Times</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Character</th>
                <th>Actor</th>
                <th>Makeup</th>
                <th>Wardrobe</th>
                <th>Set Call</th>
                <th>Scenes</th>
              </tr>
            </thead>
            <tbody>
              {castCallEntries.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{c.character}</td>
                  <td>{c.actor}</td>
                  <td>{c.makeup}</td>
                  <td>{c.wardrobe}</td>
                  <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{c.setCall}</td>
                  <td>{c.scenes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.sec} style={{ borderBottom: 'none' }}>
          <div className={styles.secTitle}>Today's Scenes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ background: 'var(--sin)', borderLeft: '3px solid var(--sin-a)', borderRadius: '5px', padding: '7px 11px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--sin-a)' }}>SC.1 — INT. NEON COFFEE SHOP — NIGHT</div>
              <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: '2px' }}>0.31 pages · Maya, Kai · ⚠ Prop Gun on set</div>
            </div>
            <div style={{ background: 'var(--sen)', borderLeft: '3px solid var(--sen-a)', borderRadius: '5px', padding: '7px 11px' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--sen-a)' }}>SC.2 — EXT. DINER ALLEYWAY — NIGHT</div>
              <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: '2px' }}>0.25 pages · Maya, Kai, Agents ×4 · ⚠ Rain Machine + Stunt Coord.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
