// src/components/wizard/NewProjectWizard.tsx
import { useState } from 'react';
import {
  X, CheckCircle2, FileText, Sparkles, DollarSign,
  Calendar, Shield, Bot, Database, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import type { NewProjectForm } from '../../types';
import styles from './NewProjectWizard.module.css';

export function NewProjectWizard() {
  const { wizardOpen, closeWizard, createProject } = useStudioStore();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<NewProjectForm>({
    name: 'Neon Echoes',
    format: 'Short Film',
    genre: 'Sci-Fi Thriller',
    scriptSource: 'upload',
    scriptText: '',
    scriptFile: 'Neon_Echoes_v3.fountain',
    budgetCap: 5000,
    shootDays: 2,
    unionScale: 'SAG-AFTRA Ultra Low Budget',
    selectedAgents: ['Director Agent', 'AD Scheduling Agent', 'Budget Controller Agent'],
    clickhouseEnabled: true,
  });

  if (!wizardOpen) return null;

  const handleNext = () => {
    if (step < 4) setStep((s) => s + 1);
    else {
      createProject(form);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const toggleAgent = (agent: string) => {
    setForm((prev) => ({
      ...prev,
      selectedAgents: prev.selectedAgents.includes(agent)
        ? prev.selectedAgents.filter((a) => a !== agent)
        : [...prev.selectedAgents, agent],
    }));
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* WIZARD HEADER */}
        <div className={styles.header}>
          <div>
            <div className={styles.badge}>
              <Sparkles size={12} /> Film Production Initiation Wizard
            </div>
            <h2>Create &amp; Initialize Film Project</h2>
          </div>
          <button className={styles.closeBtn} onClick={closeWizard}>
            <X size={16} />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className={styles.progressBar}>
          <div className={`${styles.stepIndicator} ${step >= 1 ? styles.stepDone : ''}`}>
            <span className={styles.stepNum}>1</span>
            <span className={styles.stepTitle}>Project Identity</span>
          </div>
          <div className={styles.line} />
          <div className={`${styles.stepIndicator} ${step >= 2 ? styles.stepDone : ''}`}>
            <span className={styles.stepNum}>2</span>
            <span className={styles.stepTitle}>Script Source</span>
          </div>
          <div className={styles.line} />
          <div className={`${styles.stepIndicator} ${step >= 3 ? styles.stepDone : ''}`}>
            <span className={styles.stepNum}>3</span>
            <span className={styles.stepTitle}>Budget &amp; Schedule</span>
          </div>
          <div className={styles.line} />
          <div className={`${styles.stepIndicator} ${step >= 4 ? styles.stepDone : ''}`}>
            <span className={styles.stepNum}>4</span>
            <span className={styles.stepTitle}>AI Crew Config</span>
          </div>
        </div>

        {/* STEP CONTENT */}
        <div className={styles.content}>
          {/* STEP 1: PROJECT IDENTITY */}
          {step === 1 && (
            <div className={styles.stepBox}>
              <div className={styles.stepIntro}>
                <h3>Step 1: Project Identity &amp; Format</h3>
                <p>Define the title, production format, and genre of your project.</p>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Production Title</label>
                <input
                  type="text"
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Neon Echoes"
                />
              </div>

              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Production Format</label>
                  <select
                    className={styles.select}
                    value={form.format}
                    onChange={(e) => setForm({ ...form, format: e.target.value as any })}
                  >
                    <option value="Short Film">Short Film (Under 30 mins)</option>
                    <option value="Feature Film">Feature Film (90+ mins)</option>
                    <option value="TV Pilot">TV Series Pilot Episode</option>
                    <option value="Commercial">Commercial / Brand Film</option>
                    <option value="Music Video">Music Video</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Primary Genre</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={form.genre}
                    onChange={(e) => setForm({ ...form, genre: e.target.value })}
                    placeholder="e.g. Sci-Fi Thriller"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SCRIPT SOURCE */}
          {step === 2 && (
            <div className={styles.stepBox}>
              <div className={styles.stepIntro}>
                <h3>Step 2: Script &amp; Screenplay Source</h3>
                <p>Upload an existing Fountain / Final Draft script or generate one via AI treatment prompt.</p>
              </div>

              <div className={styles.sourceToggle}>
                <button
                  className={`${styles.toggleBtn} ${form.scriptSource === 'upload' ? styles.activeToggle : ''}`}
                  onClick={() => setForm({ ...form, scriptSource: 'upload' })}
                >
                  <FileText size={15} /> Upload Script File (.fountain / .fdx)
                </button>
                <button
                  className={`${styles.toggleBtn} ${form.scriptSource === 'ai_prompt' ? styles.activeToggle : ''}`}
                  onClick={() => setForm({ ...form, scriptSource: 'ai_prompt' })}
                >
                  <Sparkles size={15} /> Generate Script via AI Prompt
                </button>
              </div>

              {form.scriptSource === 'upload' ? (
                <div className={styles.uploadZone}>
                  <FileText size={32} color="var(--gold)" />
                  <h4>Drag &amp; Drop Screenplay File</h4>
                  <p>Supports .fountain, .fdx (Final Draft), .pdf formats</p>
                  <div className={styles.filePill}>
                    <FileText size={13} color="var(--cyan)" />
                    <span>{form.scriptFile}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>AI Script / Treatment Prompt</label>
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    value={form.scriptText}
                    onChange={(e) => setForm({ ...form, scriptText: e.target.value })}
                    placeholder="Describe the story, key characters, and setting (e.g. A cyberpunk thriller where Maya and Kai meet covertly in a neon coffee shop under rain...)"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: BUDGET & SCHEDULE */}
          {step === 3 && (
            <div className={styles.stepBox}>
              <div className={styles.stepIntro}>
                <h3>Step 3: Budget &amp; Production Schedule Constraints</h3>
                <p>Set target below-the-line budget caps and target shoot duration.</p>
              </div>

              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Below-the-Line Budget Cap ($ USD)</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={form.budgetCap}
                    onChange={(e) => setForm({ ...form, budgetCap: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Target Shoot Days</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={form.shootDays}
                    onChange={(e) => setForm({ ...form, shootDays: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
                <label className={styles.label}>Union Scale Agreement</label>
                <select
                  className={styles.select}
                  value={form.unionScale}
                  onChange={(e) => setForm({ ...form, unionScale: e.target.value })}
                >
                  <option value="SAG-AFTRA Ultra Low Budget">SAG-AFTRA Ultra Low Budget (ULB)</option>
                  <option value="SAG-AFTRA Moderate Low Budget">SAG-AFTRA Moderate Low Budget</option>
                  <option value="DGA Low Budget Agreement">DGA Low Budget Agreement</option>
                  <option value="Non-Union Indie Scale">Non-Union Indie Scale</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: AI CREW CONFIG */}
          {step === 4 && (
            <div className={styles.stepBox}>
              <div className={styles.stepIntro}>
                <h3>Step 4: AI Director Crew &amp; Memory Engine</h3>
                <p>Select AI agents to assist with script breakdown, scheduling, and risk analysis.</p>
              </div>

              <div className={styles.agentGrid}>
                {[
                  { name: 'Director Agent', role: 'Scene breakdown & creative vision', icon: <Bot size={16} color="var(--gold)" /> },
                  { name: 'AD Scheduling Agent', role: 'Stripboard & DOOD optimization', icon: <Calendar size={16} color="var(--cyan)" /> },
                  { name: 'Budget Controller Agent', role: 'Real-time cost tracking & variance flags', icon: <DollarSign size={16} color="var(--grn)" /> },
                  { name: 'Stunt & Safety Agent', role: 'Risk assessment & weapon armorer notes', icon: <Shield size={16} color="var(--red)" /> },
                ].map((ag) => {
                  const isSelected = form.selectedAgents.includes(ag.name);
                  return (
                    <div
                      key={ag.name}
                      className={`${styles.agentCard} ${isSelected ? styles.agentSelected : ''}`}
                      onClick={() => toggleAgent(ag.name)}
                    >
                      <div className={styles.agentHdr}>
                        {ag.icon}
                        <strong>{ag.name}</strong>
                        {isSelected && <CheckCircle2 size={16} color="var(--gold)" className={styles.checkIcon} />}
                      </div>
                      <p className={styles.agentDesc}>{ag.role}</p>
                    </div>
                  );
                })}
              </div>

              <div className={styles.memoryBox}>
                <Database size={16} color="var(--cyan)" />
                <div>
                  <strong>ClickHouse Cloud Memory Engine</strong>
                  <p>Persist project memory and scene graph query history across sessions.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WIZARD FOOTER */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button className={styles.backBtn} onClick={handleBack}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          <button className={styles.nextBtn} onClick={handleNext}>
            {step === 4 ? 'Launch Project Workbench' : 'Next Step'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
