import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import Nav from '../components/Nav';
import HeatmapGrid from '../components/HeatmapGrid';
import styles from './Profile.module.css';

export default function Profile() {
  const { user, profile, partnerProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('mine');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isMine = activeTab === 'mine';
  const currentProfile = isMine ? profile : partnerProfile;
  const targetUserId = isMine ? user?.id : partnerProfile?.id;
  const displayName = currentProfile?.display_name || currentProfile?.email?.split('@')[0] || (isMine ? 'You' : 'Partner');
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const fetchUserSessions = useCallback(async () => {
    if (!targetUserId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', targetUserId)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching user profile sessions:', error.message);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Unexpected error fetching profile sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchUserSessions();
  }, [fetchUserSessions]);

  // Compute all metrics, streaks, problems, and topic breakdown
  const stats = useMemo(() => {
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const totalHours = +(totalMinutes / 60).toFixed(1);
    const sessionCount = sessions.length;

    // Problems breakdown
    let easy = 0;
    let medium = 0;
    let hard = 0;

    sessions.forEach((s) => {
      if (s.problems_solved) {
        easy += Number(s.problems_solved.easy) || 0;
        medium += Number(s.problems_solved.medium) || 0;
        hard += Number(s.problems_solved.hard) || 0;
      }
    });

    const totalProblems = easy + medium + hard;

    // Topic breakdown: time and count per topic
    const topicData = {};
    sessions.forEach((s) => {
      const mins = s.duration_minutes || 0;
      if (Array.isArray(s.topics)) {
        s.topics.forEach((t) => {
          if (!topicData[t]) {
            topicData[t] = { minutes: 0, count: 0 };
          }
          topicData[t].minutes += mins;
          topicData[t].count += 1;
        });
      }
    });

    const topicList = Object.entries(topicData)
      .map(([name, data]) => ({
        name,
        hours: +(data.minutes / 60).toFixed(1),
        minutes: data.minutes,
        count: data.count,
        percent: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // Streak calculation
    const quotaHours = currentProfile?.daily_quota_hours || 3.0;
    const quotaMins = quotaHours * 60;
    const dayMins = {};

    sessions.forEach((s) => {
      const d = new Date(s.start_time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayMins[key] = (dayMins[key] || 0) + (s.duration_minutes || 0);
    });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let streak = 0;

    if ((dayMins[todayKey] || 0) >= quotaMins) {
      streak += 1;
    }

    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - 1);

    while (true) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if ((dayMins[key] || 0) >= quotaMins) {
        streak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      totalHours,
      totalMinutes,
      sessionCount,
      easy,
      medium,
      hard,
      totalProblems,
      topicList,
      streak,
      quotaHours
    };
  }, [sessions, currentProfile?.daily_quota_hours]);

  return (
    <div className={styles.layout}>
      <Nav />

      <main className={styles.mainContent}>
        {/* Profile Switcher Tabs */}
        <section className={styles.tabsContainer} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mine'}
            className={`${styles.tabBtn} ${activeTab === 'mine' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            <span>👤</span>
            <span>My Profile</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'partner'}
            className={`${styles.tabBtn} ${activeTab === 'partner' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('partner')}
          >
            <span>🤝</span>
            <span>{partnerProfile?.display_name || 'Partner'}&apos;s Profile</span>
          </button>
        </section>

        {!currentProfile && !isMine ? (
          <div className={styles.emptyState}>
            <h3>Partner Not Registered</h3>
            <p>Your partner has not signed in yet. Their profile will appear once they activate their account.</p>
          </div>
        ) : (
          <>
            {/* User Bio & High-Level Metrics */}
            <section className={styles.profileCard}>
              <div className={styles.userBioRow}>
                <div className={styles.avatarArea}>
                  <div className={styles.bigAvatar}>{avatarLetter}</div>
                  <div className={styles.userTitles}>
                    <div className={styles.nameRow}>
                      <h1 className={styles.name}>{displayName}</h1>
                      <span className={styles.roleTag}>{isMine ? 'You' : 'Partner'}</span>
                    </div>
                    <span className={styles.email}>{currentProfile?.email || 'Placement Candidate'}</span>
                  </div>
                </div>

                <div className={styles.badgesArea}>
                  <div className={`${styles.statBadge} ${styles.statBadgeFlame}`}>
                    <span>🔥</span>
                    <span>{stats.streak}-Day Quota Streak</span>
                  </div>
                  <div className={`${styles.statBadge} ${styles.statBadgeGoal}`}>
                    <span>🎯</span>
                    <span>Daily Goal: {stats.quotaHours}h</span>
                  </div>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Total Time Dedicated</span>
                  <span className={styles.metricValue}>
                    {loading ? '...' : `${stats.totalHours}h`}
                  </span>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Study Sprints</span>
                  <span className={styles.metricValue}>
                    {loading ? '...' : stats.sessionCount}
                  </span>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Questions Solved</span>
                  <span className={styles.metricValue}>
                    {loading ? '...' : stats.totalProblems}
                  </span>
                  <div className={styles.problemPills}>
                    <span className={styles.probPill}>🟢 {stats.easy}</span>
                    <span className={styles.probPill}>🟡 {stats.medium}</span>
                    <span className={styles.probPill}>🔴 {stats.hard}</span>
                  </div>
                </div>

                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Avg Sprint Length</span>
                  <span className={styles.metricValue}>
                    {loading || stats.sessionCount === 0
                      ? '0m'
                      : `${Math.round(stats.totalMinutes / stats.sessionCount)}m`}
                  </span>
                </div>
              </div>
            </section>

            {/* LeetCode-style Consistency Heatmap */}
            <HeatmapGrid sessions={sessions} userName={displayName} />

            {/* What Was Studied & For How Much Time */}
            <section className={styles.topicsSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Topic Mastery & Time Investment</h2>
                <p className={styles.sectionSubtitle}>
                  Exact breakdown of time spent on placement topics, interview prep, and problem categories
                </p>
              </div>

              {stats.topicList.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No placement topics logged yet.</p>
                </div>
              ) : (
                <div className={styles.topicCardsGrid}>
                  {stats.topicList.map((topic) => (
                    <div key={topic.name} className={styles.topicCard}>
                      <div className={styles.topicCardHeader}>
                        <span className={styles.topicName}>{topic.name}</span>
                        <span className={styles.topicHours}>{topic.hours}h</span>
                      </div>

                      <div className={styles.topicProgressTrack}>
                        <div
                          className={styles.topicProgressFill}
                          style={{ width: `${Math.min(100, Math.max(8, topic.percent))}%` }}
                        />
                      </div>

                      <div className={styles.topicFooter}>
                        <span>{topic.count} sprint{topic.count > 1 ? 's' : ''}</span>
                        <span>{topic.percent}% of total study</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
