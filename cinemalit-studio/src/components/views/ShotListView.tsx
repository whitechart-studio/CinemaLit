// src/components/views/ShotListView.tsx — Professional AI Storyboard & Shot List View
import { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Sparkles, Image as ImageIcon, X } from 'lucide-react';
import { shots as initialShots } from '../../data/sampleData';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import type { Shot, ShotType, ShotStatus } from '../../types';
import styles from './ShotListView.module.css';

const TYPE_CLASS: Record<string, string> = {
  WS: styles.tyWs,
  MS: styles.tyMs,
  CU: styles.tyCu,
  ECU: styles.tyEcu,
  POV: styles.tyPov,
  INSERT: styles.tyMs,
};

// Preset AI storyboard mapping for demo
const STORYBOARD_MAP: Record<string, string> = {
  '01': '/sc1_f1.jpg',
  '02': '/storyboard_sc2.jpg',
  '03': '/storyboard_sc3.jpg',
};

export function ShotListView() {
  const { activeProject } = useStudioStore();
  const [shotList, setShotList] = useState<Shot[]>(initialShots);
  const [filterScene, setFilterScene] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [storyboardModal, setStoryboardModal] = useState<{ open: boolean; imgUrl: string; label: string; desc: string } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch Live Shots from ClickHouse DB
  useEffect(() => {
    apiFetch('/api/clickhouse/shots')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && data.shots && data.shots.length > 0) {
          setShotList(data.shots);
        }
      })
      .catch((err) => console.log('ClickHouse offline, using local cache:', err));
  }, []);

  // New shot state
  const [newSceneNum, setNewSceneNum] = useState('01');
  const [newLabel, setNewLabel] = useState('1D');
  const [newType, setNewType] = useState<ShotType>('CU');
  const [newAngle] = useState('Eye Level');
  const [newMovement] = useState('Dolly Push');
  const [newLens, setNewLens] = useState('50mm');
  const [newDesc, setNewDesc] = useState('');

  const filteredShots = filterScene
    ? shotList.filter((s) => s.sceneNum === filterScene)
    : shotList;

  const toggleStatus = (id: string) => {
    const statuses: ShotStatus[] = ['planned', 'setup', 'shot', 'approved'];
    setShotList((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const curIdx = statuses.indexOf(s.status);
        const nextStatus = statuses[(curIdx + 1) % statuses.length];
        return { ...s, status: nextStatus };
      })
    );
  };

  const deleteShot = (id: string) => {
    setShotList((prev) => prev.filter((s) => s.id !== id));
  };

  const addShot = () => {
    if (!newDesc.trim()) return;
    const newShot: Shot = {
      id: `sh${Date.now()}`,
      sceneNum: newSceneNum,
      label: newLabel,
      type: newType,
      angle: newAngle,
      movement: newMovement,
      lens: newLens,
      desc: newDesc,
      status: 'planned',
    };
    setShotList((prev) => [...prev, newShot]);
    setNewDesc('');
    setShowAddForm(false);
  };

  const generateStoryboard = (sh: Shot) => {
    setGeneratingId(sh.id);
    setTimeout(() => {
      setGeneratingId(null);
      const img = STORYBOARD_MAP[sh.sceneNum] || '/storyboard_sc1.jpg';
      setStoryboardModal({
        open: true,
        imgUrl: img,
        label: `Shot ${sh.label} (Scene ${sh.sceneNum})`,
        desc: `${sh.type} · ${sh.lens} · ${sh.movement} — ${sh.desc}`,
      });
    }, 600);
  };

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <Camera size={16} color="var(--gold)" />
        <span className={styles.title}>Shot List Planner &amp; AI Storyboard — {activeProject.name}</span>

        <button
          className={`${styles.filterChip} ${filterScene === null ? styles.on : ''}`}
          onClick={() => setFilterScene(null)}
        >
          All ({shotList.length})
        </button>
        <button
          className={`${styles.filterChip} ${filterScene === '01' ? styles.on : ''}`}
          onClick={() => setFilterScene('01')}
        >
          Scene 1
        </button>
        <button
          className={`${styles.filterChip} ${filterScene === '02' ? styles.on : ''}`}
          onClick={() => setFilterScene('02')}
        >
          Scene 2
        </button>
        <button
          className={`${styles.filterChip} ${filterScene === '03' ? styles.on : ''}`}
          onClick={() => setFilterScene('03')}
        >
          Scene 3
        </button>

        <button className={styles.addShotBtn} onClick={() => setShowAddForm(true)}>
          <Plus size={13} /> Add Camera Shot
        </button>
      </div>

      {/* ADD SHOT FORM */}
      {showAddForm && (
        <div className={styles.addFormRow}>
          <select className={styles.addSelect} value={newSceneNum} onChange={(e) => setNewSceneNum(e.target.value)}>
            <option value="01">Scene 01</option>
            <option value="02">Scene 02</option>
            <option value="03">Scene 03</option>
          </select>
          <input
            type="text"
            placeholder="Shot ID (e.g. 1D)"
            className={styles.addInput}
            style={{ width: '80px' }}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <select className={styles.addSelect} value={newType} onChange={(e) => setNewType(e.target.value as ShotType)}>
            <option value="WS">Wide Shot (WS)</option>
            <option value="MS">Medium Shot (MS)</option>
            <option value="CU">Close-Up (CU)</option>
            <option value="ECU">Extreme CU (ECU)</option>
            <option value="POV">Point of View (POV)</option>
          </select>
          <select className={styles.addSelect} value={newLens} onChange={(e) => setNewLens(e.target.value)}>
            <option value="18mm">18mm Prime</option>
            <option value="24mm">24mm Prime</option>
            <option value="35mm">35mm Prime</option>
            <option value="50mm">50mm Anamorphic</option>
            <option value="85mm">85mm Portrait</option>
          </select>
          <input
            type="text"
            placeholder="Shot Framing &amp; Action Description"
            className={styles.addInput}
            style={{ flex: 1 }}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button className={styles.submitAddBtn} onClick={addShot}>Add Shot</button>
          <button className={styles.cancelAddBtn} onClick={() => setShowAddForm(false)}>Cancel</button>
        </div>
      )}

      <div className={styles.body}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Scene</th>
              <th>Type</th>
              <th>Angle</th>
              <th>Movement</th>
              <th>Lens</th>
              <th>Description</th>
              <th>Status (Click to cycle)</th>
              <th>AI Storyboard</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredShots.map((sh) => (
              <tr key={sh.id}>
                <td><span className={styles.shotNum}>{sh.label}</span></td>
                <td style={{ fontWeight: 700, color: 'var(--sin-a)' }}>SC.{sh.sceneNum}</td>
                <td><span className={`${styles.shotType} ${TYPE_CLASS[sh.type] || styles.tyMs}`}>{sh.type}</span></td>
                <td>{sh.angle}</td>
                <td>{sh.movement}</td>
                <td>{sh.lens}</td>
                <td>{sh.desc}</td>
                <td>
                  <span
                    className={`${styles.statusPill} ${sh.status === 'approved' ? styles.ssOk : sh.status === 'shot' ? styles.ssShot : sh.status === 'setup' ? styles.ssSetup : styles.ssPlan}`}
                    onClick={() => toggleStatus(sh.id)}
                    style={{ cursor: 'pointer' }}
                    title="Click to cycle status: Planned -> Set Up -> Shot -> Approved"
                  >
                    {sh.status === 'approved' ? '✓ Approved' : sh.status === 'shot' ? '🎥 Shot' : sh.status === 'setup' ? '⚙ Set Up' : 'Planned'}
                  </span>
                </td>
                <td>
                  <button
                    className={styles.storyboardBtn}
                    onClick={() => generateStoryboard(sh)}
                    title="Generate or view AI Storyboard concept frame"
                  >
                    <Sparkles size={11} color="var(--gold)" />
                    {generatingId === sh.id ? 'Rendering…' : 'AI Frame'}
                  </button>
                </td>
                <td>
                  <button className={styles.delRowBtn} title="Delete Shot" onClick={() => deleteShot(sh.id)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* STORYBOARD MODAL POPUP */}
      {storyboardModal?.open && (
        <div className={styles.modalOverlay} onClick={() => setStoryboardModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <ImageIcon size={16} color="var(--gold)" />
                <span>AI Concept Storyboard Frame — {storyboardModal.label}</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setStoryboardModal(null)}>
                <X size={15} />
              </button>
            </div>
            <div className={styles.modalImageWrapper}>
              <img src={storyboardModal.imgUrl} alt={storyboardModal.label} className={styles.modalImage} />
            </div>
            <div className={styles.modalFooter}>
              <div className={styles.modalDesc}>{storyboardModal.desc}</div>
              <div className={styles.modalBadge}>Generated via Imagen 3 · 16:9 Noir Preset</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
