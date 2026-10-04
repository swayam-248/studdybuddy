import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import Nav from '../components/Nav';
import styles from './Chat.module.css';

const QUICK_PRESETS = [
  { icon: '☕', text: 'Sending you a cup of chai!' },
  { icon: '🔥', text: 'Locked in! Let’s crush this topic.' },
  { icon: '🙌', text: 'High five! Great problem solve.' },
  { icon: '💪', text: 'Keep pushing! Don’t give up.' },
  { icon: '❤️', text: 'Proud of you! Proud of us.' }
];

const EMOJI_REACTIONS = ['❤️', '🔥', '☕', '👏', '🚀'];

function playMessageChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio blocked
  }
}

function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function Chat() {
  const { user, profile, partnerProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [showCodeMode, setShowCodeMode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [problemTitle, setProblemTitle] = useState('');
  const [problemUrl, setProblemUrl] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const partnerId = partnerProfile?.id;
  const partnerName = partnerProfile?.display_name || partnerProfile?.email?.split('@')[0] || 'Partner';
  const partnerStatus = partnerProfile?.status || 'offline';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error.message);
        return;
      }

      setMessages(data || []);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Unexpected error loading chat:', err);
    }
  }, []);

  // Initial load and Realtime message listener
  useEffect(() => {
    fetchMessages();

    // 1. Database postgres_changes for messages
    const msgChannel = supabase
      .channel('realtime_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== user?.id) {
            playMessageChime();
          }
          setTimeout(scrollToBottom, 50);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m))
          );
        }
      )
      .subscribe();

    // 2. Broadcast channel for typing status
    const typingChannel = supabase
      .channel('chat_typing_broadcast')
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.userId === partnerId) {
          setPartnerIsTyping(payload.payload.isTyping);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [fetchMessages, user?.id, partnerId]);

  // Handle typing broadcast
  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    // Broadcast typing indicator
    supabase.channel('chat_typing_broadcast').send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user?.id, isTyping: true }
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel('chat_typing_broadcast').send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user?.id, isTyping: false }
      });
    }, 2000);
  };

  // Send standard or code message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() && !codeValue.trim()) return;

    try {
      setSending(true);
      const newMsg = {
        sender_id: user.id,
        content: inputValue.trim() || (codeValue.trim() ? 'Shared a code snippet:' : ''),
        code_snippet: codeValue.trim() || null,
        reactions: {}
      };

      setInputValue('');
      setCodeValue('');
      setShowCodeMode(false);

      const { error } = await supabase.from('messages').insert(newMsg);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err.message);
    } finally {
      setSending(false);
    }
  };

  // Send 1-click quick reaction preset
  const handleSendPreset = async (preset) => {
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        content: `${preset.icon} ${preset.text}`,
        reactions: {}
      });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to send preset message:', err.message);
    }
  };

  // Send 1-click shared problem link
  const handleShareProblem = async (e) => {
    e.preventDefault();
    if (!problemTitle.trim() || !problemUrl.trim()) return;

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        content: `Check out this problem: ${problemTitle.trim()}`,
        problem_title: problemTitle.trim(),
        problem_link: problemUrl.trim(),
        reactions: {}
      });
      if (error) throw error;

      setProblemTitle('');
      setProblemUrl('');
      setShowShareModal(false);
    } catch (err) {
      console.error('Failed to share problem:', err.message);
    }
  };

  // Emoji reactions on a message
  const handleToggleReaction = async (message, emoji) => {
    if (!user) return;
    const currentReactions = message.reactions || {};
    const usersForEmoji = currentReactions[emoji] || [];

    const hasReacted = usersForEmoji.includes(user.id);
    const updatedUsers = hasReacted
      ? usersForEmoji.filter((id) => id !== user.id)
      : [...usersForEmoji, user.id];

    const nextReactions = {
      ...currentReactions,
      [emoji]: updatedUsers
    };

    if (updatedUsers.length === 0) {
      delete nextReactions[emoji];
    }

    // Optimistically update local message state
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, reactions: nextReactions } : m))
    );

    await supabase
      .from('messages')
      .update({ reactions: nextReactions })
      .eq('id', message.id);
  };

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const partnerStatusClass = useMemo(() => {
    if (partnerStatus === 'active') return styles.dotActive;
    if (partnerStatus === 'break') return styles.dotBreak;
    return styles.dotOffline;
  }, [partnerStatus]);

  return (
    <div className={styles.layout}>
      <Nav />

      <main className={styles.chatContainer}>
        {/* Header with live partner study heartbeat */}
        <header className={styles.chatHeader}>
          <div className={styles.partnerInfo}>
            <div className={styles.partnerAvatar}>
              <span>{partnerName.charAt(0).toUpperCase()}</span>
              <span className={`${styles.statusDot} ${partnerStatusClass}`} />
            </div>
            <div className={styles.partnerMeta}>
              <span className={styles.partnerName}>{partnerName}</span>
              <span className={styles.partnerStatusText}>
                {partnerStatus === 'active' && '🟢 Live Studying'}
                {partnerStatus === 'break' && '☕ Taking a Break'}
                {partnerStatus === 'offline' && 'Offline'}
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => setShowShareModal(true)}
            >
              <span>🔗</span>
              <span>Share Problem</span>
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => handleSendPreset(QUICK_PRESETS[0])}
            >
              <span>☕</span>
              <span>Send Chai</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className={styles.messagesStream}>
          {messages.length === 0 ? (
            <div className={styles.emptyChat}>
              <span className={styles.emptyIcon}>💬</span>
              <h3>No Messages Yet</h3>
              <p>
                Start the conversation with {partnerName}. Share LeetCode problems, code solutions,
                or quick study motivation!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              const reactionsMap = msg.reactions || {};

              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isMine ? styles.messageRowMine : styles.messageRowPartner
                  }`}
                >
                  {/* Floating quick reaction bar on hover */}
                  <div className={styles.quickReactBar}>
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={styles.reactEmojiBtn}
                        onClick={() => handleToggleReaction(msg, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubblePartner}`}>
                    {msg.content && <p>{msg.content}</p>}

                    {/* Shared Problem Card */}
                    {msg.problem_link && (
                      <div className={styles.problemCard}>
                        <span className={styles.problemCardHeader}>🎯 Placement Challenge</span>
                        <span className={styles.problemTitle}>{msg.problem_title}</span>
                        <a
                          href={msg.problem_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.openProblemBtn}
                        >
                          <span>🔗 Open Problem on LeetCode / Site</span>
                        </a>
                      </div>
                    )}

                    {/* Formatted Code Snippet */}
                    {msg.code_snippet && (
                      <div className={styles.codeBox}>
                        <div className={styles.codeHeader}>
                          <span>Code Snippet</span>
                          <button
                            type="button"
                            className={styles.copyCodeBtn}
                            onClick={() => handleCopyCode(msg.code_snippet, msg.id)}
                          >
                            {copiedId === msg.id ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className={styles.codePre}>{msg.code_snippet}</pre>
                      </div>
                    )}
                  </div>

                  {/* Reaction Badges Under Bubble */}
                  {Object.keys(reactionsMap).length > 0 && (
                    <div className={styles.reactionsRow}>
                      {Object.entries(reactionsMap).map(([emoji, userIds]) => {
                        const hasMine = userIds.includes(user?.id);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`${styles.reactionPill} ${
                              hasMine ? styles.reactionPillMine : ''
                            }`}
                            onClick={() => handleToggleReaction(msg, emoji)}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <span className={styles.messageMeta}>
                    {formatMessageTime(msg.created_at)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Partner Typing Indicator */}
        {partnerIsTyping && (
          <div className={styles.typingIndicator}>
            <span>✍️</span>
            <span>{partnerName} is typing...</span>
          </div>
        )}

        {/* 1-Tap Quick Study Reaction Presets */}
        <div className={styles.quickPresetsBar}>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.text}
              type="button"
              className={styles.presetBtn}
              onClick={() => handleSendPreset(preset)}
            >
              <span>{preset.icon}</span>
              <span>{preset.text}</span>
            </button>
          ))}
        </div>

        {/* Composer */}
        <form onSubmit={handleSendMessage} className={styles.composer}>
          {showCodeMode && (
            <div className={styles.codeModeBox}>
              <div className={styles.codeModeHeader}>
                <span>Paste / Write DSA Code Snippet</span>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setShowCodeMode(false)}
                >
                  ✕
                </button>
              </div>
              <textarea
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                placeholder="public class Solution { ... }"
                className={styles.codeTextarea}
                rows={4}
              />
            </div>
          )}

          <div className={styles.inputRow}>
            <button
              type="button"
              className={`${styles.codeToggleBtn} ${showCodeMode ? styles.codeToggleBtnActive : ''}`}
              onClick={() => setShowCodeMode((prev) => !prev)}
              title="Add Code Snippet"
            >
              &lt;/&gt;
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={`Message ${partnerName}... (Shift+Enter for newline)`}
              className={styles.textInput}
              disabled={sending}
            />

            <button
              type="submit"
              className={styles.sendBtn}
              disabled={sending || (!inputValue.trim() && !codeValue.trim())}
            >
              <span>Send</span>
              <span>➤</span>
            </button>
          </div>
        </form>
      </main>

      {/* 1-Click Share Problem Modal */}
      {showShareModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowShareModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Share Placement Problem</h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowShareModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleShareProblem} className={styles.modalForm}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Problem Title</label>
                <input
                  type="text"
                  value={problemTitle}
                  onChange={(e) => setProblemTitle(e.target.value)}
                  placeholder="E.g. LeetCode 33 — Search in Rotated Sorted Array"
                  className={styles.textInput}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Problem URL</label>
                <input
                  type="url"
                  value={problemUrl}
                  onChange={(e) => setProblemUrl(e.target.value)}
                  placeholder="https://leetcode.com/problems/..."
                  className={styles.textInput}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.headerBtn}
                  onClick={() => setShowShareModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.sendBtn}
                >
                  Share to Chat 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
