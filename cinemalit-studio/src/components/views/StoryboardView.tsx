// src/components/views/StoryboardView.tsx — Customized Time Interval & Duration Storyboard Generator
import { useState, useEffect } from 'react';
import { Sparkles, Film, ZoomIn, Clock, Settings2, Trash2, FileText, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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

// Format seconds to MM:SS — pure, no component state needed.
function formatTime(totalSec: number) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Local math fallback used when the live Gemini storyboard generation is
// unavailable or returns no frames — computes evenly-spaced keyframes from
// the scene's total duration so the grid isn't left empty.
function buildFallbackFrames(totalSec: number, interval: number, customPrompt: string, customLens: string): StoryboardFrame[] {
  const step = Math.max(1, interval);
  const frameCount = Math.ceil(totalSec / step);
  const imgs = ['/sc1_f1.jpg', '/sc1_f2.jpg', '/sc1_f3.jpg'];
  const frames: StoryboardFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const startSec = i * step;
    const endSec = Math.min(totalSec, (i + 1) * step);
    frames.push({
      id: `f-${Date.now()}-${i}`,
      frameNum: i + 1,
      title: `Frame ${String(i + 1).padStart(2, '0')} — Preview frame`,
      imgUrl: imgs[i % imgs.length],
      prompt: customPrompt.trim() || `Preview frame at ${formatTime(startSec)}`,
      cameraSpec: `${customLens} · Action Keyframe`,
      startSec,
      endSec,
      timing: `${formatTime(startSec)} - ${formatTime(endSec)} (${step}s interval)`,
    });
  }
  return frames;
}

export function StoryboardView() {
  const { activeProject } = useStudioStore();
  // Starts empty — no fabricated demo scenes flashed before the real
  // ClickHouse fetch resolves.
  const [storyboards, setStoryboards] = useState<SceneStoryboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSceneNum, setSelectedSceneNum] = useState<string>('');
  const [generatingScene, setGeneratingScene] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<{ url: string; title: string; spec: string } | null>(null);

  // Custom Controls State
  const [customInterval, setCustomInterval] = useState<number>(5);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customLens, setCustomLens] = useState<string>('50mm Anamorphic');
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Fetch Live Scenes from ClickHouse Database for Active Project
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/clickhouse/scenes?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && Array.isArray(data.scenes) && data.scenes.length > 0) {
          setStoryboards(data.scenes);
          setSelectedSceneNum(data.scenes[0].sceneNum);
        }
      })
      .catch((err) => console.log('ClickHouse offline, using local cache:', err))
      .finally(() => setLoading(false));
  }, [activeProject.id]);

  const activeSb = storyboards.find((s) => s.sceneNum === selectedSceneNum) || storyboards[0];

  // Full Sequence Generator: Real Gemini API Script Analysis & Storyboard Breakdown
  const generateFullSequence = async (sceneNum: string) => {
    setGeneratingScene(sceneNum);
    try {
      const resp = await apiFetch('/api/ai/generate-storyboard', {
        method: 'POST',
        body: JSON.stringify({
          projectId: activeProject.id,
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
        const fallbackFrames = buildFallbackFrames(activeSb.totalDurationSec, customInterval, customPrompt, customLens);
        setStoryboards((prev) =>
          prev.map((sb) => (sb.sceneNum === sceneNum ? { ...sb, frames: fallbackFrames } : sb))
        );
      }
    } catch {
      // Fallback
      const fallbackFrames = buildFallbackFrames(activeSb.totalDurationSec, customInterval, customPrompt, customLens);
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

  if (loading) {
    return (
      <div className={styles.view}>
        <div className={styles.side}>
          <div className={styles.sideHeader}>
            <Film size={14} color="var(--accent)" />
            <span>Scene Sequences</span>
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className={styles.main}>
          <div className={styles.header}>
            <Skeleton className="h-5 w-64" />
          </div>
          <div className={styles.grid}>
            <Skeleton className="h-full w-full" />
            <Skeleton className="h-full w-full" />
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeSb) {
    return (
      <div className={styles.view}>
        <div className={styles.emptyView}>
          No scenes yet — import a script from the Screenplay tab to generate storyboards.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      {/* SIDEBAR SCENE LIST */}
      <div className={styles.side}>
        <div className={styles.sideHeader}>
          <Film size={14} color="var(--accent)" />
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={10} /> Total: {formatTime(sb.totalDurationSec)}
              </span>
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

          <div className={styles.headerActions}>
            <button
              className={styles.readScriptBtn}
              onClick={() => setShowScriptModal(true)}
              title="Read raw scene screenplay to compare with storyboard frames"
            >
              <FileText size={14} color="var(--accent)" />
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
            <Settings2 size={13} color="var(--accent)" />
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
                : `Generate Sequence (${Math.ceil(activeSb.totalDurationSec / Math.max(1, customInterval))} Frames @ ${customInterval}s)`}
            </button>
          </div>
        </div>

        {/* FRAME GRID SEQUENCE */}
        <div className={styles.grid}>
          {generatingScene === activeSb.sceneNum ? (
            Array.from({ length: Math.ceil(activeSb.totalDurationSec / Math.max(1, customInterval)) }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className={`${styles.frameCard} h-full w-full`} />
            ))
          ) : activeSb.frames.map((fr) => (
            <div key={fr.id} className={styles.frameCard}>
              <div className={styles.imgWrapper} onClick={() => setPreviewImg({ url: fr.imgUrl, title: fr.title, spec: fr.cameraSpec })}>
                <img src={fr.imgUrl} alt={fr.title} className={styles.frameImg} />
                <div className={styles.imgOverlay}>
                  <ZoomIn size={20} color="#fff" />
                </div>
                <div className={styles.timeTag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} /> {fr.timing}
                </div>
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
                  <FileText size={12} color="var(--accent)" />
                  <span>Read Scene Script</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PREVIEW MODAL */}
      <Dialog open={!!previewImg} onOpenChange={(open) => !open && setPreviewImg(null)}>
        <DialogContent className={`${styles.modalCard} p-0 gap-0`} showCloseButton={false}>
          {previewImg && (
            <>
              <img src={previewImg.url} alt={previewImg.title} className={styles.modalImg} />
              <div className={styles.modalFooter}>
                <div>
                  <div className={styles.modalTitle}>{previewImg.title}</div>
                  <div className={styles.modalSub}>{previewImg.spec}</div>
                </div>
                <button className={styles.closeBtn} onClick={() => setPreviewImg(null)}>Close</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* SCREENPLAY SCRIPT INSPECTOR MODAL */}
      <Dialog open={showScriptModal} onOpenChange={setShowScriptModal}>
        <DialogContent className={`${styles.scriptModalCard} p-0 gap-0`} showCloseButton={false}>
          <div className={styles.scriptModalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--accent)" />
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
            <button className={styles.closeBtn} onClick={() => setShowScriptModal(false)}>Close Inspector</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
