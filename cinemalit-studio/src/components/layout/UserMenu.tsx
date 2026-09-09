// src/components/layout/UserMenu.tsx
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import styles from './UserMenu.module.css';

/** Avatar + name trigger that opens a Profile / Settings / Sign Out menu —
 *  the one place this app's account controls live, used by both the Studio
 *  Hub top bar and the in-workbench TopBar so there's a single reachable
 *  path to the profile page instead of two divergent hand-rolled ones. */
export function UserMenu() {
  const { user, logout, setScreen, setHomeSection } = useStudioStore();
  if (!user) return null;

  const goTo = (section: 'profile' | 'settings') => {
    setScreen('home');
    setHomeSection(section);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={styles.trigger} title={`${user.name} — ${user.role}`}>
          <img src={user.avatar} alt={user.name} className={styles.avatar} />
          <span className={styles.name}>{user.name}</span>
          <ChevronDown size={13} className={styles.chevron} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => goTo('profile')}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goTo('settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => { logout(); setScreen('login'); }}>
          <LogOut /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
