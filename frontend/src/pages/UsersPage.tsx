import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Plus, Mail, Ban, CheckCircle2, Trash2, ShieldAlert } from 'lucide-react';
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
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [emailTarget, setEmailTarget] = useState<ManagedUser | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

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
    if (!newUsername.trim() || !newEmail.trim()) {
      setCreateError('Username and Google email address are both required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await createUser({ username: newUsername.trim(), email: newEmail.trim(), role: newRole });
      setUsers(u => [...u, created]);
      setShowAdd(false);
      setNewUsername('');
      setNewEmail('');
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

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailTarget) return;
    setSavingEmail(true);
    setEmailError('');
    try {
      const updated = await updateUser(emailTarget.id, { email: emailValue.trim() });
      setUsers(list => list.map(x => (x.id === updated.id ? updated : x)));
      toast('success', `Sign-in email updated for ${emailTarget.username}.`);
      setEmailTarget(null);
      setEmailValue('');
    } catch (err: any) {
      setEmailError(err.response?.data?.error || 'Failed to update email.');
    } finally {
      setSavingEmail(false);
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
            <span>Google email</span>
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
                <span className="user-row__email">{u.email || <em>not set — cannot sign in</em>}</span>
                <span className="tag">{u.role}</span>
                <span className={`status-badge status-badge--${u.is_active ? 'read' : 'unread'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="user-row__date">{new Date(u.created_at).toLocaleDateString()}</span>
                <span className="user-row__actions">
                  <button
                    className="btn btn--secondary btn--sm btn--icon"
                    title="Change sign-in email"
                    onClick={() => { setEmailTarget(u); setEmailValue(u.email || ''); setEmailError(''); }}
                  >
                    <Mail size={14} />
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
              <label className="form-label" htmlFor="new-email">Google email</label>
              <input
                id="new-email"
                type="email"
                className="form-input"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                autoComplete="off"
                placeholder="reader@gmail.com"
              />
              <p className="form-hint">Must match the Google account they sign in with.</p>
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

      {emailTarget && (
        <Modal title={`Sign-in email for ${emailTarget.username}`} onClose={() => setEmailTarget(null)} size="sm">
          <form onSubmit={handleSaveEmail}>
            {emailError && <p className="form-error">{emailError}</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-email">Google email</label>
              <input
                id="edit-email"
                type="email"
                className="form-input"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                autoFocus
                autoComplete="off"
              />
              <p className="form-hint">Changing this signs them out everywhere.</p>
            </div>
            <button type="submit" className="btn btn--primary" disabled={savingEmail} style={{ marginTop: 8 }}>
              {savingEmail ? 'Saving…' : 'Save Email'}
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
