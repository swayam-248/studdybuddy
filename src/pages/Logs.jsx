import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import Nav from '../components/Nav';
import LogEntry from '../components/LogEntry';
import styles from './Logs.module.css';

export default function Logs() {
  const { user, partnerProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' | 'partner'
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const partnerName = partnerProfile?.display_name || partnerProfile?.email?.split('@')[0] || 'Partner';

  const selectedUserId = activeTab === 'mine' ? user?.id : partnerProfile?.id;

  const fetchSessions = useCallback(async () => {
    if (!selectedUserId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', selectedUserId)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error.message);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error('Unexpected error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Summary metrics: total hours and session count
  const summary = useMemo(() => {
    const count = sessions.length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    return { count, totalHours };
  }, [sessions]);

  return (
    <div className={styles.layout}>
      <Nav />

      <main className={styles.mainContent}>
        <section className={styles.pageHeader}>
          <h1 className={styles.title}>Study Logs</h1>
          <p className={styles.subtitle}>
            Review placement preparation history, problem-solving sprints, and focus logs.
          </p>
        </section>

        <section className={styles.tabsContainer} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mine'}
            className={`${styles.tabBtn} ${activeTab === 'mine' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('mine')}
          >
            <span>👤</span>
            <span>Mine</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'partner'}
            className={`${styles.tabBtn} ${activeTab === 'partner' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('partner')}
          >
            <span>🤝</span>
            <span>{partnerName}&apos;s Logs</span>
          </button>
        </section>

        <section className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Dedicated Time</span>
            <span className={styles.summaryValue}>{loading ? '...' : `${summary.totalHours} hrs`}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Completed Sessions</span>
            <span className={styles.summaryValue}>{loading ? '...' : summary.count}</span>
          </div>
        </section>

        <section className={styles.logsList}>
          {loading ? (
            <div className={styles.loadingIndicator}>Loading study logs...</div>
          ) : activeTab === 'partner' && !partnerProfile ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⏳</div>
              <h3 className={styles.emptyTitle}>Partner Not Registered</h3>
              <p className={styles.emptyDesc}>
                Your study partner has not logged in yet. Once their profile is activated, their
                logged sessions will be visible here.
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <h3 className={styles.emptyTitle}>No Sessions Logged Yet</h3>
              <p className={styles.emptyDesc}>
                {activeTab === 'mine'
                  ? 'Complete your first study sprint on the dashboard to log your focus topics and progress.'
                  : `${partnerName} has not logged any study sessions yet.`}
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <LogEntry key={session.id} session={session} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
