import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import styles from './StatusCard.module.css';

const BREAK_OPTIONS = [
  { mins: 5, label: 'Stretch', icon: '🧘' },
  { mins: 10, label: 'Chai/Snack', icon: '☕' },
  { mins: 15, label: 'Power Walk', icon: '🚶' },
  { mins: 20, label: 'Meal Break', icon: '🍱' }
];

const GOAL_PRESETS = [2, 3, 4, 5, 6, 8];

function playOverdueChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Non-fatal if audio context is blocked by browser autoplay policy
  }
}

function formatDuration(totalSeconds) {
  if (totalSeconds < 0 || isNaN(totalSeconds)) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMinutesAndSeconds(totalSeconds) {
  const mins = Math.floor(Math.abs(totalSeconds) / 60);
  const secs = Math.abs(totalSeconds) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}`;
}

function getMidnightCountdown() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffSecs = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const hrs = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

export default function StatusCard({ profile, isCurrentUser, onOpenLogger, quotaStats }) {
  const { user, updateStatus, refreshProfiles } = useAuth();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakRemainingSeconds, setBreakRemainingSeconds] = useState(null);
  const [showBreakPicker, setShowBreakPicker] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [tempGoal, setTempGoal] = useState('3');
  const [actionLoading, setActionLoading] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [midnightCountdown, setMidnightCountdown] = useState(getMidnightCountdown);
  const chimeTriggeredRef = useRef(false);

  const status = profile?.status || 'offline';
  const sessionStart = profile?.session_start;
  const breakStart = profile?.break_start;
  const breakDurationMinutes = profile?.break_duration_minutes || 10;

  // Quota computations
  const todayHours = quotaStats?.todayHours || 0;
  const quotaHours = profile?.daily_quota_hours || quotaStats?.quotaHours || 3.0;
  const quotaMet = quotaStats?.quotaMet || false;
  const streak = quotaStats?.streak || 0;
  const missedYesterday = quotaStats?.missedYesterday || false;
  const quotaPercent = Math.min(100, Math.round((todayHours / quotaHours) * 100));

  // Sync tempGoal on profile load
  useEffect(() => {
    if (profile?.daily_quota_hours) {
      setTempGoal(String(profile.daily_quota_hours));
    }
  }, [profile?.daily_quota_hours]);

  // Midnight countdown updater
  useEffect(() => {
    const interval = setInterval(() => {
      setMidnightCountdown(getMidnightCountdown());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Running study session ticker
  useEffect(() => {
    if (!sessionStart || status === 'offline') {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startMs = new Date(sessionStart).getTime();
      const nowMs = Date.now();
      const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diff);
    };

    calculateElapsed();

    if (status === 'active') {
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionStart, status]);

  // Break ticker & overdue tracker
  useEffect(() => {
    if (status !== 'break' || !breakStart) {
      setBreakRemainingSeconds(null);
      chimeTriggeredRef.current = false;
      return;
    }

    const calculateBreakRemaining = () => {
      const startMs = new Date(breakStart).getTime();
      const elapsedBreakSecs = Math.floor((Date.now() - startMs) / 1000);
      const totalAllottedSecs = breakDurationMinutes * 60;
      const remaining = totalAllottedSecs - elapsedBreakSecs;
      setBreakRemainingSeconds(remaining);

      // Trigger audio chime once when time runs out for the current user
      if (remaining <= 0 && !chimeTriggeredRef.current && isCurrentUser) {
        playOverdueChime();
        chimeTriggeredRef.current = true;
      }
    };

    calculateBreakRemaining();
    const interval = setInterval(calculateBreakRemaining, 1000);
    return () => clearInterval(interval);
  }, [status, breakStart, breakDurationMinutes, isCurrentUser]);

  const isBreakOverdue = status === 'break' && breakRemainingSeconds !== null && breakRemainingSeconds < 0;

  const handleStartStudying = async () => {
    setActionLoading(true);
    await updateStatus('active', new Date().toISOString(), null, null);
    setActionLoading(false);
  };

  const handleSelectBreak = async (mins) => {
    setActionLoading(true);
    setShowBreakPicker(false);
    await updateStatus('break', sessionStart, new Date().toISOString(), mins);
    setActionLoading(false);
  };

  const handleResume = async () => {
    setActionLoading(true);
    await updateStatus('active', sessionStart || new Date().toISOString(), null, null);
    setActionLoading(false);
  };

  const handleStopAndLog = () => {
    if (onOpenLogger) {
      onOpenLogger(sessionStart);
    }
  };

  const handleSendNudge = () => {
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 3000);
  };

  const handleSaveGoal = async (valToSave) => {
    const target = valToSave !== undefined ? valToSave : parseFloat(tempGoal);
    if (isNaN(target) || target <= 0 || target > 18) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          daily_quota_hours: target,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to update study goal:', error.message);
        return;
      }

      setTempGoal(String(target));
      setShowGoalEditor(false);
      if (refreshProfiles) {
        await refreshProfiles();
      }
    } catch (err) {
      console.error('Unexpected error updating study goal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || (isCurrentUser ? 'You' : 'Partner');
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const getStatusChipClass = () => {
    if (isBreakOverdue) return styles.statusOverdue;
    switch (status) {
      case 'active':
        return styles.statusActive;
      case 'break':
        return styles.statusBreak;
      default:
        return styles.statusOffline;
    }
  };

  const getStatusText = () => {
    if (isBreakOverdue) {
      const overdueMins = Math.ceil(Math.abs(breakRemainingSeconds) / 60);
      return `Overdue +${overdueMins}m`;
    }
    switch (status) {
      case 'active':
        return 'Studying';
      case 'break':
        return 'On Break';
      default:
        return 'Offline';
    }
  };

  const getCardModifierClass = () => {
    if (isBreakOverdue) return styles.cardOverdue;
    if (status === 'active') return styles.cardActive;
    if (status === 'break') return styles.cardBreak;
    return '';
  };

  return (
    <div className={`${styles.card} ${getCardModifierClass()}`}>
      <div className={styles.cardHeader}>
        <div className={styles.userMeta}>
          <div className={styles.avatar}>{avatarLetter}</div>
          <div className={styles.userDetails}>
            <div className={styles.nameRow}>
              <span className={styles.displayName}>{displayName}</span>
              <span className={styles.roleBadge}>{isCurrentUser ? 'You' : 'Partner'}</span>

              {/* Streak Badge */}
              {missedYesterday && !quotaMet ? (
                <span
                  className={`${styles.streakBadge} ${styles.streakReset}`}
                  title="Quota missed yesterday — streak reset to 0"
                >
                  💀 Streak Reset
                </span>
              ) : streak > 0 ? (
                <span className={`${styles.streakBadge} ${styles.streakActive}`}>
                  🔥 {streak}d Streak
                </span>
              ) : (
                <span className={`${styles.streakBadge} ${styles.streakZero}`}>
                  🔥 0d Streak
                </span>
              )}
            </div>
            <span className={styles.emailSubtext}>{profile?.email || 'Registered Partner'}</span>
          </div>
        </div>

        <div className={`${styles.statusChip} ${getStatusChipClass()}`}>
          <span className={styles.chipDot} />
          <span>{getStatusText()}</span>
        </div>
      </div>

      <div className={styles.bodySection}>
        <div className={styles.timerLabel}>
          {status === 'active'
            ? 'Current Session'
            : status === 'break'
            ? isBreakOverdue
              ? '⚠️ Break Time Overdue'
              : `Break Countdown (${breakDurationMinutes}m allotted)`
            : 'Last Session'}
        </div>

        <div
          className={`${styles.timerDisplay} ${
            status === 'active'
              ? styles.timerDisplayActive
              : isBreakOverdue
              ? styles.timerDisplayOverdue
              : status === 'break'
              ? styles.timerDisplayBreak
              : ''
          }`}
        >
          {status === 'break' && breakRemainingSeconds !== null
            ? isBreakOverdue
              ? `+${formatMinutesAndSeconds(breakRemainingSeconds)} OVERDUE`
              : `${formatMinutesAndSeconds(breakRemainingSeconds)} left`
            : formatDuration(elapsedSeconds)}
        </div>

        <div className={styles.statusMessage}>
          {status === 'active' && 'Currently locked in & focused.'}
          {status === 'break' && !isBreakOverdue && (
            `Recharging for ${breakDurationMinutes} minutes. Step away from the screen!`
          )}
          {status === 'break' && isBreakOverdue && (
            'Allotted break ended! Return to your study sprint to protect your focus.'
          )}
          {status === 'offline' && 'Offline. Ready for the next sprint.'}
        </div>

        {isBreakOverdue && isCurrentUser && (
          <div className={styles.overdueAlertBox}>
            <span>⏰</span>
            <span>Your {breakDurationMinutes}-minute break is over. Time to resume studying!</span>
          </div>
        )}
      </div>

      {/* Daily Quota Tracker Section */}
      <div className={styles.quotaSection}>
        <div className={styles.quotaHeader}>
          <span className={styles.quotaTitle}>
            <span>🎯</span>
            <span>Daily Goal</span>
            {isCurrentUser && (
              <button
                type="button"
                className={styles.editGoalBtn}
                onClick={() => {
                  setTempGoal(String(quotaHours));
                  setShowGoalEditor((prev) => !prev);
                }}
                title="Change your daily study target hours"
              >
                ✏️ {showGoalEditor ? 'Cancel' : 'Set Goal'}
              </button>
            )}
          </span>
          <span className={`${styles.quotaNumbers} ${quotaMet ? styles.quotaNumbersMet : ''}`}>
            {todayHours}h / {quotaHours}h ({quotaPercent}%)
          </span>
        </div>

        <div className={styles.quotaTrack}>
          <div
            className={`${styles.quotaFill} ${quotaMet ? styles.quotaFillMet : ''}`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        <div className={styles.quotaFooter}>
          <span>
            {quotaMet ? '✅ Quota Met Today!' : '⏳ Quota pending'}
          </span>
          <span className={styles.quotaCountdown}>
            {quotaMet ? 'Goal crushed' : `${midnightCountdown} to midnight cutoff`}
          </span>
        </div>

        {/* Inline Goal Setter for Current User */}
        {showGoalEditor && isCurrentUser && (
          <div className={styles.goalEditorContainer}>
            <div className={styles.goalEditorLabel}>
              <span>Select or Enter Target Hours</span>
              <span>(1h - 16h)</span>
            </div>

            <div className={styles.goalPresetsGrid}>
              {GOAL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.goalPresetBtn} ${
                    parseFloat(tempGoal) === preset ? styles.goalPresetBtnActive : ''
                  }`}
                  onClick={() => {
                    setTempGoal(String(preset));
                    handleSaveGoal(preset);
                  }}
                  disabled={actionLoading}
                >
                  {preset}h
                </button>
              ))}
            </div>

            <div className={styles.goalInputRow}>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="16"
                value={tempGoal}
                onChange={(e) => setTempGoal(e.target.value)}
                className={styles.goalInput}
                disabled={actionLoading}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>hours / day</span>
              <button
                type="button"
                className={styles.goalSaveBtn}
                onClick={() => handleSaveGoal()}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className={styles.goalCancelBtn}
                onClick={() => setShowGoalEditor(false)}
                disabled={actionLoading}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {showBreakPicker && isCurrentUser && (
        <div className={styles.breakPicker}>
          <div className={styles.breakPickerHeader}>
            <span className={styles.breakPickerTitle}>Choose Break Duration</span>
            <button
              type="button"
              className={styles.breakCloseBtn}
              onClick={() => setShowBreakPicker(false)}
            >
              ✕ Cancel
            </button>
          </div>
          <div className={styles.breakOptionsGrid}>
            {BREAK_OPTIONS.map((opt) => (
              <button
                key={opt.mins}
                type="button"
                className={styles.breakOptionBtn}
                onClick={() => handleSelectBreak(opt.mins)}
                disabled={actionLoading}
              >
                <span>{opt.icon}</span>
                <span className={styles.breakTime}>{opt.mins}m</span>
                <span className={styles.breakDesc}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isCurrentUser ? (
        <div className={styles.actionsContainer}>
          {status === 'offline' && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleStartStudying}
              disabled={actionLoading}
            >
              <span>🚀</span> Start studying
            </button>
          )}

          {status === 'active' && (
            <>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowBreakPicker(true)}
                disabled={actionLoading}
              >
                <span>☕</span> Take a break
              </button>
              <button
                type="button"
                className={`${styles.btnSecondary} ${styles.btnStop}`}
                onClick={handleStopAndLog}
                disabled={actionLoading}
              >
                <span>⏹️</span> Stop & log
              </button>
            </>
          )}

          {status === 'break' && (
            <>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleResume}
                disabled={actionLoading}
              >
                <span>▶️</span> Resume
              </button>
              <button
                type="button"
                className={`${styles.btnSecondary} ${styles.btnStop}`}
                onClick={handleStopAndLog}
                disabled={actionLoading}
              >
                <span>⏹️</span> Stop & log
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.partnerBadge}>
          {isBreakOverdue ? (
            <>
              <span className={styles.partnerOverdueNotice}>
                ⚠️ Break overdue by {Math.ceil(Math.abs(breakRemainingSeconds || 0) / 60)}m!
              </span>
              <button
                type="button"
                className={styles.nudgeBtn}
                onClick={handleSendNudge}
              >
                {nudgeSent ? '🔔 Nudged!' : '🔔 Nudge'}
              </button>
            </>
          ) : status === 'break' ? (
            <span>
              Partner is taking a {breakDurationMinutes}m break
              {breakRemainingSeconds !== null && breakRemainingSeconds > 0
                ? ` (${formatMinutesAndSeconds(breakRemainingSeconds)} left)`
                : ''}
            </span>
          ) : status === 'active' ? (
            <span>Live tracking active</span>
          ) : (
            <span>Partner is currently offline</span>
          )}
        </div>
      )}
    </div>
  );
}
