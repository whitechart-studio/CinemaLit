// src/components/home/HomePage.tsx
import { useState } from 'react';
import {
  Clapperboard, Plus, Film, Sparkles, Database, Layers,
  CalendarDays, ArrowRight, FolderKanban, BarChart3,
  Bot, Settings, Search, Play, FileText, Bell, Home,
  DollarSign, Shield, AlertTriangle, TrendingUp, LogOut, LogIn, UserCheck,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import styles from './HomePage.module.css';

export function HomePage() {
  const { projects, setActiveProject, openWizard, setScreen, user, logout } = useStudioStore();
  const [activeNav, setActiveNav] = useState<'hub' | 'projects' | 'analytics' | 'agents' | 'clickhouse' | 'settings'>('hub');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'development'>('all');

  const filteredProjects = projects.filter((p) => {
    if (activeTab === 'active') return p.status === 'active';
    if (activeTab === 'development') return p.status === 'development';
    return true;
  });

  const templates = [
    { title: '2-Day Indie Short', format: 'Short Film', genre: 'Sci-Fi / Drama', budget: '$5,000', days: 2, icon: <Film size={18} color="var(--gold)" /> },
    { title: 'Action Pilot Episode', format: 'TV Pilot', genre: 'Action Thriller', budget: '$50,000', days: 5, icon: <Sparkles size={18} color="var(--cyan)" /> },
    { title: 'Feature Script Breakdown', format: 'Feature Film', genre: 'Drama', budget: '$250,000', days: 20, icon: <Layers size={18} color="var(--pur)" /> },
    { title: 'Commercial Shoot', format: 'Commercial', genre: 'Brand Film', budget: '$15,000', days: 1, icon: <CalendarDays size={18} color="var(--grn)" /> },
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

          <div
            className={`${styles.navItem} ${activeNav === 'hub' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('hub')}
          >
            <Home size={15} className={styles.navIcon} />
            <span>Studio Hub</span>
          </div>

          <div
            className={`${styles.navItem} ${activeNav === 'projects' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('projects')}
          >
            <FolderKanban size={15} className={styles.navIcon} />
            <span>Film Projects</span>
            <span className={styles.badge}>{projects.length}</span>
          </div>

          <div
            className={`${styles.navItem} ${activeNav === 'analytics' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('analytics')}
          >
            <BarChart3 size={15} className={styles.navIcon} />
            <span>Analytics &amp; Budget</span>
          </div>

          <div
            className={`${styles.navItem} ${activeNav === 'agents' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('agents')}
          >
            <Bot size={15} className={styles.navIcon} />
            <span>AI Agent Crew</span>
          </div>

          <div
            className={`${styles.navItem} ${activeNav === 'clickhouse' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('clickhouse')}
          >
            <Database size={15} className={styles.navIcon} />
            <span>ClickHouse Memory</span>
          </div>

          <div
            className={`${styles.navItem} ${activeNav === 'settings' ? styles.activeNav : ''}`}
            onClick={() => setActiveNav('settings')}
          >
            <Settings size={15} className={styles.navIcon} />
            <span>Settings</span>
          </div>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className={styles.sidebarFooter}>
          <div className={styles.connChip}>
            <span className={styles.greenDot} /> ClickHouse Cloud: 3.8ms
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
            <input type="text" placeholder="Search film projects, scripts, breakdown scenes..." className={styles.searchInput} />
          </div>

          <div className={styles.headerRight}>
            <button className={styles.iconBtn} title="Notifications"><Bell size={16} /></button>
            <button className={styles.iconBtn} title="Settings" onClick={() => setActiveNav('settings')}><Settings size={16} /></button>

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
                <UserCheck size={13} color="var(--gold)" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        <div className={styles.scrollBody}>
          {/* VIEW 1: STUDIO HUB */}
          {activeNav === 'hub' && (
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
                      <Play size={14} /> Launch Active Workbench (Neon Echoes)
                    </button>
                  </div>
                </div>

                <div className={styles.heroMetrics}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>ClickHouse Memory Engine</div>
                    <div className={styles.metricVal} style={{ color: 'var(--cyan)' }}>
                      <Database size={16} /> 3.8ms
                    </div>
                    <div className={styles.metricSub}>3 Active AI Agents Synced</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>Active Projects</div>
                    <div className={styles.metricVal} style={{ color: 'var(--gold)' }}>
                      {projects.length} Productions
                    </div>
                    <div className={styles.metricSub}>2 Pre-Production · 1 Development</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricLbl}>AI Budget Optimization</div>
                    <div className={styles.metricVal} style={{ color: 'var(--grn)' }}>
                      +$14,200 Saved
                    </div>
                    <div className={styles.metricSub}>Across 42 Analyzed Scenes</div>
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

                  <div className={styles.tabFilter}>
                    <button className={`${styles.filterBtn} ${activeTab === 'all' ? styles.activeFilter : ''}`} onClick={() => setActiveTab('all')}>All ({projects.length})</button>
                    <button className={`${styles.filterBtn} ${activeTab === 'active' ? styles.activeFilter : ''}`} onClick={() => setActiveTab('active')}>Active (2)</button>
                    <button className={`${styles.filterBtn} ${activeTab === 'development' ? styles.activeFilter : ''}`} onClick={() => setActiveTab('development')}>Development (1)</button>
                  </div>
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
          {activeNav === 'projects' && (
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

          {/* VIEW 3: ANALYTICS & BUDGET */}
          {activeNav === 'analytics' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Analytics &amp; Financial Command Center</h2>
                  <p>Below-the-Line budget caps, line item overages, and AI cost optimizations.</p>
                </div>
              </div>

              <div className={styles.analyticsGrid}>
                <div className={styles.anaCard}>
                  <div className={styles.anaHdr}>
                    <DollarSign size={18} color="var(--gold)" />
                    <div>
                      <div className={styles.anaTitle}>Total Studio Budget Cap</div>
                      <div className={styles.anaVal}>$80,000 USD</div>
                    </div>
                  </div>
                  <div className={styles.pbar}><div className={styles.pfill} style={{ width: '92%', background: 'var(--gold)' }} /></div>
                  <div className={styles.anaSub}>$73,610 Allocated (92% Cap Utilized)</div>
                </div>

                <div className={styles.anaCard}>
                  <div className={styles.anaHdr}>
                    <TrendingUp size={18} color="var(--grn)" />
                    <div>
                      <div className={styles.anaTitle}>AI Cost Savings</div>
                      <div className={styles.anaVal} style={{ color: 'var(--grn)' }}>+$14,200 Saved</div>
                    </div>
                  </div>
                  <div className={styles.pbar}><div className={styles.pfill} style={{ width: '100%', background: 'var(--grn)' }} /></div>
                  <div className={styles.anaSub}>Across 42 Scenes and 3 Productions</div>
                </div>

                <div className={styles.anaCard}>
                  <div className={styles.anaHdr}>
                    <AlertTriangle size={18} color="var(--red)" />
                    <div>
                      <div className={styles.anaTitle}>Active Overage Flags</div>
                      <div className={styles.anaVal} style={{ color: 'var(--red)' }}>1 Warning</div>
                    </div>
                  </div>
                  <div className={styles.pbar}><div className={styles.pfill} style={{ width: '35%', background: 'var(--red)' }} /></div>
                  <div className={styles.anaSub}>Scene 2 Rain Machine rental +$800 overage</div>
                </div>
              </div>

              <div className={styles.aiFeedBox}>
                <h3>⚡ Director Engine AI Cost Optimization Feed</h3>
                <div className={styles.feedList}>
                  <div className={styles.feedItem}>
                    <Sparkles size={16} color="var(--gold)" />
                    <div>
                      <strong>Consolidate Rain Machine Rental (Neon Echoes)</strong>
                      <p>Merging rain FX setup for Scene 2 into Day 1 schedule saves ~$800 in equipment day-rate.</p>
                    </div>
                  </div>
                  <div className={styles.feedItem}>
                    <Sparkles size={16} color="var(--cyan)" />
                    <div>
                      <strong>Location Permit Bundling (Dock District)</strong>
                      <p>Combine Diner Alleyway permit with neighboring street closure for a 20% municipal discount.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 4: AI AGENT CREW */}
          {activeNav === 'agents' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Multi-Agent Production Crew (Gemini 2.5 Pro)</h2>
                  <p>Specialized autonomous AI agents orchestrating pre-production workflows.</p>
                </div>
              </div>

              <div className={styles.agentGrid}>
                <div className={styles.agentCard}>
                  <div className={styles.agentHdr}>
                    <Bot size={22} color="var(--gold)" />
                    <div>
                      <h3>Director Agent</h3>
                      <span className={styles.statusOk}>ACTIVE · Gemini 2.5 Pro</span>
                    </div>
                  </div>
                  <p className={styles.agentDesc}>
                    Parses screenplay Fountain files into scene node graphs, extracts cast, props, wardrobe, VFX, and generates creative shot ideas.
                  </p>
                  <div className={styles.agentMeta}>
                    <span>Accuracy: <strong>99.4%</strong></span>
                    <span>Scenes Analyzed: <strong>42</strong></span>
                  </div>
                </div>

                <div className={styles.agentCard}>
                  <div className={styles.agentHdr}>
                    <CalendarDays size={22} color="var(--cyan)" />
                    <div>
                      <h3>AD Scheduling Agent</h3>
                      <span className={styles.statusOk}>ACTIVE · Stripboard Engine</span>
                    </div>
                  </div>
                  <p className={styles.agentDesc}>
                    Calculates optimal day breaks, minimizes company moves, generates DGA Call Sheets, and manages DOOD cast availability matrices.
                  </p>
                  <div className={styles.agentMeta}>
                    <span>Latency: <strong>1.8s</strong></span>
                    <span>Schedules Built: <strong>14</strong></span>
                  </div>
                </div>

                <div className={styles.agentCard}>
                  <div className={styles.agentHdr}>
                    <DollarSign size={22} color="var(--grn)" />
                    <div>
                      <h3>Budget Controller Agent</h3>
                      <span className={styles.statusWarn}>WARNING · Over-Cap Flag</span>
                    </div>
                  </div>
                  <p className={styles.agentDesc}>
                    Tracks below-the-line cost estimates vs target caps. Triggers automated overage alerts and cost-reduction alternatives.
                  </p>
                  <div className={styles.agentMeta}>
                    <span>Cap Utilized: <strong>101%</strong></span>
                    <span>Cost Flags: <strong>1</strong></span>
                  </div>
                </div>

                <div className={styles.agentCard}>
                  <div className={styles.agentHdr}>
                    <Shield size={22} color="var(--red)" />
                    <div>
                      <h3>Stunt &amp; Safety Agent</h3>
                      <span className={styles.statusOk}>ACTIVE · Compliance Check</span>
                    </div>
                  </div>
                  <p className={styles.agentDesc}>
                    Scans breakdown items for prop weapons, pyrotechnics, water work, and stunt sequences to enforce licensed armorer &amp; permit safety rules.
                  </p>
                  <div className={styles.agentMeta}>
                    <span>Rules Verified: <strong>100%</strong></span>
                    <span>Risks Tagged: <strong>2</strong></span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 5: CLICKHOUSE MEMORY */}
          {activeNav === 'clickhouse' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>ClickHouse Cloud Memory Engine Monitor</h2>
                  <p>Vector embeddings and SQL state engine backing AI Crew memory persistence.</p>
                </div>
                <div className={styles.latencyChip}>
                  <Database size={14} color="var(--cyan)" /> 3.8ms Average Latency
                </div>
              </div>

              <div className={styles.chGrid}>
                <div className={styles.chCard}>
                  <h4>Vector Tables</h4>
                  <ul>
                    <li><code>scenes</code> — 42 vector embeddings</li>
                    <li><code>shots</code> — 128 camera angles</li>
                    <li><code>budget_items</code> — 64 line items</li>
                    <li><code>agent_memory</code> — 310 log events</li>
                  </ul>
                </div>

                <div className={styles.chCard}>
                  <h4>Active Queries</h4>
                  <pre className={styles.sqlPre}>
{`SELECT scene_id, risk_level, cost_est
FROM scenes
WHERE production = 'neon_echoes'
  AND risk_level = 'HIGH';`}
                  </pre>
                </div>
              </div>
            </section>
          )}

          {/* VIEW 6: SETTINGS */}
          {activeNav === 'settings' && (
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
                  <input type="text" className={styles.setInput} defaultValue="CinemaLit Pictures" />
                </div>
                <div className={styles.setGroup}>
                  <label>Default Union Scale Agreement</label>
                  <select className={styles.setSelect} defaultValue="SAG-AFTRA Ultra Low Budget">
                    <option value="SAG-AFTRA Ultra Low Budget">SAG-AFTRA Ultra Low Budget (ULB)</option>
                    <option value="SAG-AFTRA Moderate Low Budget">SAG-AFTRA Moderate Low Budget</option>
                    <option value="DGA Low Budget Agreement">DGA Low Budget Agreement</option>
                    <option value="Non-Union">Non-Union Indie Scale</option>
                  </select>
                </div>
                <div className={styles.setGroup}>
                  <label>Export Format Preference</label>
                  <select className={styles.setSelect} defaultValue="Greenlight Package (HTML/PDF)">
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
