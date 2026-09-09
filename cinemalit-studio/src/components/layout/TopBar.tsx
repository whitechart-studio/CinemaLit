import { Clapperboard, Home, UserCheck } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { UserMenu } from './UserMenu';
import styles from './TopBar.module.css';

export function TopBar() {
  const { setScreen, projects, activeProject, setActiveProject, user } = useStudioStore();

  return (
    <header className={styles.topbar}>
        <div className={styles.brand} onClick={() => setScreen('home')} style={{ cursor: 'pointer' }} title="Return to Studio Hub">
          <div className={styles.brandMark}><Clapperboard size={18} /></div>
          <span className={styles.brandName}>Cinema<span>Lit</span></span>
        </div>

        <div className={styles.center}>
          <Select
            value={activeProject.id}
            onValueChange={(id) => {
              const p = projects.find((pr) => pr.id === id);
              if (p) setActiveProject(p);
            }}
          >
            <SelectTrigger className={styles.projTrigger} title="Switch project">
              <span className={styles.projName}>{activeProject.name}</span>
              <span className={styles.projPhase}>{activeProject.phase}</span>
            </SelectTrigger>
            <SelectContent align="center">
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} <span className={styles.projOptPhase}>· {p.phase}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.right}>
          <button className={styles.iconBtn} title="Studio Hub" onClick={() => setScreen('home')}><Home size={15} /></button>

          {user ? (
            <UserMenu />
          ) : (
            <button
              className={styles.loginPillBtn}
              onClick={() => setScreen('login')}
              title="Go to Studio Login Page"
            >
              <UserCheck size={13} color="var(--accent)" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>
  );
}
