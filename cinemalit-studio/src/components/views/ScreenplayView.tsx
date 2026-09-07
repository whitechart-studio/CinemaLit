// src/components/views/ScreenplayView.tsx
import { useState, useRef } from 'react';
import { Edit3, Eye, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '../../store/studio';
import { parseFountainScript, exportToFountain } from '../../utils/fountainParser';
import { readScriptFile, SCRIPT_ACCEPT } from '../../utils/scriptFile';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import styles from './ScreenplayView.module.css';

const DEFAULT_FOUNTAIN = `Title: Neon Echoes
Credit: Written by
Author: A. Kubrick & J. Villeneuve
Draft date: August 2, 2026

INT. NEON COFFEE SHOP - NIGHT

Flickering cyan neon tubes illuminate rain-streaked windows. Condensation drips down glass. A low HUM of city noise bleeds through the walls.

MAYA (28, wired, brilliant) hunches over a glowing terminal at the back booth. Code scrolls faster than most can read.

KAI (32, lean, military posture) slides into the booth opposite her. He places a heavy chrome PROP GUN onto the table, face down. The diner goes quiet.

MAYA
(not looking up)
You're twelve minutes late. The window closes in eight.

KAI
Traffic was monitored. Had to ghost three blocks.

MAYA
Then we have six minutes. Sit down and be quiet.

EXT. DINER ALLEYWAY - NIGHT

RAIN hammers the asphalt. A blacked-out sedan idles at the alley mouth, engine barely a whisper.

Maya and Kai burst through the service exit — running hard. Behind them, AGENTS in tactical gear close fast.

KAI
Car!

MAYA
(panting)
I see it. Move!

INT. PICTURE VEHICLE - NIGHT

The car SCREECHES into traffic. Maya jacks her terminal into the dashboard data port. Screens flicker — cascading data streams.

Kai drives with brutal focus. Rearview: three pursuit vehicles. Closing.

MAYA
Forty seconds. I need forty seconds.

KAI
(through gritted teeth)
I'll give you twenty. Figure out the math.
`;

export function ScreenplayView() {
  const { scenes, setScenes, activeProject } = useStudioStore();
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [fountainText, setFountainText] = useState(DEFAULT_FOUNTAIN);
  const [activeSceneId, setActiveSceneId] = useState('s0');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (text: string) => {
    setFountainText(text);
    const parsed = parseFountainScript(text);
    if (parsed.scenes.length > 0) {
      setScenes(parsed.scenes);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so re-picking the same file fires onChange again
    if (!file) return;
    try {
      handleTextChange(await readScriptFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const handleExport = () => {
    const text = exportToFountain(scenes, activeProject.name);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.name.toLowerCase().replace(/\s+/g, '_')}.fountain`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const scrollToScene = (num: string) => {
    setActiveSceneId(`s${num}`);
    const el = document.getElementById(`sp-s${num}`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.view}>
      {/* SIDEBAR NAVIGATION */}
      <div className={styles.nav}>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Scenes</span>
          <span className={styles.sceneCount}>{scenes.length}</span>
        </div>

        {scenes.map((sc) => (
          <div
            key={sc.id}
            className={`${styles.navItem} ${activeSceneId === `s${sc.num}` ? styles.active : ''}`}
            onClick={() => scrollToScene(sc.num)}
          >
            <div className={styles.navNum}>SCENE {sc.num}</div>
            <div className={styles.navSlug}>{sc.slug}</div>
          </div>
        ))}

        <div className={styles.navFooter}>
          <button className={styles.exportBtn} onClick={handleExport}>
            <Download size={13} /> Export .fountain
          </button>
        </div>
      </div>

      {/* MAIN SCREENPLAY CONTAINER */}
      <div className={styles.body}>
        {/* TOP TOOLBAR */}
        <div className={styles.toolbar}>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => { if (v) setMode(v as 'read' | 'edit'); }}
            className={styles.modeToggle}
          >
            <ToggleGroupItem value="read" className={styles.modeBtn}>
              <Eye size={13} /> Reader Mode
            </ToggleGroupItem>
            <ToggleGroupItem value="edit" className={styles.modeBtn}>
              <Edit3 size={13} /> Fountain Editor
            </ToggleGroupItem>
          </ToggleGroup>

          <div className={styles.tbActions}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={SCRIPT_ACCEPT}
              onChange={(e) => void handleFileUpload(e)}
            />
            <div className={styles.tools}>
              <button
                className={styles.toolBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} /> Import File
              </button>
              <button className={styles.tbBtn} onClick={handleExport}>
                <Download size={13} /> Download Script
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        {mode === 'edit' ? (
          <div className={styles.editorArea}>
            <textarea
              className={styles.editorTextarea}
              value={fountainText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Type or paste Fountain screenplay text here..."
            />
          </div>
        ) : (
          <div className={styles.docScroll}>
            <div className={styles.doc}>
              <div className={styles.titlePage}>
                <h1>{activeProject.name}</h1>
                <p className={styles.sub}>{scenes.length} Scenes parsed</p>
              </div>

              {scenes.map((sc) => (
                <div
                  key={sc.id}
                  id={`sp-s${sc.num}`}
                  className={`${styles.sceneBlock} ${activeSceneId === `s${sc.num}` ? styles.sceneActive : ''}`}
                >
                  <span className={styles.stag}>SCENE {sc.num}</span>
                  <div className={styles.slug}>{sc.slug}</div>
                  <p className={styles.action}>{sc.desc || 'No action description captured for this scene.'}</p>

                  {(sc.dialogue ?? []).map((d, i) => (
                    <div key={i} className={styles.dialogueGroup}>
                      <div className={styles.cname}>{d.character.toUpperCase()}</div>
                      {d.parenthetical && (
                        <div className={styles.cname} style={{ opacity: 0.6, fontWeight: 400 }}>
                          ({d.parenthetical})
                        </div>
                      )}
                      <p className={styles.dialogue}>{d.text}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
