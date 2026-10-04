import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import styles from './SessionLogger.module.css';

const AVAILABLE_TOPICS = [
  'DSA',
  'OS',
  'DBMS',
  'Networks',
  'System Design',
  'Aptitude',
  'Core CS',
  'Projects',
  'Interview Prep'
];

const MIN_SESSION_MINUTES = 15;
const MIN_NOTE_LENGTH = 15;

export default function SessionLogger({ sessionStart, onClose, onSaved }) {
  const { user } = useAuth();
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [problems, setProblems] = useState({ easy: 0, medium: 0, hard: 0 });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const now = useMemo(() => new Date(), []);
  const startTime = useMemo(() => {
    return sessionStart ? new Date(sessionStart) : new Date(Date.now() - 30 * 60 * 1000);
  }, [sessionStart]);

  // Duration in minutes
  const durationMinutes = useMemo(() => {
    const diffMs = now.getTime() - startTime.getTime();
    return Math.max(1, Math.round(diffMs / 60000));
  }, [now, startTime]);

  const formattedDuration = useMemo(() => {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }, [durationMinutes]);

  const isTooShort = durationMinutes < MIN_SESSION_MINUTES;

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const updateProblemCount = (diff, delta) => {
    setProblems((prev) => ({
      ...prev,
      [diff]: Math.max(0, (prev[diff] || 0) + delta)
    }));
  };

  const totalProblemsSolved = problems.easy + problems.medium + problems.hard;

  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (isTooShort) {
      setErrorMsg(
        `Strict Rule: Sessions under ${MIN_SESSION_MINUTES} minutes cannot be logged. Placement sprints require at least ${MIN_SESSION_MINUTES}m of sustained deep work.`
      );
      return;
    }

    if (selectedTopics.length === 0) {
      setErrorMsg('Please select at least one study topic.');
      return;
    }

    if (note.trim().length < MIN_NOTE_LENGTH) {
      setErrorMsg(
        `Anti-Fake Rule: Meaningful session reflection required (${note.trim().length}/${MIN_NOTE_LENGTH} characters minimum).`
      );
      return;
    }

    // If problems were solved, proof link is encouraged or validated
    if (proofUrl.trim() && !proofUrl.trim().startsWith('http://') && !proofUrl.trim().startsWith('https://')) {
      setErrorMsg('Proof URL must start with http:// or https://');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      // Insert session log with proof of work
      const { error: insertError } = await supabase.from('sessions').insert({
        user_id: user.id,
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
        duration_minutes: durationMinutes,
        topics: selectedTopics,
        problems_solved: problems,
        proof_url: proofUrl.trim() || null,
        note: note.trim()
      });

      if (insertError) {
        throw insertError;
      }

      // Reset user profile status to offline and clear active break & session
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          status: 'offline',
          session_start: null,
          break_start: null,
          break_duration_minutes: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>Log Study Sprint & Proof</h2>
            <p className={styles.subtitle}>Strict placement accountability and work verification</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.durationBanner}>
          <span className={styles.durationLabel}>Elapsed Sprint Duration</span>
          <span className={styles.durationValue}>{formattedDuration}</span>
        </div>

        {isTooShort && (
          <div className={styles.shortSprintWarning}>
            <span className={styles.warningIcon}>⛔</span>
            <div>
              <strong>Sprint Under {MIN_SESSION_MINUTES} Minutes</strong>
              <p>
                Strict Placement Rule: Sessions under {MIN_SESSION_MINUTES} minutes cannot be
                recorded as completed study sprints. Keep studying to reach the threshold!
              </p>
            </div>
          </div>
        )}

        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        <form onSubmit={handleSaveSession} className={styles.section}>
          {/* Topics Multi-Select */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>
              <span>Topics Covered</span>
              <span className={styles.requiredIndicator}>Select all that apply</span>
            </label>
            <div className={styles.chipsGrid}>
              {AVAILABLE_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    className={`${styles.chip} ${isSelected ? styles.chipSelected : ''}`}
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LeetCode / Problems Solved Counters */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>
              <span>Placement Problems Solved</span>
              <span className={styles.requiredIndicator}>
                {totalProblemsSolved} Total Questions
              </span>
            </label>
            <div className={styles.problemsGrid}>
              <div className={styles.counterCard}>
                <span className={styles.counterDifficulty}>🟢 Easy</span>
                <div className={styles.counterControls}>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('easy', -1)}
                    disabled={problems.easy <= 0}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{problems.easy}</span>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('easy', 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={styles.counterCard}>
                <span className={styles.counterDifficulty}>🟡 Medium</span>
                <div className={styles.counterControls}>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('medium', -1)}
                    disabled={problems.medium <= 0}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{problems.medium}</span>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('medium', 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={styles.counterCard}>
                <span className={styles.counterDifficulty}>🔴 Hard</span>
                <div className={styles.counterControls}>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('hard', -1)}
                    disabled={problems.hard <= 0}
                  >
                    -
                  </button>
                  <span className={styles.counterVal}>{problems.hard}</span>
                  <button
                    type="button"
                    className={styles.counterBtn}
                    onClick={() => updateProblemCount('hard', 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Proof of Work URL */}
          <div className={styles.section}>
            <label htmlFor="proofUrl" className={styles.sectionLabel}>
              <span>Proof of Work Link</span>
              <span className={styles.requiredIndicator}>LeetCode submission / GitHub / Notion</span>
            </label>
            <input
              id="proofUrl"
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://leetcode.com/submissions/detail/... or github commit"
              className={styles.input}
            />
          </div>

          {/* Mandatory Reflection Note */}
          <div className={styles.section}>
            <label htmlFor="sessionNote" className={styles.sectionLabel}>
              <span>Sprint Reflection (Mandatory)</span>
              <span
                className={`${styles.charCount} ${
                  note.trim().length >= MIN_NOTE_LENGTH ? styles.charCountValid : ''
                }`}
              >
                {note.trim().length} / {MIN_NOTE_LENGTH} chars min
              </span>
            </label>
            <textarea
              id="sessionNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Concrete details: e.g., Solved LeetCode 207 Course Schedule with Topological Sort, revised DBMS 3NF..."
              className={styles.textarea}
              rows={3}
              required
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={saving || isTooShort}
            >
              {saving ? 'Verifying & Saving...' : 'Commit Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
