// src/components/views/ShotListView.tsx — Professional AI Storyboard & Shot List View
import { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Sparkles, Image as ImageIcon, X, ChevronDown } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useStudioStore } from '../../store/studio';
import type { Shot, ShotType, ShotStatus } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import styles from './ShotListView.module.css';

const TYPE_CLASS: Record<string, string> = {
  WS: styles.tyWs,
  MS: styles.tyMs,
  CU: styles.tyCu,
  ECU: styles.tyEcu,
  POV: styles.tyPov,
  INSERT: styles.tyMs,
};

const ANGLE_OPTIONS = ['Eye Level', 'High Angle', 'Low Angle', "Bird's Eye", 'Dutch'];
const MOVEMENT_OPTIONS = ['Static', 'Dolly Push', 'Dolly Pull', 'Pan', 'Tilt', 'Crane', 'Handheld'];

// Preset AI storyboard mapping for demo
const STORYBOARD_MAP: Record<string, string> = {
  '01': '/sc1_f1.jpg',
  '02': '/storyboard_sc2.jpg',
  '03': '/storyboard_sc3.jpg',
};

export function ShotListView() {
  const { activeProject } = useStudioStore();
  // Starts empty — a project with no shots yet reads as "no shots", never a
  // flash of fabricated demo rows before the real ClickHouse fetch lands.
  const [shotList, setShotList] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  // Which scenes are expanded — multiple can be open at once (accordion,
  // not a single-scene picker), per how a shot list is actually worked from.
  const [openScenes, setOpenScenes] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [storyboardModal, setStoryboardModal] = useState<{ open: boolean; imgUrl: string; label: string; desc: string } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Fetch Live Shots from ClickHouse DB
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/clickhouse/shots?projectId=${activeProject.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok' && Array.isArray(data.shots)) {
          setShotList(data.shots);
        }
      })
      .catch((err) => console.log('ClickHouse offline, using local cache:', err))
      .finally(() => setLoading(false));
  }, [activeProject.id]);

  const sceneNums = Array.from(new Set(shotList.map((s) => s.sceneNum))).sort();

  // Open the first scene once shots are known, so the list isn't fully
  // collapsed on first load.
  useEffect(() => {
    if (sceneNums.length > 0) setOpenScenes((prev) => (prev.length > 0 ? prev : [sceneNums[0]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneNums.join(',')]);

  const toggleScene = (num: string) => {
    setOpenScenes((prev) => (prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]));
  };

  // New shot state
  const [newSceneNum, setNewSceneNum] = useState('01');
  const [newLabel, setNewLabel] = useState('1D');
  const [newType, setNewType] = useState<ShotType>('CU');
  const [newAngle, setNewAngle] = useState('Eye Level');
  const [newMovement, setNewMovement] = useState('Dolly Push');
  const [newLens, setNewLens] = useState('50mm');
  const [newDesc, setNewDesc] = useState('');

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
    setOpenScenes((prev) => (prev.includes(newSceneNum) ? prev : [...prev, newSceneNum]));
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
        <Camera size={16} color="var(--accent)" className={styles.titleIcon} />
        <span className={styles.title}>Shot List Planner &amp; AI Storyboard — {activeProject.name}</span>
        <button className={styles.addShotBtn} onClick={() => setShowAddForm(true)}>
          <Plus size={13} /> Add Camera Shot
        </button>
      </div>

      {/* ADD SHOT FORM */}
      {showAddForm && (
        <div className={styles.addFormRow}>
          <Select value={newSceneNum} onValueChange={setNewSceneNum}>
            <SelectTrigger size="sm" className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="01">Scene 01</SelectItem>
              <SelectItem value="02">Scene 02</SelectItem>
              <SelectItem value="03">Scene 03</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Shot ID (e.g. 1D)"
            className="w-20"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Select value={newType} onValueChange={(v) => setNewType(v as ShotType)}>
            <SelectTrigger size="sm" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WS">Wide Shot (WS)</SelectItem>
              <SelectItem value="MS">Medium Shot (MS)</SelectItem>
              <SelectItem value="CU">Close-Up (CU)</SelectItem>
              <SelectItem value="ECU">Extreme CU (ECU)</SelectItem>
              <SelectItem value="POV">Point of View (POV)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newAngle} onValueChange={setNewAngle}>
            <SelectTrigger size="sm" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANGLE_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newMovement} onValueChange={setNewMovement}>
            <SelectTrigger size="sm" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOVEMENT_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newLens} onValueChange={setNewLens}>
            <SelectTrigger size="sm" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="18mm">18mm Prime</SelectItem>
              <SelectItem value="24mm">24mm Prime</SelectItem>
              <SelectItem value="35mm">35mm Prime</SelectItem>
              <SelectItem value="50mm">50mm Anamorphic</SelectItem>
              <SelectItem value="85mm">85mm Portrait</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Shot Framing &amp; Action Description"
            className="flex-1 min-w-[200px]"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <Button size="sm" onClick={addShot}>Add Shot</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
        </div>
      )}

      <div className={styles.body}>
        {loading && (
          <div className={styles.sceneGroup}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full mt-2" />
            <Skeleton className="h-8 w-full mt-1" />
          </div>
        )}

        {!loading && sceneNums.length === 0 && (
          <div className={styles.emptyPanel}>No shots yet — add one above.</div>
        )}

        {!loading && sceneNums.map((num) => {
          const sceneShots = shotList.filter((s) => s.sceneNum === num);
          const isOpen = openScenes.includes(num);
          return (
            <div key={num} className={styles.sceneGroup}>
              <button className={styles.sceneHeader} onClick={() => toggleScene(num)}>
                <ChevronDown size={14} className={`${styles.sceneChevron} ${isOpen ? styles.sceneChevronOpen : ''}`} />
                <span className={styles.sceneHeaderLabel}>Scene {num}</span>
                <span className={styles.sceneHeaderCount}>{sceneShots.length} shot{sceneShots.length === 1 ? '' : 's'}</span>
              </button>

              {isOpen && (
                <Table className={styles.table}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Angle</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Lens</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status (Click to cycle)</TableHead>
                      <TableHead>AI Storyboard</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sceneShots.map((sh) => (
                      <TableRow key={sh.id}>
                        <TableCell><span className={styles.shotNum}>{sh.label}</span></TableCell>
                        <TableCell><span className={`${styles.shotType} ${TYPE_CLASS[sh.type] || styles.tyMs}`}>{sh.type}</span></TableCell>
                        <TableCell>{sh.angle}</TableCell>
                        <TableCell>{sh.movement}</TableCell>
                        <TableCell>{sh.lens}</TableCell>
                        <TableCell>{sh.desc}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${styles.statusPill} ${sh.status === 'approved' ? styles.ssOk : sh.status === 'shot' ? styles.ssShot : sh.status === 'setup' ? styles.ssSetup : styles.ssPlan} cursor-pointer`}
                            onClick={() => toggleStatus(sh.id)}
                            title="Click to cycle status: Planned -> Set Up -> Shot -> Approved"
                          >
                            {sh.status === 'approved' ? '✓ Approved' : sh.status === 'shot' ? '🎥 Shot' : sh.status === 'setup' ? '⚙ Set Up' : 'Planned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            className={styles.storyboardBtn}
                            onClick={() => generateStoryboard(sh)}
                            title="Generate or view AI Storyboard concept frame"
                          >
                            <Sparkles size={11} color="var(--accent)" />
                            {generatingId === sh.id ? 'Rendering…' : 'AI Frame'}
                          </button>
                        </TableCell>
                        <TableCell>
                          <button className={styles.delRowBtn} title="Delete Shot" onClick={() => deleteShot(sh.id)}>
                            <Trash2 size={12} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>

      {/* STORYBOARD MODAL POPUP */}
      <Dialog open={!!storyboardModal?.open} onOpenChange={(open) => !open && setStoryboardModal(null)}>
        <DialogContent className={`${styles.modalCard} p-0 gap-0`} showCloseButton={false}>
          {storyboardModal && (
            <>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitleRow}>
                  <ImageIcon size={16} color="var(--accent)" />
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
