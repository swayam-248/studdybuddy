import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import styles from './TaskCard.module.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatElapsedTimer(totalSeconds) {
  if (totalSeconds < 0 || isNaN(totalSeconds)) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function calculateTotalDurationMins(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  return Math.max(1, Math.round((end - start) / 60000));
}

export default function TaskCard({ task, currentUserId, profilesMap = {}, onTaskUpdated }) {
  const [showSolution, setShowSolution] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';
  const isCreator = currentUserId === task.creator_id;
  const isAssignee = currentUserId === task.assigned_to;
  const creatorName = profilesMap[task.creator_id]?.display_name || 'Partner';
  const assigneeName = profilesMap[task.assigned_to]?.display_name || 'Partner';

  const isOverdue =
    task.due_date &&
    !isCompleted &&
    new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

  // Live timer for in_progress tasks
  useEffect(() => {
    if (!isInProgress || !task.started_at) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const startMs = new Date(task.started_at).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isInProgress, task.started_at]);

  const handleStartTask = async () => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) {
        console.error('Failed to start task:', error.message);
        return;
      }

      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Error starting task:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleFinishTask = async () => {
    try {
      setUpdating(true);
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: nowIso
        })
        .eq('id', task.id);

      if (error) {
        console.error('Failed to finish task:', error.message);
        return;
      }

      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Error finishing task:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleComplete = async () => {
    if (isInProgress) {
      await handleFinishTask();
      return;
    }

    try {
      setUpdating(true);
      const nextStatus = isCompleted ? 'pending' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          completed_at: nextStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);

      if (error) {
        console.error('Failed to update task status:', error.message);
        return;
      }

      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this assigned task?')) return;
    try {
      setUpdating(true);
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) {
        console.error('Failed to delete task:', error.message);
        return;
      }
      if (onTaskUpdated) {
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setUpdating(false);
    }
  };

  const totalDurationMins = calculateTotalDurationMins(task.started_at, task.completed_at);

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className={`${styles.statusChip} ${styles.statusCompleted}`}>
          ✓ Finished {totalDurationMins ? `in ${totalDurationMins}m` : ''}
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className={`${styles.statusChip} ${styles.statusInProgress}`}>
          <span className={styles.pulseDot} />
          {isAssignee ? 'Active Now' : `${assigneeName} is solving now!`}
        </span>
      );
    }
    return (
      <span className={`${styles.statusChip} ${styles.statusPending}`}>
        ⏳ Pending
      </span>
    );
  };

  return (
    <div
      className={`${styles.card} ${
        isCompleted ? styles.cardCompleted : isInProgress ? styles.cardInProgress : ''
      }`}
    >
      <div className={styles.topRow}>
        <div className={styles.checkTitleGroup}>
          <button
            type="button"
            className={`${styles.checkboxBtn} ${isCompleted ? styles.checkboxBtnChecked : ''}`}
            onClick={handleToggleComplete}
            disabled={updating}
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            title={
              isCompleted
                ? 'Completed! Click to mark pending'
                : isInProgress
                ? 'Click to finish task'
                : 'Click to complete'
            }
          >
            {isCompleted ? '✓' : ''}
          </button>

          <div className={styles.titleArea}>
            <h3 className={`${styles.title} ${isCompleted ? styles.titleCompleted : ''}`}>
              {task.title}
            </h3>

            <div className={styles.metaRow}>
              {getStatusBadge()}
              <span className={styles.topicBadge}>{task.topic}</span>
              {task.due_date && (
                <span className={`${styles.dueBadge} ${isOverdue ? styles.dueOverdue : ''}`}>
                  📅 {isOverdue ? 'Overdue: ' : 'Due: '}
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>
        </div>

        {isCreator && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDeleteTask}
            disabled={updating}
            title="Delete task"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Live Active Timer Banner */}
      {isInProgress && (
        <div className={styles.taskTimerBanner}>
          <span className={styles.timerLabel}>
            <span>⚡</span>
            <span>{isAssignee ? 'Your Task Timer' : `${assigneeName}'s Live Sprint`}</span>
          </span>
          <span className={styles.timerValue}>{formatElapsedTimer(elapsedSeconds)}</span>
        </div>
      )}

      {task.notes && (
        <div className={styles.notesBox}>
          <p>{task.notes}</p>
        </div>
      )}

      {/* Action Buttons: Accept / Finish */}
      {isAssignee && !isCompleted && (
        <div className={styles.actionButtonsRow}>
          {!isInProgress ? (
            <button
              type="button"
              className={styles.startTaskBtn}
              onClick={handleStartTask}
              disabled={updating}
            >
              <span>🚀</span>
              <span>Accept & Start Timer</span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.finishTaskBtn}
              onClick={handleFinishTask}
              disabled={updating}
            >
              <span>✅</span>
              <span>Finish & Mark Done</span>
            </button>
          )}
        </div>
      )}

      {/* Links and Solution Drawer */}
      {(task.problem_url || task.solution_url) && (
        <div className={styles.actionLinks}>
          {task.problem_url && (
            <a
              href={task.problem_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.problemLinkBtn}
            >
              <span>🔗</span>
              <span>Open Problem / Assignment</span>
            </a>
          )}

          {task.solution_url && (
            <button
              type="button"
              className={styles.solutionToggleBtn}
              onClick={() => setShowSolution((prev) => !prev)}
            >
              <span>💡</span>
              <span>{showSolution ? 'Hide Solution' : 'View Solution / Editorial'}</span>
            </button>
          )}
        </div>
      )}

      {showSolution && task.solution_url && (
        <div className={styles.solutionDrawer}>
          <div className={styles.solutionHeader}>
            <span>💡</span>
            <span>Solution Reference:</span>
          </div>
          <a
            href={task.solution_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.solutionLink}
          >
            {task.solution_url}
          </a>
        </div>
      )}

      <div className={styles.footerInfo}>
        <span>
          Assigned by {creatorName} • {formatDate(task.created_at)}
        </span>
        {isCompleted && (
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>
            ✅ Finished {formatDate(task.completed_at)}
          </span>
        )}
      </div>
    </div>
  );
}
