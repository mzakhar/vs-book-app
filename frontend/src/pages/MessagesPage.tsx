import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Inbox, MessageSquare, Send, Trash2 } from 'lucide-react';
import {
  deleteMessageDraft,
  getMessageDrafts,
  getMessageThread,
  getMessageThreads,
  markMessageRead,
  sendMessageDraft,
} from '../api';
import ComposeMessageModal from '../components/ComposeMessageModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { Message, MessageDraft, MessageThread, MessageThreadDetail } from '../types';

type Tab = 'inbox' | 'sent' | 'drafts';

function fmtDateTime(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sourceTitle(message: Pick<Message, 'source_type' | 'source_snapshot'>) {
  if (!message.source_type || message.source_type === 'text') return null;
  try {
    const parsed = message.source_snapshot ? JSON.parse(message.source_snapshot) : null;
    if (message.source_type === 'book') return parsed?.book?.title ? `Book: ${parsed.book.title}` : 'Book recommendation';
    if (message.source_type === 'review') return parsed?.review?.title ? `Review: ${parsed.review.title}` : 'Book review';
    if (message.source_type === 'wishlist') return 'Wishlist';
  } catch {
    return message.source_type;
  }
  return message.source_type;
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    <img className="avatar avatar--sm" src={src} alt="" />
  ) : (
    <span className="avatar avatar--sm avatar--fallback">{name.charAt(0).toUpperCase()}</span>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('inbox');
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [drafts, setDrafts] = useState<MessageDraft[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MessageThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<MessageDraft | null>(null);

  const loadThreads = useCallback(async () => {
    const data = await getMessageThreads();
    setThreads(data);
    if (!selectedThreadId && data.length > 0) setSelectedThreadId(data[0].id);
  }, [selectedThreadId]);

  const loadDrafts = useCallback(async () => {
    setDrafts(await getMessageDrafts());
  }, []);

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadThreads(), loadDrafts()]);
    } catch {
      toast('error', 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [loadDrafts, loadThreads, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!selectedThreadId) {
      setDetail(null);
      return;
    }
    getMessageThread(selectedThreadId)
      .then(async data => {
        setDetail(data);
        const unread = data.messages.filter(m => m.recipient_id === user?.id && !m.read_at);
        await Promise.all(unread.map(m => markMessageRead(m.id).catch(() => undefined)));
        if (unread.length) loadThreads().catch(() => undefined);
      })
      .catch(() => {
        toast('error', 'Failed to load conversation.');
        setDetail(null);
      });
  }, [loadThreads, selectedThreadId, toast, user?.id]);

  const selectedThread = useMemo(
    () => threads.find(t => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );
  const visibleThreads = useMemo(
    () => tab === 'sent' ? threads.filter(t => t.sent_count > 0) : threads,
    [tab, threads]
  );

  useEffect(() => {
    if (tab === 'drafts') return;
    if (visibleThreads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !visibleThreads.some(t => t.id === selectedThreadId)) {
      setSelectedThreadId(visibleThreads[0].id);
    }
  }, [selectedThreadId, tab, visibleThreads]);

  const refreshAfterChange = async () => {
    await loadAll();
    if (selectedThreadId) {
      const next = await getMessageThread(selectedThreadId).catch(() => null);
      setDetail(next);
    }
  };

  const handleSendDraft = async (draft: MessageDraft) => {
    try {
      await sendMessageDraft(draft.id);
      toast('success', 'Draft sent.');
      await refreshAfterChange();
      setTab('inbox');
      if (draft.thread_id) setSelectedThreadId(draft.thread_id);
    } catch (err: any) {
      toast('error', err?.response?.data?.error || 'Failed to send draft.');
    }
  };

  const handleDeleteDraft = async (draft: MessageDraft) => {
    if (!confirm('Delete this draft?')) return;
    try {
      await deleteMessageDraft(draft.id);
      setDrafts(ds => ds.filter(d => d.id !== draft.id));
      toast('success', 'Draft deleted.');
    } catch {
      toast('error', 'Failed to delete draft.');
    }
  };

  return (
    <div className="page messages-page">
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <p className="page-subtitle">{threads.length} conversation{threads.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setComposeOpen(true)}>
            <Send size={14} />
            New Message
          </button>
        </div>
      </div>

      <div className="view-toggle messages-tabs">
        <button
          className={`view-toggle__btn${tab === 'inbox' ? ' view-toggle__btn--active' : ''}`}
          onClick={() => setTab('inbox')}
        >
          Inbox
        </button>
        <button
          className={`view-toggle__btn${tab === 'sent' ? ' view-toggle__btn--active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent
        </button>
        <button
          className={`view-toggle__btn${tab === 'drafts' ? ' view-toggle__btn--active' : ''}`}
          onClick={() => setTab('drafts')}
        >
          Drafts{drafts.length ? ` (${drafts.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="skeleton skeleton--row" />
      ) : tab === 'drafts' ? (
        drafts.length === 0 ? (
          <div className="empty-state">
            <Edit3 size={40} />
            <p>No drafts saved.</p>
          </div>
        ) : (
          <div className="message-draft-list">
            {drafts.map(draft => {
              const recipientName = draft.recipient?.screen_name || 'Reader';
              return (
                <div key={draft.id} className="message-draft">
                  <div className="message-draft__main">
                    <div className="message-draft__to">
                      <Avatar name={recipientName} src={draft.recipient?.avatar_url} />
                      <span>To {recipientName}</span>
                      <span className="message-time">{fmtDateTime(draft.updated_at)}</span>
                    </div>
                    {sourceTitle(draft as any) && <span className="message-source">{sourceTitle(draft as any)}</span>}
                    <p>{draft.body}</p>
                  </div>
                  <div className="message-draft__actions">
                    <button className="btn btn--icon btn--ghost" title="Edit draft" onClick={() => setEditingDraft(draft)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="btn btn--icon btn--ghost" title="Send draft" onClick={() => handleSendDraft(draft)}>
                      <Send size={14} />
                    </button>
                    <button className="btn btn--icon btn--ghost" title="Delete draft" onClick={() => handleDeleteDraft(draft)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : visibleThreads.length === 0 ? (
        <div className="empty-state">
          <Inbox size={40} />
          <p>{tab === 'sent' ? 'No sent messages yet.' : 'No messages yet.'}</p>
          <button className="btn btn--primary" onClick={() => setComposeOpen(true)}>
            <Send size={14} />
            New Message
          </button>
        </div>
      ) : (
        <div className="messages-shell">
          <div className="thread-list">
            {visibleThreads.map(thread => (
              <button
                key={thread.id}
                className={`thread-item${thread.id === selectedThreadId ? ' thread-item--active' : ''}`}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <Avatar name={thread.other_user.screen_name} src={thread.other_user.avatar_url} />
                <span className="thread-item__body">
                  <span className="thread-item__name">{thread.other_user.screen_name}</span>
                  <span className="thread-item__preview">{thread.last_body || 'Draft saved'}</span>
                </span>
                {thread.unread_count > 0 && <span className="thread-item__badge">{thread.unread_count}</span>}
              </button>
            ))}
          </div>

          <div className="conversation">
            {selectedThread && (
              <div className="conversation__header">
                <div>
                  <h2>{selectedThread.other_user.screen_name}</h2>
                  <p className="page-subtitle">Conversation</p>
                </div>
                <button className="btn btn--secondary btn--sm" onClick={() => setComposeOpen(true)}>
                  <MessageSquare size={14} />
                  Reply
                </button>
              </div>
            )}

            {!detail ? (
              <div className="empty-state">
                <MessageSquare size={36} />
                <p>Select a conversation.</p>
              </div>
            ) : detail.messages.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={36} />
                <p>No messages sent yet.</p>
              </div>
            ) : (
              <div className="conversation__messages">
                {detail.messages.map(message => {
                  const mine = message.sender_id === user?.id;
                  const senderName = message.sender?.screen_name || (mine ? 'Me' : 'Reader');
                  return (
                    <div key={message.id} className={`message-bubble${mine ? ' message-bubble--mine' : ''}`}>
                      <div className="message-bubble__meta">
                        <span>{mine ? 'Me' : senderName}</span>
                        <span>{fmtDateTime(message.created_at)}</span>
                      </div>
                      {sourceTitle(message) && <span className="message-source">{sourceTitle(message)}</span>}
                      <p>{message.body}</p>
                      {mine && <span className="message-read">{message.read_at ? 'Read' : 'Sent'}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {composeOpen && (
        <ComposeMessageModal
          onClose={() => setComposeOpen(false)}
          initialRecipientId={selectedThread?.other_user.id}
          onSent={refreshAfterChange}
          onDraftSaved={refreshAfterChange}
        />
      )}

      {editingDraft && (
        <ComposeMessageModal
          draft={editingDraft}
          onClose={() => setEditingDraft(null)}
          onSent={() => { setEditingDraft(null); refreshAfterChange(); }}
          onDraftSaved={() => { setEditingDraft(null); refreshAfterChange(); }}
        />
      )}
    </div>
  );
}
