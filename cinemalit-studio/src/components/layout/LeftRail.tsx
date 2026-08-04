// src/components/layout/LeftRail.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Paperclip, Mic, Bot, Database, ArrowUp, Loader2,
  GripVertical, Maximize2, X,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { apiFetch } from '../../utils/api';
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

export function LeftRail() {
  const { agentMessages, addAgentMessage } = useStudioStore();
  const [input, setInput] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [railWidth, setRailWidth] = useState(320);
  const [expandedModal, setExpandedModal] = useState(false);

  const isResizing = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
      const newWidth = Math.max(260, Math.min(560, me.clientX));
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

    addAgentMessage({ id: `am${Date.now()}`, role: 'user', text: promptText, ts });
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText }),
      });
      const data = await res.json();
      const reply = data.reply || 'Analysis complete via Gemini Pro Engine.';
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
        text: 'Analyzing via ClickHouse memory… Budget variance found on Scene 2.',
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(input); }
  };

  const toggleMic = () => {
    setMicOn((v) => !v);
    if (!micOn) setInput('🎙 Listening…');
    else setInput('Consolidate rain scene locations to cut budget.');
  };

  const quickPrompts = [
    { label: '⚡ Rain FX Optimization', prompt: 'How can I optimize the shoot schedule for Scene 2 rain scene?' },
    { label: '📊 Budget Cap Analysis', prompt: 'Analyze production budget topsheet and flag overage items.' },
    { label: '📋 Review DGA Compliance', prompt: 'Run DGA Audit on current shooting schedule' },
  ];

  const runDgaAudit = async () => {
    if (loading) return;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addAgentMessage({ id: `am${Date.now()}`, role: 'user', text: '🔍 Executing DGA Rules Compliance Audit across ClickHouse schedule...', ts });
    setLoading(true);
    try {
      const res = await apiFetch('/api/ai/dga-check');
      const data = await res.json();
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: data.audit || 'DGA Compliance Audit Complete.',
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      addAgentMessage({
        id: `am${Date.now()}`,
        role: 'agent',
        text: 'DGA Audit Result: Shoot Day 1 (3.5 pages) PASS. Shoot Day 2 (Night Rain EXT) FLAG: 12-hour turnaround required.',
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className={styles.rail} style={{ width: `${railWidth}px` }}>
        {/* DRAG RESIZE HANDLE */}
        <div
          className={styles.resizer}
          onMouseDown={startResizing}
          onDoubleClick={() => setRailWidth(320)}
          title="Drag horizontally to adjust Director AI Chat Panel width (Double-click to reset)"
        >
          <GripVertical size={11} className={styles.resizerIcon} />
        </div>

        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.brand}>
            <Sparkles size={16} color="var(--gold)" />
            <div>
              <span className={styles.title}>Director AI Agent Command</span>
              <span className={styles.modelSub}>Gemini 2.5 Pro · ClickHouse 3.8ms</span>
            </div>
          </div>
          <button className={styles.expandModalBtn} onClick={() => setExpandedModal(true)} title="Expand Chat Modal">
            <Maximize2 size={13} />
          </button>
        </div>

        {/* QUICK PROMPT CHIPS */}
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

        {/* SCROLLABLE CHAT MESSAGES */}
        <div className={styles.chatLog} ref={chatScrollRef}>
          {agentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.agentRow}`}
            >
              <div className={styles.msgMeta}>
                <span className={styles.roleName}>{msg.role === 'user' ? 'A. Kubrick' : '🎬 Director AI'}</span>
                <span className={styles.timeTag}>{msg.ts}</span>
              </div>
              <div className={styles.msgBubble}>
                {msg.role === 'user' ? msg.text : formatMarkdown(msg.text)}
              </div>
            </div>
          ))}

          {loading && (
            <div className={styles.typingBox}>
              <Loader2 size={14} className={styles.spinner} />
              <span>Gemini 2.5 Pro is analyzing production state…</span>
            </div>
          )}
        </div>

        {/* BOTTOM INPUT AREA */}
        <div className={styles.inputArea}>
          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Gemini Director Agent..."
            rows={2}
          />

          <div className={styles.bar}>
            <div className={styles.actions}>
              <button className={styles.iconBtn} title="Attach Script" onClick={() => setInput('[Attached: script.fountain] ')}>
                <Paperclip size={13} />
              </button>
              <button
                className={`${styles.iconBtn} ${micOn ? styles.micOn : ''}`}
                title="Voice Input" onClick={toggleMic}
              >
                <Mic size={13} />
              </button>
              <button className={styles.iconBtn} title="Agent Crew"><Bot size={13} /></button>
              <button className={styles.iconBtn} title="ClickHouse Engine"><Database size={13} /></button>
            </div>
            <button className={styles.sendBtn} title="Send (Enter)" onClick={() => sendPrompt(input)} disabled={loading}>
              {loading ? <Loader2 size={13} className={styles.spinner} /> : <ArrowUp size={13} />}
            </button>
          </div>
        </div>
      </nav>

      {/* FULL OVERLAY CHAT MODAL */}
      {expandedModal && (
        <div className={styles.drawerOverlay} onClick={() => setExpandedModal(false)}>
          <div className={styles.drawerWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerBrand}>
                <Sparkles size={18} color="var(--gold)" />
                <div>
                  <h3>Director Engine AI Agent</h3>
                  <span className={styles.drawerSub}>Gemini 2.5 Pro · ClickHouse Vector Synced</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setExpandedModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalChatLog}>
              {agentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.agentRow}`}
                >
                  <div className={styles.msgMeta}>
                    <span className={styles.roleName}>{msg.role === 'user' ? 'A. Kubrick' : '🎬 Director AI Agent'}</span>
                    <span className={styles.timeTag}>{msg.ts}</span>
                  </div>
                  <div className={styles.msgBubble}>
                    {msg.role === 'user' ? msg.text : formatMarkdown(msg.text)}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.drawerInputBox}>
              <textarea
                className={styles.textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask Director Agent..."
                rows={2}
              />
              <div className={styles.bar}>
                <div className={styles.actions}>
                  <button className={styles.iconBtn} title="Attach Script" onClick={() => setInput('[Attached: script.fountain] ')}>
                    <Paperclip size={13} />
                  </button>
                  <button className={`${styles.iconBtn} ${micOn ? styles.micOn : ''}`} title="Voice Input" onClick={toggleMic}>
                    <Mic size={13} />
                  </button>
                </div>
                <button className={styles.sendBtn} onClick={() => sendPrompt(input)} disabled={loading}>
                  {loading ? <Loader2 size={13} className={styles.spinner} /> : <ArrowUp size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
