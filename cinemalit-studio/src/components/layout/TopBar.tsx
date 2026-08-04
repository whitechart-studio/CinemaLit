import { useState } from 'react';
import { Download, Search, Bell, Settings, Clapperboard, Film, Home, UserCheck } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { AuthModal } from '../modals/AuthModal';
import styles from './TopBar.module.css';

interface Props {
  onExport: () => void;
}

export function TopBar({ onExport }: Props) {
  const { setScreen, activeProject, user } = useStudioStore();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.brand} onClick={() => setScreen('home')} style={{ cursor: 'pointer' }} title="Return to Studio Hub">
          <div className={styles.brandMark}><Clapperboard size={18} /></div>
          <span className={styles.brandName}>Cinema<span>Lit</span></span>
        </div>

        <div className={styles.center}>
          <div className={styles.projPill} onClick={() => setScreen('home')} title="Switch Project in Studio Hub">
            <Film size={13} color="var(--gold)" />
            <span className={styles.projName}>{activeProject.name}</span>
            <span className={styles.projPhase}>{activeProject.phase}</span>
          </div>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipG}`}><span className={styles.dot} />ClickHouse</span>
            <span className={`${styles.chip} ${styles.chipC}`}><span className={styles.dot} />JWT Auth Active</span>
            <span className={`${styles.chip} ${styles.chipA}`}><span className={styles.dot} />{user ? user.role : 'Guest Mode'}</span>
          </div>
        </div>

        <div className={styles.right}>
          <button className={styles.iconBtn} title="Studio Hub" onClick={() => setScreen('home')}><Home size={15} /></button>
          <button className={styles.iconBtn} title="Search"><Search size={15} /></button>
          <button className={styles.iconBtn} title="Notifications"><Bell size={15} /></button>
          <button className={styles.iconBtn} title="Settings"><Settings size={15} /></button>
          <button className={styles.primaryBtn} onClick={onExport}>
            <Download size={13} />Greenlight Binder
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={user.avatar} alt={user.name} className={styles.userAvatar} title={`${user.name} (${user.role})`} />
              <span className={styles.userPillName}>{user.name}</span>
            </div>
          ) : (
            <button
              className={styles.loginPillBtn}
              onClick={() => setScreen('login')}
              title="Go to Studio Login Page"
            >
              <UserCheck size={13} color="var(--gold)" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
