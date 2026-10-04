import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import styles from './CreateTaskModal.module.css';

const TOPICS = [
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

export default function CreateTaskModal({ onClose, onTaskCreated, currentUserId, partnerProfile }) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('DSA');
  const [problemUrl, setProblemUrl] = useState('');
  const [solutionUrl, setSolutionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignTarget, setAssignTarget] = useState('partner'); // 'partner' | 'self'
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const partnerId = partnerProfile?.id;
  const partnerName = partnerProfile?.display_name || partnerProfile?.email?.split('@')[0] || 'Partner';

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg('Please enter a task title.');
      return;
    }

    const assignedTo = assignTarget === 'partner' ? partnerId : currentUserId;

    if (!assignedTo) {
      setErrorMsg('Partner account is not yet registered. You can assign this task to yourself for now.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const { error } = await supabase.from('tasks').insert({
        creator_id: currentUserId,
        assigned_to: assignedTo,
        title: title.trim(),
        topic,
        problem_url: problemUrl.trim() || null,
        solution_url: solutionUrl.trim() || null,
        notes: notes.trim() || null,
        due_date: dueDate || null,
        status: 'pending'
      });

      if (error) {
        throw error;
      }

      if (onTaskCreated) {
        onTaskCreated();
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>Assign Task to {partnerName}</h2>
            <p className={styles.subtitle}>Send problem links, solution hints, and deadline for your partner to solve</p>
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

        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Assign To Selector */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <span>Assign To</span>
            </label>
            <div className={styles.chipsGrid}>
              <button
                type="button"
                className={`${styles.chip} ${assignTarget === 'partner' ? styles.chipSelected : ''}`}
                onClick={() => setAssignTarget('partner')}
              >
                <span>🤝</span> {partnerName} (Partner)
              </button>
              <button
                type="button"
                className={`${styles.chip} ${assignTarget === 'self' ? styles.chipSelected : ''}`}
                onClick={() => setAssignTarget('self')}
              >
                <span>👤</span> Myself
              </button>
            </div>
          </div>

          {/* Task Title */}
          <div className={styles.formGroup}>
            <label htmlFor="taskTitle" className={styles.label}>
              <span>Task Title</span>
              <span className={styles.sublabel}>Required</span>
            </label>
            <input
              id="taskTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., Solve LeetCode 207 (Course Schedule) using BFS"
              className={styles.input}
              required
            />
          </div>

          {/* Topic */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <span>Subject Area</span>
            </label>
            <div className={styles.chipsGrid}>
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.chip} ${topic === t ? styles.chipSelected : ''}`}
                  onClick={() => setTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Problem URL */}
          <div className={styles.formGroup}>
            <label htmlFor="problemUrl" className={styles.label}>
              <span>Problem / Task URL</span>
              <span className={styles.sublabel}>LeetCode, GFG, Article, etc.</span>
            </label>
            <input
              id="problemUrl"
              type="url"
              value={problemUrl}
              onChange={(e) => setProblemUrl(e.target.value)}
              placeholder="https://leetcode.com/problems/course-schedule/"
              className={styles.input}
            />
          </div>

          {/* Solution URL / Hint Link */}
          <div className={styles.formGroup}>
            <label htmlFor="solutionUrl" className={styles.label}>
              <span>Solution / Hint URL</span>
              <span className={styles.sublabel}>Spoiler-hidden until clicked by partner</span>
            </label>
            <input
              id="solutionUrl"
              type="url"
              value={solutionUrl}
              onChange={(e) => setSolutionUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?... or editorial link"
              className={styles.input}
            />
          </div>

          {/* Target Due Date */}
          <div className={styles.formGroup}>
            <label htmlFor="dueDate" className={styles.label}>
              <span>Target Completion Date</span>
              <span className={styles.sublabel}>Optional</span>
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Notes / Instructions */}
          <div className={styles.formGroup}>
            <label htmlFor="taskNotes" className={styles.label}>
              <span>Instructions / Hints</span>
              <span className={styles.sublabel}>Optional</span>
            </label>
            <textarea
              id="taskNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Try to write clean cycle-detection code. Don't look at the solution for at least 30 minutes!"
              className={styles.textarea}
              rows={3}
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
              disabled={saving}
            >
              {saving ? 'Assigning...' : 'Assign Task 🚀'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
