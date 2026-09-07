// src/components/screens/LoginScreen.tsx — Full Page Login & Registration Page
import { useState } from 'react';
import { Clapperboard, LogIn, UserPlus, Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const { setAuth, setScreen } = useStudioStore();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Director');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = tab === 'register' ? { email, password, name, role } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.status === 'ok') {
        setAuth(data.user, data.token);
        setScreen('home');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('Server connection error. Please verify backend service.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();

      if (data.status === 'ok') {
        setAuth(data.user, data.token);
        setScreen('home');
      } else {
        setError(data.error || 'Google login failed');
      }
    } catch {
      setError('Google auth connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        {/* LEFT PROMO HERO PANEL */}
        <div className={styles.heroPanel}>
          <div className={styles.heroBrand}>
            <div className={styles.brandMark}><Clapperboard size={22} /></div>
            <span className={styles.brandName}>Cinema<span>Lit</span> Studio</span>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.badge}><Sparkles size={13} color="var(--accent)" /> Agentic Cinema Command Center</div>
            <h1 className={styles.heroTitle}>AI-Powered Film Pre-Production &amp; Storyboarding</h1>
            <p className={styles.heroSub}>
              Connect your screenplays directly to ClickHouse DB pipelines, generate shot lists, estimate scene pacing, and auto-produce AI storyboards.
            </p>
          </div>
        </div>

        {/* RIGHT AUTH FORM PANEL */}
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <Tabs
              value={tab}
              onValueChange={(v) => { setTab(v as 'login' | 'register'); setError(null); }}
              className={styles.tabToggle}
            >
              <TabsList className="h-auto w-full justify-stretch rounded-none bg-transparent p-0">
                <TabsTrigger value="login" className={`${styles.tabBtn} ${tab === 'login' ? styles.activeTab : ''} flex-1`}>
                  <LogIn size={14} /> Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className={`${styles.tabBtn} ${tab === 'register' ? styles.activeTab : ''} flex-1`}>
                  <UserPlus size={14} /> Register Account
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {error && <div className={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              {tab === 'register' && (
                <>
                  <div className={styles.field}>
                    <label><User size={13} /> Full Name / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Christopher Nolan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label>Production Role</label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className={`${styles.select} w-full`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Executive Producer">Executive Producer</SelectItem>
                        <SelectItem value="1st AD / Line Producer">1st AD / Line Producer</SelectItem>
                        <SelectItem value="Cinematographer (DP)">Cinematographer (DP)</SelectItem>
                        <SelectItem value="VFX Supervisor">VFX Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className={styles.field}>
                <label><Mail size={13} /> Studio Email</label>
                <input
                  type="email"
                  placeholder="producer@hollywood.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label><Lock size={13} /> Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                <span>{loading ? 'Authenticating…' : tab === 'login' ? 'Sign In to Command Center' : 'Create Studio Account'}</span>
                <ArrowRight size={15} />
              </button>
            </form>

            <div className={styles.divider}>
              <span>OR CONTINUE WITH</span>
            </div>

            <GoogleSignInButton onCredential={handleGoogleCredential} />
          </div>
        </div>
      </div>
    </div>
  );
}
