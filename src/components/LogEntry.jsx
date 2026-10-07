import React from 'react';
import styles from './LogEntry.module.css';

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function LogEntry({ session }) {
  if (!session) return null;

  const {
    start_time,
    duration_minutes,
    topics = [],
    problems_solved,
    proof_url,
    note
  } = session;

  const easy = problems_solved?.easy || 0;
  const medium = problems_solved?.medium || 0;
  const hard = problems_solved?.hard || 0;
  const hasProblems = easy > 0 || medium > 0 || hard > 0;

  return (
    <div className={styles.entryCard}>
      <div className={styles.topRow}>
        <div className={styles.dateInfo}>
          <span className={styles.dateText}>{formatDate(start_time)}</span>
          <span className={styles.timeText}>{formatTime(start_time)}</span>
        </div>

        <div className={styles.badgesWrapper}>
          {duration_minutes < 15 && (
            <span className={styles.shortSprintTag} title="Short study sprint (< 15m)">
              ⚡ &lt;15m Sprint
            </span>
          )}
          <div className={styles.durationBadge}>
            <span>⏱️</span>
            <span>{formatDuration(duration_minutes)}</span>
          </div>
        </div>
      </div>

      {Array.isArray(topics) && topics.length > 0 && (
        <div className={styles.topicsList}>
          {topics.map((topic) => (
            <span key={topic} className={styles.topicChip}>
              {topic}
            </span>
          ))}
        </div>
      )}

      {note && (
        <div className={styles.noteContainer}>
          <p>{note}</p>
        </div>
      )}

      {(hasProblems || proof_url) && (
        <div className={styles.proofRow}>
          {hasProblems ? (
            <div className={styles.problemsSummary}>
              <span>Problems:</span>
              {easy > 0 && <span className={styles.probBadge}>🟢 {easy} Easy</span>}
              {medium > 0 && <span className={styles.probBadge}>🟡 {medium} Med</span>}
              {hard > 0 && <span className={styles.probBadge}>🔴 {hard} Hard</span>}
            </div>
          ) : <div />}

          {proof_url && (
            <a
              href={proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.proofLink}
            >
              <span>🔗</span>
              <span>Verify Proof of Work</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
