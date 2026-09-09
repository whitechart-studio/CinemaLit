// src/components/home/ProjectCard.tsx
import { ArrowRight, FileText, Trash2 } from 'lucide-react';
import type { Project } from '../../types';
import styles from './HomePage.module.css';

interface Props {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project: p, onOpen, onDelete }: Props) {
  return (
    <div className={styles.projectCard} onClick={onOpen}>
      <div className={styles.cardHeader}>
        <span className={styles.phaseBadge}>{p.phase}</span>
        <div className={styles.cardHeaderRight}>
          <span className={styles.timeAgo}>{p.updatedAt}</span>
          <button
            className={styles.cardDeleteBtn}
            title="Delete production"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={13} />
          </button>
        </div>
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
  );
}
