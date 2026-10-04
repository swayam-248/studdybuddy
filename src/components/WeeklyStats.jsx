import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import styles from './WeeklyStats.module.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getStartAndEndOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

function formatDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function WeeklyStats() {
  const { user, profile, partnerProfile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const { monday, sunday } = useMemo(() => getStartAndEndOfWeek(), []);

  const fetchWeekSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .gte('start_time', monday.toISOString())
        .lte('start_time', sunday.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching weekly sessions:', error.message);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Unexpected error loading weekly stats:', err);
    } finally {
      setLoading(false);
    }
  }, [monday, sunday]);

  useEffect(() => {
    fetchWeekSessions();
    // 60-second auto refresh as specified
    const interval = setInterval(fetchWeekSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchWeekSessions]);

  // Partner ID
  const partnerId = partnerProfile?.id;
  const currentUserId = user?.id;

  // Process User & Partner statistics
  const stats = useMemo(() => {
    const userSessions = sessions.filter((s) => s.user_id === currentUserId);
    const partnerSessions = sessions.filter((s) => partnerId && s.user_id === partnerId);

    const calculateMetrics = (userSessionList) => {
      const totalMinutes = userSessionList.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(1);

      // Topic frequencies
      const topicCounts = {};
      userSessionList.forEach((s) => {
        if (Array.isArray(s.topics)) {
          s.topics.forEach((t) => {
            topicCounts[t] = (topicCounts[t] || 0) + 1;
          });
        }
      });

      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic]) => topic);

      return { totalHours, topTopics };
    };

    const userMetrics = calculateMetrics(userSessions);
    const partnerMetrics = calculateMetrics(partnerSessions);

    // Group hours by day (0=Mon ... 6=Sun)
    const dailyUserMinutes = [0, 0, 0, 0, 0, 0, 0];
    const dailyPartnerMinutes = [0, 0, 0, 0, 0, 0, 0];

    sessions.forEach((s) => {
      const sessionDate = new Date(s.start_time);
      const dayIdx = (sessionDate.getDay() + 6) % 7; // Convert Sun(0) -> 6, Mon(1) -> 0
      if (s.user_id === currentUserId) {
        dailyUserMinutes[dayIdx] += s.duration_minutes || 0;
      } else if (partnerId && s.user_id === partnerId) {
        dailyPartnerMinutes[dayIdx] += s.duration_minutes || 0;
      }
    });

    const dailyUserHours = dailyUserMinutes.map((m) => +(m / 60).toFixed(1));
    const dailyPartnerHours = dailyPartnerMinutes.map((m) => +(m / 60).toFixed(1));

    // Determine max daily hours for proportional bar height
    const maxDayHour = Math.max(
      3,
      ...dailyUserHours,
      ...dailyPartnerHours
    );

    return {
      userMetrics,
      partnerMetrics,
      dailyUserHours,
      dailyPartnerHours,
      maxDayHour
    };
  }, [sessions, currentUserId, partnerId]);

  const currentUserName = profile?.display_name || 'You';
  const partnerName = partnerProfile?.display_name || 'Partner';
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Weekly Progress Comparison</h2>
          <span className={styles.dateRange}>
            Week of {formatDateLabel(monday)} – {formatDateLabel(sunday)} • Auto-refreshes every 60s
          </span>
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.legendUser}`} />
            <span>{currentUserName}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendColor} ${styles.legendPartner}`} />
            <span>{partnerName}</span>
          </div>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryUserHeader}>
            <span className={styles.summaryUserName}>
              <span className={`${styles.userDot} ${styles.userDotCurrent}`} />
              {currentUserName} (You)
            </span>
          </div>

          <div className={styles.hoursHighlight}>
            <span className={styles.hoursValue}>
              {loading ? '...' : `${stats.userMetrics.totalHours}h`}
            </span>
            <span className={styles.hoursLabel}>Total Studied This Week</span>
          </div>

          <div className={styles.topTopicsSection}>
            <span className={styles.topTopicsLabel}>Top Focus Areas</span>
            <div className={styles.topTopicsList}>
              {stats.userMetrics.topTopics.length > 0 ? (
                stats.userMetrics.topTopics.map((topic) => (
                  <span key={topic} className={styles.topTopicChip}>
                    {topic}
                  </span>
                ))
              ) : (
                <span className={styles.emptyTopicText}>No topics logged yet</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={styles.summaryUserHeader}>
            <span className={styles.summaryUserName}>
              <span className={`${styles.userDot} ${styles.userDotPartner}`} />
              {partnerName}
            </span>
          </div>

          <div className={styles.hoursHighlight}>
            <span className={styles.hoursValue}>
              {loading ? '...' : `${stats.partnerMetrics.totalHours}h`}
            </span>
            <span className={styles.hoursLabel}>Total Studied This Week</span>
          </div>

          <div className={styles.topTopicsSection}>
            <span className={styles.topTopicsLabel}>Top Focus Areas</span>
            <div className={styles.topTopicsList}>
              {stats.partnerMetrics.topTopics.length > 0 ? (
                stats.partnerMetrics.topTopics.map((topic) => (
                  <span key={topic} className={styles.topTopicChip}>
                    {topic}
                  </span>
                ))
              ) : (
                <span className={styles.emptyTopicText}>No topics logged yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>Daily Study Time (Hours)</h3>
        <div className={styles.chart}>
          {DAYS_OF_WEEK.map((dayName, idx) => {
            const userHrs = stats.dailyUserHours[idx];
            const partnerHrs = stats.dailyPartnerHours[idx];
            const userHeight = `${Math.min(100, (userHrs / stats.maxDayHour) * 100)}%`;
            const partnerHeight = `${Math.min(100, (partnerHrs / stats.maxDayHour) * 100)}%`;
            const isToday = idx === todayIdx;

            return (
              <div key={dayName} className={styles.dayColumn}>
                <div className={styles.barsGroup}>
                  <div className={styles.barWrapper}>
                    <div
                      className={`${styles.bar} ${styles.barUser}`}
                      style={{ height: userHrs > 0 ? userHeight : '4px' }}
                    />
                    <div className={styles.barTooltip}>{currentUserName}: {userHrs}h</div>
                  </div>

                  <div className={styles.barWrapper}>
                    <div
                      className={`${styles.bar} ${styles.barPartner}`}
                      style={{ height: partnerHrs > 0 ? partnerHeight : '4px' }}
                    />
                    <div className={styles.barTooltip}>{partnerName}: {partnerHrs}h</div>
                  </div>
                </div>

                <span className={`${styles.dayLabel} ${isToday ? styles.dayLabelActive : ''}`}>
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
