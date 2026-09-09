// src/components/layout/LeftRail.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, ArrowUp, Loader2, GripVertical, Maximize2, Bot, User, Paperclip, X, FileText,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { apiFetch } from '../../utils/api';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import styles from './LeftRail.module.css';

// Markdown Text Renderer for clean HTML formatting
function formatMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let clean = line.trim();
    if (!clean) return <div key={idx} className={styles.mdBlank} />;

    if (clean.startsWith('### ')) {
      return <h4 key={idx} className={styles.mdH3}>{clean.replace('### ', '')}</h4>;
    }
    if (clean.startsWith('## ')) {
      return <h3 key={idx} className={styles.mdH2}>{clean.replace('## ', '')}</h3>;
    }
    if (clean.startsWith('---')) {
      return <hr key={idx} className={styles.mdHr} />;
    }

    const parts = clean.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((p, pIdx) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={pIdx}>{p.slice(2, -2)}</strong>;
      }
      return p;
    });

    if (clean.startsWith('* ') || clean.startsWith('- ')) {
      return <li key={idx} className={styles.mdLi}>{content}</li>;
    }

    return <p key={idx} className={styles.mdP}>{content}</p>;
  });
}

const ACCEPTED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB — matches server.py's cap

interface PendingAttachment {
  name: string;
  mimeType: string;
  base64: string; // raw base64 payload, no data: URL prefix
}

