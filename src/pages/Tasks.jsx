import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../App';
import Nav from '../components/Nav';
import TaskCard from '../components/TaskCard';
import CreateTaskModal from '../components/CreateTaskModal';
import styles from './Tasks.module.css';

const TOPICS = [
  'All Topics',
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

export default function Tasks() {
  const { user, profile, partnerProfile, profiles } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('to_me'); // 'to_me' | 'to_partner'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentUserId = user?.id;
  const partnerId = partnerProfile?.id;
  const partnerName = partnerProfile?.display_name || partnerProfile?.email?.split('@')[0] || 'Partner';

  const profilesMap = useMemo(() => {
    const map = {};
    profiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error.message);
        return;
      }

      setTasks(data || []);
    } catch (err) {
      console.error('Unexpected error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();

    // Supabase Realtime subscription on tasks
    const channel = supabase
      .channel('realtime_tasks_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  // Tab counts
  const pendingToMeCount = useMemo(() => {
    return tasks.filter((t) => t.assigned_to === currentUserId && t.status === 'pending').length;
  }, [tasks, currentUserId]);

  const pendingToPartnerCount = useMemo(() => {
    return tasks.filter((t) => partnerId && t.assigned_to === partnerId && t.status === 'pending').length;
  }, [tasks, partnerId]);

  // Filtered tasks for the active tab
  const displayedTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Tab filter
      if (activeTab === 'to_me') {
        if (t.assigned_to !== currentUserId) return false;
      } else {
        if (!partnerId || t.assigned_to !== partnerId) return false;
      }

      // 2. Status filter
      if (statusFilter === 'in_progress' && t.status !== 'in_progress') return false;
      if (statusFilter === 'pending' && t.status !== 'pending') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;

      // 3. Topic filter
      if (selectedTopic !== 'All Topics' && t.topic !== selectedTopic) return false;

      return true;
    });
  }, [tasks, activeTab, currentUserId, partnerId, statusFilter, selectedTopic]);

  const activeToMeCount = useMemo(() => {
    return tasks.filter((t) => t.assigned_to === currentUserId && (t.status === 'pending' || t.status === 'in_progress')).length;
  }, [tasks, currentUserId]);

  const activeToPartnerCount = useMemo(() => {
    return tasks.filter((t) => partnerId && t.assigned_to === partnerId && (t.status === 'pending' || t.status === 'in_progress')).length;
  }, [tasks, partnerId]);


  return (
    <div className={styles.layout}>
      <Nav />

      <main className={styles.mainContent}>
        <section className={styles.pageHeader}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Peer Tasks & Problem Assignments</h1>
            <p className={styles.subtitle}>
              {activeTab === 'to_me'
                ? `Problems and challenges assigned to you by ${partnerName}. Accept to start your timer!`
                : `Tasks and placement problems you assigned to ${partnerName}.`}
            </p>
          </div>

          <button
            type="button"
            className={styles.assignBtn}
            onClick={() => {
              setActiveTab('to_partner');
              setIsCreateOpen(true);
            }}
          >
            <span>➕</span>
            <span>Assign Task to {partnerName}</span>
          </button>
        </section>

        {/* Tab switcher */}
        <section className={styles.tabsContainer} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'to_me'}
            className={`${styles.tabBtn} ${activeTab === 'to_me' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('to_me')}
          >
            <span>📥</span>
            <span>Assigned to Me</span>
            {activeToMeCount > 0 && (
              <span className={styles.tabBadge}>{activeToMeCount}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'to_partner'}
            className={`${styles.tabBtn} ${activeTab === 'to_partner' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('to_partner')}
          >
            <span>📤</span>
            <span>Assigned to {partnerName}</span>
            {activeToPartnerCount > 0 && (
              <span className={styles.tabBadge}>{activeToPartnerCount}</span>
            )}
          </button>
        </section>

        {/* Filters & Sorting Toolbar */}
        <section className={styles.toolbar}>
          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'all' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'in_progress' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              ⚡ In Progress
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'pending' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              ⏳ Pending
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'completed' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              ✅ Completed
            </button>
          </div>

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className={styles.topicSelect}
          >
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </section>

        {/* Tasks List */}
        <section className={styles.tasksList}>
          {loading ? (
            <div className={styles.loadingIndicator}>Loading assigned tasks...</div>
          ) : activeTab === 'to_partner' && !partnerProfile ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⏳</div>
              <h3 className={styles.emptyTitle}>Partner Not Registered Yet</h3>
              <p className={styles.emptyDesc}>
                Once your partner signs in, you can assign them LeetCode problems, subject topics,
                and deadlines right here.
              </p>
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3 className={styles.emptyTitle}>
                {activeTab === 'to_me' ? 'No Tasks Assigned to You' : 'No Tasks Assigned Yet'}
              </h3>
              <p className={styles.emptyDesc}>
                {activeTab === 'to_me'
                  ? `You don't have any tasks assigned from ${partnerName} under this filter. When ${partnerName} assigns you a problem, it will appear here for you to accept and solve.`
                  : `You haven't assigned any active tasks to ${partnerName} under this filter.`}
              </p>
              {activeTab === 'to_partner' && (
                <button
                  type="button"
                  className={styles.assignBtn}
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setIsCreateOpen(true)}
                >
                  <span>➕</span>
                  <span>Assign a Task to {partnerName}</span>
                </button>
              )}
            </div>
          ) : (
            displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={currentUserId}
                profilesMap={profilesMap}
                onTaskUpdated={fetchTasks}
              />
            ))
          )}
        </section>
      </main>

      {isCreateOpen && (
        <CreateTaskModal
          onClose={() => setIsCreateOpen(false)}
          onTaskCreated={fetchTasks}
          currentUserId={currentUserId}
          partnerProfile={partnerProfile}
        />
      )}
    </div>
  );
}
