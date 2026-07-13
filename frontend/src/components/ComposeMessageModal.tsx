import { useEffect, useMemo, useState } from 'react';
import { Save, Send, UserCircle2 } from 'lucide-react';
import Modal from './Modal';
import { createMessageDraft, getUserProfiles, sendMessage, sendMessageDraft, updateMessageDraft } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import type { MessageDraft, MessagePayload, MessageSourceType, UserSummary } from '../types';

interface ComposeMessageModalProps {
  onClose: () => void;
  onSent?: () => void;
  onDraftSaved?: () => void;
  initialRecipientId?: number;
  initialBody?: string;
  sourceType?: MessageSourceType | null;
  sourceBookId?: number | null;
  sourceNoteId?: number | null;
  draft?: MessageDraft | null;
}

export default function ComposeMessageModal({
  onClose,
  onSent,
  onDraftSaved,
  initialRecipientId,
  initialBody = '',
  sourceType = null,
  sourceBookId = null,
  sourceNoteId = null,
  draft = null,
}: ComposeMessageModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [readers, setReaders] = useState<UserSummary[]>([]);
  const [recipientId, setRecipientId] = useState<number | ''>(draft?.recipient_id ?? initialRecipientId ?? '');
  const [body, setBody] = useState(draft?.body ?? initialBody);
  const [saving, setSaving] = useState<'send' | 'draft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUserProfiles()
      .then(users => setReaders(users.filter(r => r.id !== user?.id)))
      .catch(() => toast('error', 'Failed to load readers.'));
  }, [toast, user?.id]);

  const payload = useMemo<MessagePayload | null>(() => {
    if (!recipientId || !body.trim()) return null;
    return {
      recipient_id: Number(recipientId),
      body: body.trim(),
      source_type: draft?.source_type ?? sourceType ?? null,
      source_book_id: draft?.source_book_id ?? sourceBookId ?? null,
      source_note_id: draft?.source_note_id ?? sourceNoteId ?? null,
    };
  }, [body, draft, recipientId, sourceBookId, sourceNoteId, sourceType]);

  const validate = () => {
    if (!recipientId) return 'Choose a reader.';
    if (!body.trim()) return 'Write a message.';
    if (body.trim().length > 5000) return 'Message must be under 5000 characters.';
    return null;
  };

  const handleSend = async () => {
    const validation = validate();
    if (validation || !payload) {
      setError(validation);
      return;
    }
    setSaving('send');
    setError(null);
    try {
      if (draft) {
        await updateMessageDraft(draft.id, payload);
        await sendMessageDraft(draft.id);
      } else {
        await sendMessage(payload);
      }
      toast('success', 'Message sent.');
      onSent?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send message.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveDraft = async () => {
    const validation = validate();
    if (validation || !payload) {
      setError(validation);
      return;
    }
    setSaving('draft');
    setError(null);
    try {
      if (draft) {
        await updateMessageDraft(draft.id, payload);
      } else {
        await createMessageDraft(payload);
      }
      toast('success', 'Draft saved.');
      onDraftSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save draft.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      title={draft ? 'Edit Draft' : 'New Message'}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={!!saving}>
            Cancel
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleSaveDraft} disabled={!!saving}>
            <Save size={14} />
            {saving === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSend} disabled={!!saving}>
            <Send size={14} />
            {saving === 'send' ? 'Sending...' : 'Send'}
          </button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label" htmlFor="message-recipient">To</label>
        <div className="message-recipient">
          <UserCircle2 size={16} />
          <select
            id="message-recipient"
            className="form-select"
            value={recipientId}
            onChange={e => setRecipientId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Choose reader</option>
            {readers.map(reader => (
              <option key={reader.id} value={reader.id}>
                {reader.screen_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="message-body">Message</label>
        <textarea
          id="message-body"
          className="form-textarea message-compose__body"
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={5000}
          placeholder="Write a message..."
        />
        <span className="message-compose__count">{body.trim().length}/5000</span>
      </div>

      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
