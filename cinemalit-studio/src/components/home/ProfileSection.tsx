// src/components/home/ProfileSection.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { useStudioStore } from '../../store/studio';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import styles from './HomePage.module.css';

export function ProfileSection() {
  const { user, updateProfile, deleteAccount } = useStudioStore();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const dirty = name.trim() !== user.name && name.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(name.trim());
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete account.');
      setDeleting(false);
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Profile</h2>
          <p>Your account identity across every production in this studio.</p>
        </div>
      </div>

      <div className={styles.settingsForm}>
        <div className={styles.profileHeader}>
          <img src={user.avatar} alt={user.name} className={styles.profileAvatar} />
          <div>
            <div className={styles.profileEmail}>{user.email}</div>
            <div className={styles.profileRole}>{user.role}</div>
          </div>
        </div>

        <div className={styles.setGroup}>
          <label>Name</label>
          <input
            type="text"
            className={styles.setInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <button className={styles.heroPrimaryBtnSm} onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      <div className={styles.dangerZone}>
        <div>
          <h3>Delete Account</h3>
          <p>Permanently deletes your profile and every production you own. This cannot be undone.</p>
        </div>
        <button className={styles.dialogDeleteBtn} onClick={() => setConfirmOpen(true)}>
          Delete My Account
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your profile and every production you own, along
              with all of their scenes, budgets, shots, and storyboards. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className={styles.dialogCancelBtn} onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </button>
            <button className={styles.dialogDeleteBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Account'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
