import { useState, FormEvent } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { submitFeedback } from '../api';
import type { FeedbackType } from '../types';

interface Props {
  onClose: () => void;
}

export default function FeedbackModal({ onClose }: Props) {
  const { toast } = useToast();
  const [type, setType] = useState<FeedbackType>('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { issueNumber } = await submitFeedback(type, description.trim());
      toast('success', `Filed as issue #${issueNumber}`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit feedback.');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Send Feedback" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}
        <div className="form-group">
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={type}
            onChange={e => setType(e.target.value as FeedbackType)}
          >
            <option value="bug">Bug</option>
            <option value="feature">Feature request</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's on your mind?"
            rows={5}
            autoFocus
          />
        </div>
        <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: '16px' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={submitting || !description.trim()}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
