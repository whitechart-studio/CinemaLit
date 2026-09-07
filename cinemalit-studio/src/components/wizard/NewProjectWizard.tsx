// src/components/wizard/NewProjectWizard.tsx
import { useState } from 'react';
import {
  X, CheckCircle2, FileText, Sparkles, DollarSign,
  Calendar, Shield, Bot, Database, ArrowRight, ArrowLeft, Upload, Lock,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { readScriptFile, SCRIPT_ACCEPT } from '../../utils/scriptFile';
import type { NewProjectForm } from '../../types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import styles from './NewProjectWizard.module.css';

export function NewProjectWizard() {
  const { wizardOpen, closeWizard, createProject } = useStudioStore();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const [form, setForm] = useState<NewProjectForm>({
    name: '',
    format: 'Short Film',
    genre: 'Sci-Fi Thriller',
    scriptSource: 'upload',
    scriptText: '',
    scriptFile: '',
    budgetCap: 5000,
    shootDays: 2,
    unionScale: 'SAG-AFTRA Ultra Low Budget',
    selectedAgents: ['Director Agent', 'AD Scheduling Agent', 'Budget Controller Agent'],
    clickhouseEnabled: true,
    generateStoryboards: false,
  });

  const loadScriptFile = async (file: File) => {
    setReading(true);
    setError('');
    try {
      const text = await readScriptFile(file);
      setForm((prev) => ({ ...prev, scriptFile: file.name, scriptText: text }));
    } catch (err) {
      setForm((prev) => ({ ...prev, scriptFile: '', scriptText: '' }));
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setReading(false);
    }
  };

  // The launch button hands this straight to the agent, so an empty script
  // would produce an empty project — block it at the step that owns it.
  const stepBlocker = (): string => {
    if (step === 1 && !form.name.trim()) return 'Give the production a title first.';
    if (step === 2 && !form.scriptText.trim()) {
      return form.scriptSource === 'upload'
        ? 'Upload a screenplay file before continuing.'
        : 'Describe the story before continuing.';
    }
    return '';
  };

  const handleNext = async () => {
    const blocker = stepBlocker();
    if (blocker) {
      setError(blocker);
      return;
    }
    setError('');
    if (step < 4) {
      setStep((s) => s + 1);
      return;
    }
    setBusy(true);
    try {
      await createProject(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
    } finally {
      setBusy(false);
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
    <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) closeWizard(); }}>
      <DialogContent showCloseButton={false} className={`${styles.modal} max-w-[680px] w-full p-0 gap-0`}>
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
                  <Select
                    value={form.format}
                    onValueChange={(v) => setForm({ ...form, format: v as NewProjectForm['format'] })}
                  >
                    <SelectTrigger className={`${styles.select} w-full`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Short Film">Short Film (Under 30 mins)</SelectItem>
                      <SelectItem value="Feature Film">Feature Film (90+ mins)</SelectItem>
                      <SelectItem value="TV Pilot">TV Series Pilot Episode</SelectItem>
                      <SelectItem value="Commercial">Commercial / Brand Film</SelectItem>
                      <SelectItem value="Music Video">Music Video</SelectItem>
                    </SelectContent>
                  </Select>
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

              <ToggleGroup
                type="single"
                value={form.scriptSource}
                onValueChange={(v) => { if (v) setForm({ ...form, scriptSource: v as NewProjectForm['scriptSource'] }); }}
                className={styles.sourceToggle}
              >
                <ToggleGroupItem value="upload" className={styles.toggleBtn}>
                  <FileText size={15} /> Upload Script File (.fountain / .fdx / .pdf)
                </ToggleGroupItem>
                <ToggleGroupItem value="ai_prompt" className={styles.toggleBtn}>
                  <Sparkles size={15} /> Generate Script via AI Prompt
                </ToggleGroupItem>
              </ToggleGroup>

              {form.scriptSource === 'upload' ? (
                <div
                  className={styles.uploadZone}
                  style={dragging ? { borderColor: 'var(--accent)' } : undefined}
                  onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={(e) => {
                    // Fires when crossing into a child too — ignore those.
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void loadScriptFile(file);
                  }}
                >
                  <input
                    type="file"
                    id="wizard-script-file"
                    className={styles.hiddenFileInput}
                    accept={SCRIPT_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void loadScriptFile(file);
                      // Reset so picking the same file twice still fires onChange.
                      e.target.value = '';
                    }}
                  />
                  <FileText size={32} color="var(--accent)" />
                  <h4>
                    {reading
                      ? 'Reading screenplay…'
                      : form.scriptFile ? 'Screenplay Loaded' : 'Upload Screenplay File'}
                  </h4>
                  <p>
                    {form.scriptFile && !reading
                      ? `${form.scriptText.split(/\r?\n/).length} lines loaded`
                      : 'Supports .fountain, .fdx, .pdf, .txt — or drop the file here'}
                  </p>
                  <label htmlFor="wizard-script-file" className={styles.browseBtn}>
                    <Upload size={13} /> {form.scriptFile ? 'Choose a different file' : 'Choose File'}
                  </label>
                  {form.scriptFile && (
                    <div className={styles.filePill}>
                      <FileText size={13} color="var(--cyan)" />
                      <span>{form.scriptFile}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>AI Script / Treatment Prompt</label>
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    value={form.scriptText}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scriptText: e.target.value,
                        scriptFile: `${form.name || 'untitled'}.fountain`,
                      })
                    }
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
                <Select
                  value={form.unionScale}
                  onValueChange={(v) => setForm({ ...form, unionScale: v })}
                >
                  <SelectTrigger className={`${styles.select} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAG-AFTRA Ultra Low Budget">SAG-AFTRA Ultra Low Budget (ULB)</SelectItem>
                    <SelectItem value="SAG-AFTRA Moderate Low Budget">SAG-AFTRA Moderate Low Budget</SelectItem>
                    <SelectItem value="DGA Low Budget Agreement">DGA Low Budget Agreement</SelectItem>
                    <SelectItem value="Non-Union Indie Scale">Non-Union Indie Scale</SelectItem>
                  </SelectContent>
                </Select>
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
                  { name: 'Director Agent', role: 'Scene breakdown & creative vision', icon: <Bot size={16} color="var(--accent)" /> },
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
                        {isSelected && <CheckCircle2 size={16} color="var(--accent)" className={styles.checkIcon} />}
                      </div>
                      <p className={styles.agentDesc}>{ag.role}</p>
                    </div>
                  );
                })}
              </div>

              <label className={styles.memoryBox}>
                <Checkbox
                  checked={form.generateStoryboards}
                  onCheckedChange={(checked) => setForm({ ...form, generateStoryboards: checked === true })}
                />
                <div>
                  <strong>Generate AI storyboards on launch</strong>
                  <p>
                    Adds an AI keyframe sequence for every scene. Slower — leave this off to
                    launch sooner and generate storyboards per scene later.
                  </p>
                </div>
              </label>

              <div className={styles.infoCard}>
                <Database size={16} color="var(--cyan)" />
                <div>
                  <div className={styles.infoCardTitle}>
                    <strong>ClickHouse Cloud Memory Engine</strong>
                    <span className={styles.alwaysOnPill}><Lock size={9} /> Always On</span>
                  </div>
                  <p>Persist project memory and scene graph query history across sessions.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WIZARD FOOTER */}
        <div className={styles.footer}>
          {step > 1 ? (
            <button className={styles.backBtn} onClick={handleBack} disabled={busy}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          {error && (
            <span style={{ color: 'var(--red)', fontSize: '12px', flex: 1, textAlign: 'center' }}>
              {error}
            </span>
          )}

          <button className={styles.nextBtn} onClick={handleNext} disabled={busy || reading}>
            {busy
              ? 'Briefing the Director Agent…'
              : step === 4
                ? 'Launch Project Workbench'
                : 'Next Step'}{' '}
            <ArrowRight size={14} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
