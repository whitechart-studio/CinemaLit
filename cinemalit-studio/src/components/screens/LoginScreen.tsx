// src/components/screens/LoginScreen.tsx — Full Page Login & Registration Page
import { useState } from 'react';
import { Clapperboard, LogIn, UserPlus, Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'producer.google@cinemalit.studio',
          name: 'Executive Producer',
          picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=google_prod',
        }),
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
            <div className={styles.badge}><Sparkles size={13} color="var(--gold)" /> Agentic Cinema Command Center</div>
            <h1 className={styles.heroTitle}>AI-Powered Film Pre-Production &amp; Storyboarding</h1>
            <p className={styles.heroSub}>
              Connect your screenplays directly to ClickHouse DB pipelines, generate shot lists, estimate scene pacing, and auto-produce AI storyboards.
            </p>
          </div>

          <div className={styles.heroFooter}>
            <span>ClickHouse Track · Agentic Cinema Hackathon</span>
          </div>
        </div>

        {/* RIGHT AUTH FORM PANEL */}
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <div className={styles.tabToggle}>
              <button
                className={`${styles.tabBtn} ${tab === 'login' ? styles.activeTab : ''}`}
                onClick={() => { setTab('login'); setError(null); }}
              >
                <LogIn size={14} /> Sign In
              </button>
              <button
                className={`${styles.tabBtn} ${tab === 'register' ? styles.activeTab : ''}`}
                onClick={() => { setTab('register'); setError(null); }}
              >
                <UserPlus size={14} /> Register Account
              </button>
            </div>

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
                    <select value={role} onChange={(e) => setRole(e.target.value)} className={styles.select}>
                      <option value="Director">Director</option>
                      <option value="Executive Producer">Executive Producer</option>
                      <option value="1st AD / Line Producer">1st AD / Line Producer</option>
                      <option value="Cinematographer (DP)">Cinematographer (DP)</option>
                      <option value="VFX Supervisor">VFX Supervisor</option>
                    </select>
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

            <button className={styles.googleBtn} onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              <span>Sign in with Google Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
