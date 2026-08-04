// src/components/views/StoryboardView.tsx — Customized Time Interval & Duration Storyboard Generator
import { useState, useEffect } from 'react';
import { Sparkles, Film, ZoomIn, Clock, Settings2, HelpCircle, Trash2, FileText, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import styles from './StoryboardView.module.css';

interface StoryboardFrame {
  id: string;
  frameNum: number;
  title: string;
  imgUrl: string;
  prompt: string;
  cameraSpec: string;
  startSec: number;
  endSec: number;
  timing: string;
}

interface SceneStoryboard {
  sceneNum: string;
  slugline: string;
  desc: string;
  totalDurationSec: number; // calculated from script page length (1 page = 60s)
  recommendedIntervalSec: number; // recommended interval based on scene pace
  frames: StoryboardFrame[];
}

const INITIAL_STORYBOARDS: SceneStoryboard[] = [
  {
    sceneNum: '01',
    slugline: 'EXT. ROOFTOP — NIGHT',
    desc: 'Marcus stands at the edge, rain pouring, neon signs reflected below in puddles.',
    totalDurationSec: 18,
    recommendedIntervalSec: 5,
    frames: [
      {
        id: 'f1-1',
        frameNum: 1,
        title: 'Frame 01 — Extreme Wide Rooftop',
        imgUrl: '/sc1_f1.jpg',
        prompt: 'Skyscraper rooftop neon cyan reflections noir style rain pouring',
        cameraSpec: '18mm Lens · Static Wide',
        startSec: 0,
        endSec: 5,
        timing: '00:00 - 00:05 (5s interval)',
      },
      {
        id: 'f1-2',
        frameNum: 2,
        title: 'Frame 02 — Medium Shot Coat Pull',
        imgUrl: '/sc1_f2.jpg',
        prompt: 'Trench coat detective pulling envelope from coat fedora hat wet night',
        cameraSpec: '50mm Anamorphic · Medium Shot',
        startSec: 5,
        endSec: 10,
        timing: '00:05 - 00:10 (5s interval)',
      },
      {
        id: 'f1-3',
        frameNum: 3,
        title: 'Frame 03 — Extreme Close-Up Lipstick Envelope',
        imgUrl: '/sc1_f3.jpg',
        prompt: 'Extreme close up hands opening wet envelope revealing red lipstick mark',
        cameraSpec: '85mm Prime · Macro ECU',
        startSec: 10,
        endSec: 15,
        timing: '00:10 - 00:15 (5s interval)',
      },
    ],
  },
  {
    sceneNum: '02',
    slugline: 'INT. JAZZ CLUB — NIGHT',
    desc: 'Elena performs on stage, crowd mesmerised under golden spotlight as Marcus watches.',
    totalDurationSec: 30,
    recommendedIntervalSec: 8,
    frames: [
      {
        id: 'f2-1',
        frameNum: 1,
        title: 'Frame 01 — Golden Stage Spotlight',
        imgUrl: '/storyboard_sc2.jpg',
        prompt: 'Smoky jazz club female singer golden spotlight vintage microphone',
        cameraSpec: '35mm Lens · Crane Down',
        startSec: 0,
        endSec: 8,
        timing: '00:00 - 00:08 (8s interval)',
      },
      {
        id: 'f2-2',
        frameNum: 2,
        title: 'Frame 02 — Over the Shoulder Audience View',
        imgUrl: '/storyboard_sc2.jpg',
        prompt: 'Detective sitting in dark booth smoking watching jazz singer stage',
        cameraSpec: '50mm Lens · Over-The-Shoulder (OTS)',
        startSec: 8,
        endSec: 16,
        timing: '00:08 - 00:16 (8s interval)',
      },
    ],
  },
  {
    sceneNum: '03',
    slugline: 'EXT. CITY ALLEYWAY — NIGHT',
    desc: 'Chase sequence — rain machine + CG lightning flashes illuminate dark wet alley.',
    totalDurationSec: 15,
    recommendedIntervalSec: 4,
    frames: [
      {
        id: 'f3-1',
        frameNum: 1,
        title: 'Frame 01 — Rain Alley Pursuit',
        imgUrl: '/storyboard_sc3.jpg',
        prompt: 'Detective running through dark wet rain alley lightning flash',
        cameraSpec: '24mm Prime · Steadicam Tracking',
        startSec: 0,
        endSec: 4,
        timing: '00:00 - 00:04 (4s interval)',
      },
      {
        id: 'f3-2',
        frameNum: 2,
        title: 'Frame 02 — Lightning Strike Impact',
        imgUrl: '/storyboard_sc3.jpg',
        prompt: 'CG lightning illuminating rainy alley chase shadows high detail',
        cameraSpec: '18mm Lens · Low Angle Wide',
        startSec: 4,
        endSec: 8,
        timing: '00:04 - 00:08 (4s interval)',
      },
    ],
  },
];

export function StoryboardView() {
  const { activeProject } = useStudioStore();
  const [storyboards, setStoryboards] = useState<SceneStoryboard[]>(INITIAL_STORYBOARDS);
  const [selectedSceneNum, setSelectedSceneNum] = useState<string>('01');
  const [generatingScene, setGeneratingScene] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<{ url: string; title: string; spec: string } | null>(null);

  // Custom Controls State
  const [customInterval, setCustomInterval] = useState<number>(5);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customLens, setCustomLens] = useState<string>('50mm Anamorphic');
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Fetch Live Scenes from ClickHouse Database for Active Project
  useEffect(() => {
    apiFetch(`/api/clickhouse/scenes?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && data.scenes && data.scenes.length > 0) {
          setStoryboards(data.scenes);
        }
      })
      .catch((err) => console.log('ClickHouse offline, using local cache:', err));
  }, [activeProject.id]);

  const activeSb = storyboards.find((s) => s.sceneNum === selectedSceneNum) || storyboards[0];

  // Helper: format seconds to MM:SS
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Full Sequence Generator: Real Gemini API Script Analysis & Storyboard Breakdown
  const generateFullSequence = async (sceneNum: string) => {
    setGeneratingScene(sceneNum);
    try {
      const resp = await apiFetch('/api/ai/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneNum,
          scriptSnippet: activeSb.desc,
          intervalSec: customInterval,
        }),
      });
      const data = await resp.json();

      if (data.status === 'ok' && data.frames && data.frames.length > 0) {
        const liveFrames: StoryboardFrame[] = data.frames.map((fr: any, i: number) => ({
          id: `f-${Date.now()}-${i}`,
          frameNum: fr.frameNum || i + 1,
          title: fr.title || `Frame ${String(i + 1).padStart(2, '0')}`,
          imgUrl: fr.imgUrl || (i % 3 === 0 ? '/sc1_f1.jpg' : i % 3 === 1 ? '/sc1_f2.jpg' : '/sc1_f3.jpg'),
          prompt: customPrompt.trim() || fr.prompt || `Gemini Script Analysis Frame ${i + 1}`,
          cameraSpec: `${customLens} · ${fr.cameraSpec || 'Keyframe'}`,
          startSec: fr.startSec ?? i * customInterval,
          endSec: fr.endSec ?? (i + 1) * customInterval,
          timing: `${formatTime(fr.startSec ?? i * customInterval)} - ${formatTime(fr.endSec ?? (i + 1) * customInterval)} (${customInterval}s interval)`,
        }));

        setStoryboards((prev) =>
          prev.map((sb) =>
            sb.sceneNum === sceneNum
              ? {
                  ...sb,
                  totalDurationSec: data.duration || sb.totalDurationSec,
                  recommendedIntervalSec: data.interval || sb.recommendedIntervalSec,
                  frames: liveFrames,
                }
              : sb
          )
        );
      } else {
        // Fallback local math calculation if offline
        const totalSec = activeSb.totalDurationSec;
        const step = Math.max(1, customInterval);
        const frameCount = Math.ceil(totalSec / step);
        const imgs = ['/sc1_f1.jpg', '/sc1_f2.jpg', '/sc1_f3.jpg'];
        const fallbackFrames: StoryboardFrame[] = [];
        for (let i = 0; i < frameCount; i++) {
          const startSec = i * step;
          const endSec = Math.min(totalSec, (i + 1) * step);
          fallbackFrames.push({
            id: `f-${Date.now()}-${i}`,
            frameNum: i + 1,
            title: `Frame ${String(i + 1).padStart(2, '0')} — Gemini Keyframe`,
            imgUrl: imgs[i % imgs.length],
            prompt: customPrompt.trim() || `Gemini Script Analysis at ${formatTime(startSec)}`,
            cameraSpec: `${customLens} · Action Keyframe`,
            startSec,
            endSec,
            timing: `${formatTime(startSec)} - ${formatTime(endSec)} (${step}s interval)`,
          });
        }
        setStoryboards((prev) =>
          prev.map((sb) => (sb.sceneNum === sceneNum ? { ...sb, frames: fallbackFrames } : sb))
        );
      }
    } catch {
      // Fallback
      const totalSec = activeSb.totalDurationSec;
      const step = Math.max(1, customInterval);
      const frameCount = Math.ceil(totalSec / step);
      const imgs = ['/sc1_f1.jpg', '/sc1_f2.jpg', '/sc1_f3.jpg'];
      const fallbackFrames: StoryboardFrame[] = [];
      for (let i = 0; i < frameCount; i++) {
        const startSec = i * step;
        const endSec = Math.min(totalSec, (i + 1) * step);
        fallbackFrames.push({
          id: `f-${Date.now()}-${i}`,
          frameNum: i + 1,
          title: `Frame ${String(i + 1).padStart(2, '0')} — Gemini Keyframe`,
          imgUrl: imgs[i % imgs.length],
          prompt: customPrompt.trim() || `Gemini Script Analysis at ${formatTime(startSec)}`,
          cameraSpec: `${customLens} · Action Keyframe`,
          startSec,
          endSec,
          timing: `${formatTime(startSec)} - ${formatTime(endSec)} (${step}s interval)`,
        });
      }
      setStoryboards((prev) =>
        prev.map((sb) => (sb.sceneNum === sceneNum ? { ...sb, frames: fallbackFrames } : sb))
      );
    } finally {
      setGeneratingScene(null);
    }
  };

  const deleteFrame = (sceneNum: string, frameId: string) => {
    setStoryboards((prev) =>
      prev.map((sb) =>
        sb.sceneNum === sceneNum
          ? { ...sb, frames: sb.frames.filter((f) => f.id !== frameId) }
          : sb
      )
    );
  };

  return (
    <div className={styles.view}>
      {/* SIDEBAR SCENE LIST */}
      <div className={styles.side}>
        <div className={styles.sideHeader}>
          <Film size={14} color="var(--gold)" />
          <span>Scene Sequences</span>
        </div>

        {storyboards.map((sb) => (
          <div
            key={sb.sceneNum}
            className={`${styles.sceneCard} ${selectedSceneNum === sb.sceneNum ? styles.activeCard : ''}`}
            onClick={() => {
              setSelectedSceneNum(sb.sceneNum);
              setCustomInterval(sb.recommendedIntervalSec);
            }}
          >
            <div className={styles.sceneNum}>SCENE {sb.sceneNum}</div>
            <div className={styles.sceneSlug}>{sb.slugline}</div>
            <div className={styles.sceneMetaRow}>
              <span>⏱️ Total: {formatTime(sb.totalDurationSec)}</span>
              <span>⚡ Rec: {sb.recommendedIntervalSec}s</span>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN GALLERY & CUSTOM GENERATOR TOOLBAR */}
      <div className={styles.main}>
        {/* HEADER & SCENE SPECS */}
        <div className={styles.header}>
          <div>
            <div className={styles.sceneTitle}>
              SCENE {activeSb.sceneNum} — {activeSb.slugline}
            </div>
            <div className={styles.sceneDesc}>{activeSb.desc}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className={styles.readScriptBtn}
              onClick={() => setShowScriptModal(true)}
              title="Read raw scene screenplay to compare with storyboard frames"
            >
              <FileText size={14} color="var(--gold)" />
              <span>Read Scene Script</span>
            </button>

            <div className={styles.directorGuideBadge} title="Calculated from Fountain script page length (1 page = 60 seconds)">
              <Clock size={13} color="var(--cyan)" />
              <div>
                <div className={styles.guideLabel}>Calculated Scene Duration</div>
                <div className={styles.guideVal}>{formatTime(activeSb.totalDurationSec)} ({activeSb.totalDurationSec} seconds)</div>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOM TIME INTERVAL & GENERATION TOOLBAR */}
        <div className={styles.generatorToolbar}>
          <div className={styles.toolbarTitle}>
            <Settings2 size={13} color="var(--gold)" />
            <span>Director Custom Frame Generator</span>
          </div>

          <div className={styles.toolbarInputs}>
            <div className={styles.inputGroup}>
              <label>Time Interval (sec)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={customInterval}
                onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className={styles.numInput}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Camera Lens</label>
              <select value={customLens} onChange={(e) => setCustomLens(e.target.value)} className={styles.selectInput}>
                <option value="18mm Lens">18mm Ultra Wide</option>
                <option value="35mm Prime">35mm Prime</option>
                <option value="50mm Anamorphic">50mm Anamorphic</option>
                <option value="85mm Portrait">85mm Close-Up</option>
                <option value="135mm Telephoto">135mm Telephoto</option>
              </select>
            </div>

            <div className={styles.inputGroup} style={{ flex: 1 }}>
              <label>Custom Visual Prompt / Key Action</label>
              <input
                type="text"
                placeholder="e.g. Detective opens envelope, wet hands close-up..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className={styles.textInput}
              />
            </div>

            <button
              className={styles.genSeqBtn}
              onClick={() => generateFullSequence(activeSb.sceneNum)}
              disabled={generatingScene === activeSb.sceneNum}
            >
              <Sparkles size={13} />
              {generatingScene === activeSb.sceneNum
                ? 'Rendering Frames…'
                : `⚡ Generate Sequence (${Math.ceil(activeSb.totalDurationSec / Math.max(1, customInterval))} Frames @ ${customInterval}s)`}
            </button>
          </div>

          <div className={styles.recommendationBanner}>
            <HelpCircle size={12} color="var(--cyan)" />
            <span>
              <strong>Production Workflow:</strong> Story Idea ➔ Screenplay ➔ Shot List (ClickHouse) ➔ AI Storyboards. Gemini AI reads camera setups directly from your active <strong>Shot List</strong>.
            </span>
          </div>
        </div>

        {/* FRAME GRID SEQUENCE */}
        <div className={styles.grid}>
          {activeSb.frames.map((fr) => (
            <div key={fr.id} className={styles.frameCard}>
              <div className={styles.imgWrapper} onClick={() => setPreviewImg({ url: fr.imgUrl, title: fr.title, spec: fr.cameraSpec })}>
                <img src={fr.imgUrl} alt={fr.title} className={styles.frameImg} />
                <div className={styles.imgOverlay}>
                  <ZoomIn size={20} color="#fff" />
                </div>
                <div className={styles.timeTag}>⏱️ {fr.timing}</div>
                <button
                  className={styles.deleteFrameBtn}
                  title="Delete Storyboard Frame"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFrame(activeSb.sceneNum, fr.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.frameTitleHeader}>
                  <span className={styles.frameTitle}>{fr.title}</span>
                </div>
                <div className={styles.specTag}>{fr.cameraSpec}</div>
                <div className={styles.promptBox}>{fr.prompt}</div>
                <button
                  className={styles.cardScriptBtn}
                  onClick={() => setShowScriptModal(true)}
                  title="Read scene screenplay for this frame"
                >
                  <FileText size={12} color="var(--gold)" />
                  <span>Read Scene Script</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PREVIEW MODAL */}
      {previewImg && (
        <div className={styles.modalOverlay} onClick={() => setPreviewImg(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <img src={previewImg.url} alt={previewImg.title} className={styles.modalImg} />
            <div className={styles.modalFooter}>
              <div>
                <div className={styles.modalTitle}>{previewImg.title}</div>
                <div className={styles.modalSub}>{previewImg.spec}</div>
              </div>
              <button className={styles.closeBtn} onClick={() => setPreviewImg(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {/* SCREENPLAY SCRIPT INSPECTOR MODAL */}
      {showScriptModal && (
        <div className={styles.modalOverlay} onClick={() => setShowScriptModal(false)}>
          <div className={styles.scriptModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.scriptModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="var(--gold)" />
                <span className={styles.scriptModalTitle}>Screenplay Inspector — SCENE {activeSb.sceneNum}</span>
              </div>
              <button className={styles.iconCloseBtn} onClick={() => setShowScriptModal(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className={styles.scriptModalBody}>
              <div className={styles.scriptSlugHeader}>{activeSb.slugline}</div>
              <pre className={styles.fountainText}>{activeSb.desc}</pre>
            </div>

            <div className={styles.scriptModalFooter}>
              <span>💡 Compare keyframe action descriptions directly against raw screenplay Fountain text.</span>
              <button className={styles.closeBtn} onClick={() => setShowScriptModal(false)}>Close Inspector</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
