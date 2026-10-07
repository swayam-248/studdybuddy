import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotificationToast.module.css';

export function playShortSessionChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Alert ping: two quick pleasant notes
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio autoplay restrictions
  }
}

export default function NotificationToast({ notifications, onDismiss }) {
  const navigate = useNavigate();

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className={styles.toastContainer} role="region" aria-label="Notifications">
      {notifications.map((item) => {
        const { id, partnerName, durationMinutes, topics, note } = item;
        const topicString = Array.isArray(topics) && topics.length > 0 ? topics.join(', ') : 'Study';

        return (
          <div key={id} className={styles.toast} role="alert">
            <div className={styles.headerRow}>
              <span className={styles.badge}>
                <span className={styles.badgeIcon}>⚡</span>
                Short Sprint Alert
              </span>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => onDismiss(id)}
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>

            <div className={styles.body}>
              <p>
                <strong className={styles.partnerName}>{partnerName}</strong> logged a{' '}
                <span className={styles.durationHighlight}>{durationMinutes}m</span> quick sprint on{' '}
                <strong>{topicString}</strong> (&lt; 15m threshold).
              </p>
              {note && <p className={styles.reflectionPreview}>"{note}"</p>}
            </div>

            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => onDismiss(id)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className={styles.viewBtn}
                onClick={() => {
                  onDismiss(id);
                  navigate('/logs');
                }}
              >
                📜 View in Logs
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