export function LeftRail() {
  const { chatOpen, agentMessages, addAgentMessage, activeProject, user } = useStudioStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [railWidth, setRailWidth] = useState(280);
  const [expandedModal, setExpandedModal] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachError, setAttachError] = useState('');

  const isResizing = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      setAttachError('Only images (PNG/JPEG/WEBP/GIF) and PDF are supported.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError('Attachment too large — 15MB max.');
      return;
    }
    setAttachError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      setAttachment({ name: file.name, mimeType: file.type, base64 });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [agentMessages, loading]);

  // Horizontal Drag Resize Logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();

    const onMouseMove = (me: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(240, Math.min(520, me.clientX));
      setRailWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const sendPrompt = async (promptText: string) => {
    if (!promptText.trim() || loading) return;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const pendingAttachment = attachment;

    addAgentMessage({ id: `am${Date.now()}`, role: 'user', text: promptText, ts, attachmentName: pendingAttachment?.name });
    setInput('');
    setAttachment(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          projectId: activeProject.id,
          ...(pendingAttachment ? { fileData: pendingAttachment.base64, fileMimeType: pendingAttachment.mimeType } : {}),
        }),
      });
      const data = await res.json();
      const reply = data.reply || (data.error ? `⚠️ ${data.error}` : '⚠️ No response received from the AI agent.');
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: reply,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: '⚠️ Could not reach the AI agent — check that the server is running.',
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(input); }
  };

  const quickPrompts = [
    { label: 'Rain FX Optimization', prompt: 'How can I optimize the shoot schedule for Scene 2 rain scene?' },
    { label: 'Budget Cap Analysis', prompt: 'Analyze production budget topsheet and flag overage items.' },
    { label: 'Review DGA Compliance', prompt: 'Run DGA Audit on current shooting schedule' },
  ];

  const runDgaAudit = async () => {
    if (loading) return;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addAgentMessage({ id: `am${Date.now()}`, role: 'user', text: '🔍 Executing DGA Rules Compliance Audit across ClickHouse schedule...', ts });
    setLoading(true);
    try {
      const res = await apiFetch('/api/ai/dga-check', { method: 'POST' });
      const data = await res.json();
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: data.audit || (data.error ? `⚠️ ${data.error}` : '⚠️ No audit result received.'),
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: '⚠️ Could not reach the AI agent — check that the server is running.',
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setLoading(false);
    }
  };

  const userDisplayName = user?.name || 'You';

  const chatMessages = (className: string) => (
    <div className={className} ref={className === styles.chatLog ? chatScrollRef : undefined}>
      {agentMessages.map((msg) => (
        <div
          key={msg.id}
          className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.agentRow}`}
        >
          <div className={styles.msgMeta}>
            {msg.role === 'user' ? <User size={11} /> : <Bot size={11} />}
            <span className={styles.roleName}>{msg.role === 'user' ? userDisplayName : 'Director AI'}</span>
            <span className={styles.timeTag}>{msg.ts}</span>
          </div>
          <div className={styles.msgBubble}>
            {msg.attachmentName && (
              <div className={styles.attachTag}>
                <Paperclip size={10} /> {msg.attachmentName}
              </div>
            )}
            {msg.role === 'user' ? msg.text : formatMarkdown(msg.text)}
          </div>
        </div>
      ))}

      {loading && (
        <div className={styles.typingBox}>
          <Loader2 size={14} className={styles.spinner} />
          <span>Director AI is analyzing production state…</span>
        </div>
      )}
    </div>
  );

  if (!chatOpen) return null;

  return (
    <>
      <nav className={styles.rail} style={{ width: `${railWidth}px` }}>
        {/* DRAG RESIZE HANDLE */}
        <div
          className={styles.resizer}
          onMouseDown={startResizing}
          onDoubleClick={() => setRailWidth(280)}
          title="Drag horizontally to adjust Director AI Chat Panel width (Double-click to reset)"
        >
          <GripVertical size={11} className={styles.resizerIcon} />
        </div>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.brand}>
            <Sparkles size={16} color="var(--accent)" />
            <span className={styles.title}>Director AI</span>
          </div>
          <button className={styles.expandModalBtn} onClick={() => setExpandedModal(true)} title="Expand Chat Modal">
            <Maximize2 size={13} />
          </button>
        </div>

        {/* SCROLLABLE CHAT MESSAGES */}
        {chatMessages(styles.chatLog)}

        {/* QUICK PROMPT CHIPS — sit just above the input, not competing with the chat for top-of-panel space */}
        <div className={styles.quickBar}>
          {quickPrompts.map((qp, i) => (
            <button
              key={i}
              className={styles.qpChip}
              onClick={() => {
                if (qp.label.includes('DGA')) runDgaAudit();
                else sendPrompt(qp.prompt);
              }}
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* BOTTOM INPUT AREA */}
        {(attachment || attachError) && (
          <div className={styles.attachPreviewRow}>
            {attachment && (
              <div className={styles.attachChip}>
                {attachment.mimeType === 'application/pdf' ? <FileText size={11} /> : <Paperclip size={11} />}
                <span>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} title="Remove attachment"><X size={11} /></button>
              </div>
            )}
            {attachError && <span className={styles.attachError}>{attachError}</span>}
          </div>
        )}
        <div className={styles.inputArea}>
          <button className={styles.attachBtn} title="Attach an image or PDF" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={14} />
          </button>
          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Director Agent..."
            rows={2}
          />
          <button className={styles.sendBtn} title="Send (Enter)" onClick={() => sendPrompt(input)} disabled={loading}>
            {loading ? <Loader2 size={13} className={styles.spinner} /> : <ArrowUp size={13} />}
          </button>
        </div>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* FULL CHAT MODAL */}
      <Dialog open={expandedModal} onOpenChange={setExpandedModal}>
        <DialogContent className="flex h-[82vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Director Engine AI Agent Chat</DialogTitle>
          <div className={styles.drawerHeader}>
            <div className={styles.drawerBrand}>
              <Sparkles size={18} color="var(--accent)" />
              <h3>Director AI</h3>
            </div>
          </div>

          {chatMessages(styles.modalChatLog)}

          {(attachment || attachError) && (
            <div className={styles.attachPreviewRow}>
              {attachment && (
                <div className={styles.attachChip}>
                  {attachment.mimeType === 'application/pdf' ? <FileText size={11} /> : <Paperclip size={11} />}
                  <span>{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} title="Remove attachment"><X size={11} /></button>
                </div>
              )}
              {attachError && <span className={styles.attachError}>{attachError}</span>}
            </div>
          )}
          <div className={styles.drawerInputBox}>
            <button className={styles.attachBtn} title="Attach an image or PDF" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={14} />
            </button>
            <textarea
              className={styles.textarea}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Director Agent..."
              rows={2}
            />
            <button className={styles.sendBtn} onClick={() => sendPrompt(input)} disabled={loading}>
              {loading ? <Loader2 size={13} className={styles.spinner} /> : <ArrowUp size={13} />}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
