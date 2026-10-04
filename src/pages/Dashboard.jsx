import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import Nav from '../components/Nav';
import StatusCard from '../components/StatusCard';
import SessionLogger from '../components/SessionLogger';
import WeeklyStats from '../components/WeeklyStats';
import styles from './Dashboard.module.css';

function calculateQuotaAndStreak(userId, sessions, quotaHours = 3.0) {
  if (!userId) return null;

  const userSessions = sessions.filter((s) => s.user_id === userId);

  // Group minutes by local date string (YYYY-MM-DD)
  const dayMinutes = {};
  userSessions.forEach((s) => {
    const d = new Date(s.start_time);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    dayMinutes[dateKey] = (dayMinutes[dateKey] || 0) + (s.duration_minutes || 0);
  });

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const todayMinutes = dayMinutes[todayKey] || 0;
  const todayHours = +(todayMinutes / 60).toFixed(1);
  const quotaMinutes = quotaHours * 60;
  const quotaMet = todayMinutes >= quotaMinutes;

  // Streak calculation:
  // Check consecutive days backwards
  let streak = 0;
  let checkDate = new Date(now);

  if (quotaMet) {
    streak += 1;
  }

  checkDate.setDate(checkDate.getDate() - 1);
  const yesterdayKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(checkDate.getDate()).padStart(2, '0')}`;
  const missedYesterday = (dayMinutes[yesterdayKey] || 0) < quotaMinutes;

  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const mins = dayMinutes[key] || 0;
    if (mins >= quotaMinutes) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    todayMinutes,
    todayHours,
    quotaHours,
    quotaMet,
    streak,
    missedYesterday
  };
}

export default function Dashboard() {
  const { user, profile, partnerProfile, refreshProfiles } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoggerOpen, setIsLoggerOpen] = useState(false);
  const [loggerSessionStart, setLoggerSessionStart] = useState(null);

  const fetchRecentSessions = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .gte('start_time', thirtyDaysAgo.toISOString())
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching recent sessions:', error.message);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Unexpected error loading sessions for quota:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecentSessions();

    // Listen to realtime additions in sessions
    const channel = supabase
      .channel('realtime_sessions_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          fetchRecentSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecentSessions]);

  const userQuotaStats = useMemo(() => {
    return calculateQuotaAndStreak(user?.id, sessions, profile?.daily_quota_hours || 3.0);
  }, [user?.id, sessions, profile?.daily_quota_hours]);

  const partnerQuotaStats = useMemo(() => {
    return calculateQuotaAndStreak(
      partnerProfile?.id,
      sessions,
      partnerProfile?.daily_quota_hours || 3.0
    );
  }, [partnerProfile?.id, sessions, partnerProfile?.daily_quota_hours]);

  const handleOpenLogger = (sessionStart) => {
    setLoggerSessionStart(sessionStart || new Date().toISOString());
    setIsLoggerOpen(true);
  };

  const handleCloseLogger = () => {
    setIsLoggerOpen(false);
    setLoggerSessionStart(null);
  };

  const handleLogSaved = async () => {
    handleCloseLogger();
    await refreshProfiles();
    await fetchRecentSessions();
  };

  return (
    <div className={styles.layout}>
      <Nav />

      <main className={styles.mainContent}>
        <section className={styles.pageHeader}>
          <h1 className={styles.title}>Live Placement Tracker</h1>
          <p className={styles.subtitle}>
            Synchronized real-time accountability, strict daily quotas, and verified sprint tracking.
          </p>
        </section>

        <section className={styles.statusGrid}>
          <StatusCard
            profile={profile}
            isCurrentUser={true}
            onOpenLogger={handleOpenLogger}
            quotaStats={userQuotaStats}
          />

          {partnerProfile ? (
            <StatusCard
              profile={partnerProfile}
              isCurrentUser={false}
              onOpenLogger={handleOpenLogger}
              quotaStats={partnerQuotaStats}
            />
          ) : (
            <div className={styles.emptyPartnerNote}>
              <p className={styles.emptyPartnerTitle}>Waiting for Partner Account</p>
              <p>
                Once your partner creates their account and signs in, their live status card and
                study timer will automatically appear here.
              </p>
            </div>
          )}
        </section>

        <WeeklyStats />
      </main>

      {isLoggerOpen && (
        <SessionLogger
          sessionStart={loggerSessionStart}
          onClose={handleCloseLogger}
          onSaved={handleLogSaved}
        />
      )}
    </div>
  );
}
