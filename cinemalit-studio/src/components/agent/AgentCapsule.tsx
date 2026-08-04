// src/components/agent/AgentCapsule.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, Mic, Bot, Database, ArrowUp, Loader2, Maximize2, X, Sparkles, GripHorizontal } from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { apiFetch } from '../../utils/api';
import styles from './AgentCapsule.module.css';

// Markdown Text Renderer
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

export function AgentCapsule() {
  const [input, setInput] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [capsuleHeight, setCapsuleHeight] = useState(300);

  const { agentMessages, addAgentMessage } = useStudioStore();
  const inlineScrollRef = useRef<HTMLDivElement>(null);
  const isVResizing = useRef(false);

  useEffect(() => {
    if (inlineScrollRef.current) {
      inlineScrollRef.current.scrollTop = inlineScrollRef.current.scrollHeight;
    }
  }, [agentMessages, capsuleHeight]);

  // Vertical Resize Handler (Drag Upwards)
  const startVResizing = useCallback((e: React.MouseEvent) => {
    isVResizing.current = true;
    e.preventDefault();
    const startY = e.clientY;
    const startH = capsuleHeight;

    const onMouseMove = (me: MouseEvent) => {
      if (!isVResizing.current) return;
      const dy = startY - me.clientY;
      const newHeight = Math.max(160, Math.min(650, startH + dy));
      setCapsuleHeight(newHeight);
    };

    const onMouseUp = () => {
      isVResizing.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [capsuleHeight]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    addAgentMessage({ id: `am${Date.now()}`, role: 'user', text: userText, ts });
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleMic = () => {
    setMicOn((v) => !v);
    if (!micOn) setInput('🎙 Listening…');
    else setInput('Consolidate rain scene locations to cut budget.');
  };

  return (
    <>
      {/* VERTICALLY EXPANDABLE & RESIZABLE CHAT CAPSULE */}
      <div className={styles.capsule} style={{ height: `${capsuleHeight}px` }}>
        {/* VERTICAL DRAG RESIZE HANDLE */}
        <div
          className={styles.vResizer}
          onMouseDown={startVResizing}
          onDoubleClick={() => setCapsuleHeight(300)}
          title="Drag vertically to adjust chat section height (Double-click to reset)"
        >
          <GripHorizontal size={12} className={styles.vResizerIcon} />
        </div>

        <div className={styles.header}>
          <span className={styles.dot} />
          <span>Director Engine · Gemini Pro</span>
          <button className={styles.expandBtn} title="Full Screen Overlay" onClick={() => setExpanded(true)}>
            <Maximize2 size={11} />
          </button>
        </div>

        {/* INLINE SCROLLABLE CHAT MESSAGES */}
        <div className={styles.inlineChatLog} ref={inlineScrollRef}>
          {agentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.inlineMsgRow} ${msg.role === 'user' ? styles.inlineUser : styles.inlineAgent}`}
            >
              <div className={styles.inlineMsgHeader}>
                <span>{msg.role === 'user' ? 'You' : 'Engine'}</span>
                <span>{msg.ts}</span>
              </div>
              <div className={styles.inlineMsgText}>
                {msg.role === 'user' ? msg.text : formatMarkdown(msg.text)}
              </div>
            </div>
          ))}
          {loading && (
            <div className={styles.inlineTyping}>
              <Loader2 size={12} className={styles.spinner} />
              <span>Analyzing...</span>
            </div>
          )}
        </div>

        <textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Gemini Director Agent…"
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
            <button className={styles.iconBtn} title="Full Screen Modal" onClick={() => setExpanded(true)}>
              <Bot size={13} />
            </button>
            <button className={styles.iconBtn} title="ClickHouse Engine"><Database size={13} /></button>
          </div>
          <button className={styles.sendBtn} title="Send (Enter)" onClick={send} disabled={loading}>
            {loading ? <Loader2 size={13} className={styles.spinner} /> : <ArrowUp size={13} />}
          </button>
        </div>
      </div>

      {/* FULL OVERLAY CHAT DRAWER MODAL */}
      {expanded && (
        <div className={styles.drawerOverlay} onClick={() => setExpanded(false)}>
          <div className={styles.drawerWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerBrand}>
                <Sparkles size={16} color="var(--gold)" />
                <div>
                  <h3>Director Engine AI Agent</h3>
                  <span className={styles.drawerSub}>Gemini 2.5 Pro · ClickHouse Vector Synced</span>
                </div>
              </div>
              <div className={styles.drawerHdrActions}>
                <button className={styles.closeBtn} onClick={() => setExpanded(false)} title="Close Chat">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.chatLog}>
              {agentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.msgRow} ${msg.role === 'user' ? styles.userRow : styles.agentRow}`}
                >
                  <div className={styles.msgMeta}>
                    <span className={styles.roleName}>{msg.role === 'user' ? 'A. Kubrick (Director)' : '🎬 Director AI Agent'}</span>
                    <span className={styles.timeTag}>{msg.ts}</span>
                  </div>
                  <div className={styles.msgBubble}>
                    {msg.role === 'user' ? msg.text : formatMarkdown(msg.text)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className={styles.typingIndicator}>
                  <Loader2 size={14} className={styles.spinner} />
                  <span>Gemini Pro is analyzing production data…</span>
                </div>
              )}
            </div>

            <div className={styles.drawerInputBox}>
              <textarea
                className={styles.drawerTextarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask Director Agent about script breakdown, budget caps, or stripboard scheduling..."
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
                <button className={styles.sendBtn} title="Send (Enter)" onClick={send} disabled={loading}>
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
