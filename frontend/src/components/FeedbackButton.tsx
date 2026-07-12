import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackModal from './FeedbackModal';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        onClick={() => setOpen(true)}
        title="Send feedback"
      >
        <MessageSquarePlus size={20} />
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
