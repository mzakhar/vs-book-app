import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Plus, KeyRound, Ban, CheckCircle2, Trash2, ShieldAlert } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';
import type { ManagedUser, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    getUsers()
      .then(setUsers)
      .catch(() => toast('error', 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (me?.role === 'admin') load();
    else setLoading(false);
  }, [me, load]);

  if (me && me.role !== 'admin') {
    return (
      <div className="page">
        <div className="empty-state">
          <ShieldAlert size={36} />
          <p>You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || newPassword.length < 8) {
      setCreateError('Username is required and password must be at least 8 characters.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await createUser({ username: newUsername.trim(), password: newPassword, role: newRole });
      setUsers(u => [...u, created]);
      setShowAdd(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      toast('success', 'User created.');
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (u: ManagedUser) => {
    try {
      const updated = await updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
      setUsers(list => list.map(x => (x.id === u.id ? updated : x)));
      toast('success', updated.is_active ? 'User activated.' : 'User deactivated.');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to update user.');
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters.');
      return;
    }
    setResetting(true);
    setResetError('');
    try {
      await updateUser(resetTarget.id, { password: resetPassword });
      toast('success', `Password reset for ${resetTarget.username}.`);
      setResetTarget(null);
      setResetPassword('');
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setUsers(list => list.filter(x => x.id !== deleteTarget.id));
      toast('success', 'User deleted.');
      setDeleteTarget(null);
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 28, width: 160, marginBottom: 24 }} />
        <div className="skeleton skeleton--row" style={{ marginBottom: 12 }} />
        <div className="skeleton skeleton--row" style={{ marginBottom: 12 }} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            Add User
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <p>No users yet.</p>
        </div>
      ) : (
        <div className="user-list">
          <div className="user-row user-row--head">
            <span>Username</span>
            <span>Role</span>
            <span>Status</span>
            <span>Created</span>
            <span>Actions</span>
          </div>
          {users.map(u => {
            const isSelf = me?.id === u.id;
            return (
              <div key={u.id} className="user-row">
                <span className="user-row__username">{u.username}</span>
                <span className="tag">{u.role}</span>
                <span className={`status-badge status-badge--${u.is_active ? 'read' : 'unread'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="user-row__date">{new Date(u.created_at).toLocaleDateString()}</span>
                <span className="user-row__actions">
                  <button
                    className="btn btn--secondary btn--sm btn--icon"
                    title="Reset password"
                    onClick={() => { setResetTarget(u); setResetPassword(''); setResetError(''); }}
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    className="btn btn--secondary btn--sm btn--icon"
                    title={u.is_active ? 'Deactivate' : 'Activate'}
                    disabled={isSelf}
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.is_active ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                  </button>
                  <button
                    className="btn btn--danger btn--sm btn--icon"
                    title="Delete"
                    disabled={isSelf}
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)} size="sm">
          <form onSubmit={handleCreate}>
            {createError && <p className="form-error">{createError}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="new-username">Username</label>
              <input
                id="new-username"
                className="form-input"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">Password</label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="new-role">Role</label>
              <select
                id="new-role"
                className="form-select"
                value={newRole}
                onChange={e => setNewRole(e.target.value as UserRole)}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn--primary" disabled={creating} style={{ marginTop: 8 }}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset password for ${resetTarget.username}`} onClose={() => setResetTarget(null)} size="sm">
          <form onSubmit={handleResetPassword}>
            {resetError && <p className="form-error">{resetError}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                className="form-input"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={resetting} style={{ marginTop: 8 }}>
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete user"
          onClose={() => setDeleteTarget(null)}
          size="sm"
          footer={
            <>
              <button className="btn btn--secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete User'}
              </button>
            </>
          }
        >
          <p>
            Delete <strong>{deleteTarget.username}</strong>? This permanently deletes their entire library
            (books, series, notes). This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
