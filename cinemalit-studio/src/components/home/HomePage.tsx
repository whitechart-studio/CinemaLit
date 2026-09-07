// src/components/home/HomePage.tsx
import { useState } from 'react';
import {
  Clapperboard, Plus, Film, Sparkles, Database, Layers,
  CalendarDays, ArrowRight, FolderKanban,
  Bot, Settings, Search, Play, FileText, Home,
  DollarSign, Shield, LogOut, LogIn, UserCheck,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HomeSection } from '../../types';
import styles from './HomePage.module.css';

/** Static AI Director Crew roster — kept in sync with the selectable agents
 *  in NewProjectWizard.tsx (same 4 names/descriptions, presented read-only). */
const AGENT_ROSTER = [
  {
    name: 'Director Agent',
    role: 'Scene breakdown & creative vision',
    desc: 'Parses screenplay Fountain files into scene node graphs, extracts cast, props, wardrobe, VFX, and generates creative shot ideas.',
    icon: <Bot size={22} color="var(--accent)" />,
  },
  {
    name: 'AD Scheduling Agent',
    role: 'Stripboard & DOOD optimization',
    desc: 'Calculates optimal day breaks, minimizes company moves, generates DGA Call Sheets, and manages DOOD cast availability matrices.',
    icon: <CalendarDays size={22} color="var(--cyan)" />,
  },
  {
    name: 'Budget Controller Agent',
    role: 'Real-time cost tracking & variance flags',
    desc: 'Tracks below-the-line cost estimates vs target caps. Triggers automated overage alerts and cost-reduction alternatives.',
    icon: <DollarSign size={22} color="var(--grn)" />,
  },
  {
    name: 'Stunt & Safety Agent',
    role: 'Risk assessment & weapon armorer notes',
    desc: 'Scans breakdown items for prop weapons, pyrotechnics, water work, and stunt sequences to enforce licensed armorer & permit safety rules.',
    icon: <Shield size={22} color="var(--red)" />,
  },
];

