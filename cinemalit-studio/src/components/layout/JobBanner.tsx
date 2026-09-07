// src/components/layout/JobBanner.tsx
import { Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import styles from './JobBanner.module.css';

/** Live progress for whatever the Director Agent is doing in the background. */
export function JobBanner() {
  const { job } = useStudioStore();
  if (!job) return null;

  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const failed = job.status === 'error';
  const finished = job.status === 'done' || job.status === 'partial';

  return (
    <div className={`${styles.banner} ${failed ? styles.failed : ''}`}>
      {failed ? (
        <AlertTriangle size={14} color="var(--red)" />
      ) : finished ? (
        <CheckCircle2 size={14} color="var(--grn)" />
      ) : (
        <Sparkles size={14} color="var(--cyan)" />
      )}

      <strong className={styles.label}>Director Agent</strong>
      <span className={styles.message}>{job.error || job.message || 'Working…'}</span>

      {job.total > 0 && (
        <div className={styles.track}>
          <div className={`${styles.fill} ${failed ? styles.failed : ''}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      {job.total > 0 && (
        <span className={styles.count}>
          {job.done}/{job.total}
        </span>
      )}
    </div>
  );
}
