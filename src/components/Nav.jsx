import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';
import styles from './Nav.module.css';

export default function Nav() {
  const { profile, user, signOut, theme, toggleTheme } = useAuth();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Student';

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">⚡</span>
          <span>StudyBuddy</span>
        </NavLink>

        <nav aria-label="Main Navigation">
          <ul className={styles.navLinks}>
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/logs"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                Logs
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                Profile
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                Tasks
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/chat"
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                Chat 💬
              </NavLink>
            </li>
          </ul>
        </nav>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span role="img" aria-label="Dark mode">🌙</span>
            <span role="img" aria-label="Light mode">☀️</span>
            <span
              className={`${styles.themePill} ${
                theme === 'light' ? styles.themePillLight : ''
              }`}
            />
          </button>

          <div className={styles.userInfo}>
            <span className={styles.userName}>{displayName}</span>
            <button
              type="button"
              className={styles.signOutBtn}
              onClick={signOut}
              title="Sign out of your session"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