export function HomePage() {
  const {
    projects, setActiveProject, openWizard, setScreen, user, logout,
    homeSection, setHomeSection, settings, updateSettings,
  } = useStudioStore();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'development'>('all');
  const [search, setSearch] = useState('');

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const developmentCount = projects.filter((p) => p.status === 'development').length;

  const filteredProjects = projects
    .filter((p) => {
      if (activeTab === 'active') return p.status === 'active';
      if (activeTab === 'development') return p.status === 'development';
      return true;
    })
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.genre.toLowerCase().includes(q);
    });

  const templates = [
    { title: '2-Day Indie Short', format: 'Short Film', genre: 'Sci-Fi / Drama', budget: '$5,000', days: 2, icon: <Film size={18} color="var(--accent)" /> },
    { title: 'Action Pilot Episode', format: 'TV Pilot', genre: 'Action Thriller', budget: '$50,000', days: 5, icon: <Sparkles size={18} color="var(--cyan)" /> },
    { title: 'Feature Script Breakdown', format: 'Feature Film', genre: 'Drama', budget: '$250,000', days: 20, icon: <Layers size={18} color="var(--pur)" /> },
    { title: 'Commercial Shoot', format: 'Commercial', genre: 'Brand Film', budget: '$15,000', days: 1, icon: <CalendarDays size={18} color="var(--grn)" /> },
  ];

  const NAV_ITEMS: { id: HomeSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'hub', label: 'Studio Hub', icon: <Home size={15} className={styles.navIcon} /> },
    { id: 'projects', label: 'Film Projects', icon: <FolderKanban size={15} className={styles.navIcon} />, badge: projects.length },
    { id: 'agents', label: 'AI Agent Crew', icon: <Bot size={15} className={styles.navIcon} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={15} className={styles.navIcon} /> },
  ];

  return (
    <div className={styles.container}>
      {/* LEFT HOME SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}><Clapperboard size={18} /></div>
          <span className={styles.brandName}>Cinema<span>Lit</span></span>
        </div>

        <button className={styles.createBtn} onClick={openWizard}>
          <Plus size={16} /> New Project
        </button>

        <div className={styles.navSection}>
          <div className={styles.sectionLabel}>Studio Menu</div>

          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`${styles.navItem} ${homeSection === item.id ? styles.activeNav : ''}`}
              onClick={() => setHomeSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && <span className={styles.badge}>{item.badge}</span>}
            </div>
          ))}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className={styles.sidebarFooter}>
          <div className={styles.connChip}>
            <span className={styles.greenDot} /> ClickHouse Cloud: Connected
          </div>
          {user ? (
            <div className={styles.userProfile}>
              <img src={user.avatar} alt={user.name} className={styles.avatarImg} />
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userRole}>{user.role}</div>
              </div>
              <button
                className={styles.sidebarSignOutBtn}
                title="Sign Out"
                onClick={() => {
                  logout();
                  setScreen('login');
                }}
              >
                <LogOut size={14} color="#EF4444" />
              </button>
            </div>
          ) : (
            <button className={styles.sidebarLoginBtn} onClick={() => setScreen('login')}>
              <LogIn size={14} /> Sign In
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <main className={styles.mainContent}>
        {/* TOP SEARCH BAR */}
        <header className={styles.topHeader}>
          <div className={styles.searchBox}>
            <Search size={15} color="var(--t3)" />
            <input
              type="text"
              placeholder="Search film projects by name or genre..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.headerRight}>
            <button className={styles.iconBtn} title="Settings" onClick={() => setHomeSection('settings')}><Settings size={16} /></button>

            {user ? (
              <button
                className={styles.headerSignOutBtn}
                title={`Logged in as ${user.name} — Click to Sign Out`}
                onClick={() => {
                  logout();
                  setScreen('login');
                }}
              >
                <LogOut size={13} color="#EF4444" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button className={styles.headerLoginBtn} onClick={() => setScreen('login')}>
                <UserCheck size={13} color="var(--accent)" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        <div className={styles.scrollBody}>
          {/* VIEW 1: STUDIO HUB */}
          {homeSection === 'hub' && (
            <>
              {/* HERO BANNER */}
              <section className={styles.hero}>
                <div className={styles.heroText}>
                  <div className={styles.heroBadge}>
                    <Sparkles size={12} /> Hollywood Pre-Production Platform · AI Powered
                  </div>
                  <h1>Hollywood Director &amp; Producer Command Center</h1>
                  <p>
                    Automate script breakdowns, stripboard schedules, shot lists, and below-the-line budget caps with multi-agent crew intelligence.
                  </p>
                  <div className={styles.heroActions}>
                    <button className={styles.heroPrimaryBtn} onClick={openWizard}>
                      <Plus size={16} /> Initiate New Film Project
                    </button>
                    <button
                      className={styles.heroSecondaryBtn}
                      onClick={() => { setActiveProject(projects[0]); setScreen('workbench'); }}
                    >
                      <Play size={14} /> Launch Active Workbench{projects[0] ? ` (${projects[0].name})` : ''}
                    </button>
                  </div>
                </div>

                <div className={styles.heroMetrics}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>ClickHouse Memory Engine</div>
                    <div className={styles.metricVal} style={{ color: 'var(--cyan)' }}>
                      <Database size={16} /> Connected
                    </div>
                    <div className={styles.metricSub}>{AGENT_ROSTER.length} AI Agents on Crew</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>Active Projects</div>
                    <div className={styles.metricVal} style={{ color: 'var(--accent)' }}>
                      {projects.length} Productions
                    </div>
                    <div className={styles.metricSub}>
                      {projects.filter((p) => p.status === 'active').length} Active · {projects.filter((p) => p.status === 'development').length} Development
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>Combined Budget Cap</div>
                    <div className={styles.metricVal} style={{ color: 'var(--grn)' }}>
                      ${projects.reduce((sum, p) => sum + p.budgetCap, 0).toLocaleString('en-US')}
                    </div>
                    <div className={styles.metricSub}>Across {projects.length} Productions</div>
                  </div>
                </div>
              </section>

              {/* PROJECTS SECTION */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Film Productions &amp; Workspace Hub</h2>
                    <p>Select a project to enter its 3-Panel Workbench or initiate a new shoot.</p>
                  </div>

                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                    <TabsList className={`${styles.tabFilter} h-auto w-auto`}>
                      <TabsTrigger value="all" className={`${styles.filterBtn} ${activeTab === 'all' ? styles.activeFilter : ''} flex-none`}>All ({projects.length})</TabsTrigger>
                      <TabsTrigger value="active" className={`${styles.filterBtn} ${activeTab === 'active' ? styles.activeFilter : ''} flex-none`}>Active ({activeCount})</TabsTrigger>
                      <TabsTrigger value="development" className={`${styles.filterBtn} ${activeTab === 'development' ? styles.activeFilter : ''} flex-none`}>Development ({developmentCount})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className={styles.projectGrid}>
                  <div className={styles.newProjectCard} onClick={openWizard}>
                    <div className={styles.plusCircle}><Plus size={24} /></div>
                    <h3>Initiate New Project</h3>
                    <p>Script upload, AI breakdown, budget cap &amp; crew setup</p>
                  </div>

                  {filteredProjects.map((p) => (
                    <div
                      key={p.id}
                      className={styles.projectCard}
                      onClick={() => { setActiveProject(p); setScreen('workbench'); }}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.phaseBadge}>{p.phase}</span>
                        <span className={styles.timeAgo}>{p.updatedAt}</span>
                      </div>

                      <h3 className={styles.projTitle}>{p.name}</h3>
                      <div className={styles.projMeta}>
                        <span>{p.format}</span> · <span>{p.genre}</span>
                      </div>

                      <div className={styles.statsRow}>
                        <div>
                          <div className={styles.statLabel}>Scenes</div>
                          <div className={styles.statNum}>{p.scenesCount} Scenes</div>
                        </div>
                        <div>
                          <div className={styles.statLabel}>Budget Cap</div>
                          <div className={styles.statNum} style={{ color: p.estimatedCost > p.budgetCap ? 'var(--red)' : 'var(--grn)' }}>
                            ${p.budgetCap.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className={styles.statLabel}>Shoot Days</div>
                          <div className={styles.statNum}>{p.shootDays} Days</div>
                        </div>
                      </div>

                      {p.scriptFile && (
                        <div className={styles.scriptFileTag}>
                          <FileText size={12} color="var(--cyan)" />
                          <span>{p.scriptFile}</span>
                        </div>
                      )}

                      <div className={styles.cardFooter}>
                        <span className={styles.launchText}>Open Director Workbench</span>
                        <ArrowRight size={14} className={styles.launchIcon} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* QUICK START TEMPLATES */}
              <section className={styles.section} style={{ marginTop: '36px' }}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Quick Start Studio Templates</h2>
                    <p>Pre-configured pre-production workflows designed for specific format requirements.</p>
                  </div>
                </div>

                <div className={styles.templateGrid}>
                  {templates.map((t, idx) => (
                    <div key={idx} className={styles.templateCard} onClick={openWizard}>
                      <div className={styles.templateHeader}>
                        {t.icon}
                        <span className={styles.templateFormat}>{t.format}</span>
                      </div>
                      <h4>{t.title}</h4>
                      <div className={styles.templateSub}>{t.genre}</div>
                      <div className={styles.templateMeta}>
                        <span>Target Cap: <strong>{t.budget}</strong></span>
                        <span>Days: <strong>{t.days}d</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* VIEW 2: FILM PROJECTS */}
          {homeSection === 'projects' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Film Projects Directory</h2>
                  <p>All active, development, and archived studio film productions.</p>
                </div>
                <button className={styles.createBtnHeader} onClick={openWizard}>
                  <Plus size={15} /> Initiate New Project
                </button>
              </div>

              <div className={styles.projectGrid}>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={styles.projectCard}
                    onClick={() => { setActiveProject(p); setScreen('workbench'); }}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.phaseBadge}>{p.phase}</span>
                      <span className={styles.timeAgo}>{p.updatedAt}</span>
                    </div>

                    <h3 className={styles.projTitle}>{p.name}</h3>
                    <div className={styles.projMeta}>
                      <span>{p.format}</span> · <span>{p.genre}</span>
                    </div>

                    <div className={styles.statsRow}>
                      <div>
                        <div className={styles.statLabel}>Scenes</div>
                        <div className={styles.statNum}>{p.scenesCount} Scenes</div>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Budget Cap</div>
                        <div className={styles.statNum} style={{ color: p.estimatedCost > p.budgetCap ? 'var(--red)' : 'var(--grn)' }}>
                          ${p.budgetCap.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Shoot Days</div>
                        <div className={styles.statNum}>{p.shootDays} Days</div>
                      </div>
                    </div>

                    {p.scriptFile && (
                      <div className={styles.scriptFileTag}>
                        <FileText size={12} color="var(--cyan)" />
                        <span>{p.scriptFile}</span>
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <span className={styles.launchText}>Open Director Workbench</span>
                      <ArrowRight size={14} className={styles.launchIcon} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* VIEW 3: AI AGENT CREW */}
          {homeSection === 'agents' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Multi-Agent Production Crew</h2>
                  <p>Specialized autonomous AI agents orchestrating pre-production workflows.</p>
                </div>
              </div>

              <div className={styles.agentGrid}>
                {AGENT_ROSTER.map((agent) => (
                  <div key={agent.name} className={styles.agentCard}>
                    <div className={styles.agentHdr}>
                      {agent.icon}
                      <div>
                        <h3>{agent.name}</h3>
                        <span className={styles.statusOk}>{agent.role}</span>
                      </div>
                    </div>
                    <p className={styles.agentDesc}>{agent.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* VIEW 4: SETTINGS */}
          {homeSection === 'settings' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Studio &amp; Production Settings</h2>
                  <p>Manage studio credentials, union scale defaults, and export configurations.</p>
                </div>
              </div>

              <div className={styles.settingsForm}>
                <div className={styles.setGroup}>
                  <label>Studio Name</label>
                  <input
                    type="text"
                    className={styles.setInput}
                    value={settings.studioName}
                    onChange={(e) => updateSettings({ studioName: e.target.value })}
                  />
                </div>
                <div className={styles.setGroup}>
                  <label>Default Union Scale Agreement</label>
                  <select
                    className={styles.setSelect}
                    value={settings.unionScale}
                    onChange={(e) => updateSettings({ unionScale: e.target.value })}
                  >
                    <option value="SAG-AFTRA Ultra Low Budget">SAG-AFTRA Ultra Low Budget (ULB)</option>
                    <option value="SAG-AFTRA Moderate Low Budget">SAG-AFTRA Moderate Low Budget</option>
                    <option value="DGA Low Budget Agreement">DGA Low Budget Agreement</option>
                    <option value="Non-Union">Non-Union Indie Scale</option>
                  </select>
                </div>
                <div className={styles.setGroup}>
                  <label>Export Format Preference</label>
                  <select
                    className={styles.setSelect}
                    value={settings.exportFormat}
                    onChange={(e) => updateSettings({ exportFormat: e.target.value })}
                  >
                    <option value="Greenlight Package (HTML/PDF)">Greenlight Package (HTML/PDF)</option>
                    <option value="Movie Magic Budgeting (MMBX)">Movie Magic Budgeting (MMBX)</option>
                    <option value="Final Draft (.fdx)">Final Draft (.fdx)</option>
                  </select>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
