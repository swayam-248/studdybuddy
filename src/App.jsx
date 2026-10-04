import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';

import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';





export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studybuddy_theme') || 'dark';
  });

  // Apply theme to html data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studybuddy_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error('Error fetching profiles:', error.message);
        return;
      }

      if (data) {
        setProfiles(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching profiles:', err);
    }
  };

  // Auth session listener and initial load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfiles();
        }
      } catch (err) {
        console.error('Error getting auth session:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfiles();
      } else {
        setProfiles([]);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Supabase Realtime subscription for profiles table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime_profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          setProfiles((currentProfiles) => {
            const updated = [...currentProfiles];
            const index = updated.findIndex((p) => p.id === payload.new.id);
            if (index !== -1) {
              updated[index] = payload.new;
            } else {
              updated.push(payload.new);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Derived profiles
  const profile = useMemo(() => {
    if (!user || profiles.length === 0) return null;
    return profiles.find((p) => p.id === user.id) || null;
  }, [user, profiles]);

  const partnerProfile = useMemo(() => {
    if (!user || profiles.length === 0) return null;
    return profiles.find((p) => p.id !== user.id) || null;
  }, [user, profiles]);

  // Status updater helper
  const updateStatus = async (
    status,
    sessionStart = null,
    breakStart = null,
    breakDurationMinutes = null
  ) => {
    if (!user) return { error: new Error('User not authenticated') };

    const updatePayload = {
      status,
      session_start: sessionStart,
      break_start: breakStart,
      break_duration_minutes: breakDurationMinutes,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update status:', error.message);
      return { error };
    }

    // Optimistically update local state
    setProfiles((prev) =>
      prev.map((p) => (p.id === user.id ? { ...p, ...updatePayload } : p))
    );

    return { error: null };
  };

  // Sign out: set user status to offline before logging out
  const signOut = async () => {
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({
            status: 'offline',
            session_start: null,
            break_start: null,
            break_duration_minutes: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error('Error updating status before sign out:', err);
    } finally {
      await supabase.auth.signOut();
      setUser(null);
      setProfiles([]);
    }
  };

  const value = {
    user,
    profile,
    partnerProfile,
    profiles,
    loading,
    theme,
    toggleTheme,
    updateStatus,
    signOut,
    refreshProfiles: fetchProfiles
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.95rem'
        }}
      >
        Initializing session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Logs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
