import React, { useMemo, useState } from 'react';
import styles from './HeatmapGrid.module.css';

const WEEKS_COUNT = 20; // 20 weeks (~5 months)

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HeatmapGrid({ sessions = [], userName = 'Student' }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  // Group session data by day
  const sessionsByDay = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      const d = new Date(s.start_time);
      const key = formatDateKey(d);
      if (!map[key]) {
        map[key] = {
          minutes: 0,
          count: 0,
          topics: new Set()
        };
      }
      map[key].minutes += s.duration_minutes || 0;
      map[key].count += 1;
      if (Array.isArray(s.topics)) {
        s.topics.forEach((t) => map[key].topics.add(t));
      }
    });
    return map;
  }, [sessions]);

  // Generate 20 weeks of days ending at current week's Sunday
  const { weeks, monthLabels, totalActiveDays, totalStudiedHours } = useMemo(() => {
    const today = new Date();
    // Find current week's Sunday
    const currentDay = today.getDay(); // 0 is Sun, 1 is Mon
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + daysToSunday);
    endSunday.setHours(23, 59, 59, 999);

    const totalDays = WEEKS_COUNT * 7;
    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - totalDays + 1);
    startDate.setHours(0, 0, 0, 0);

    const generatedWeeks = [];
    const months = [];
    let lastMonth = -1;
    let activeDaysCount = 0;
    let totalMins = 0;

    let iterDate = new Date(startDate);

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const weekDays = [];
      const monthForCol = iterDate.getMonth();

      if (monthForCol !== lastMonth) {
        months.push({
          colIndex: w,
          name: iterDate.toLocaleDateString(undefined, { month: 'short' })
        });
        lastMonth = monthForCol;
      }

      for (let d = 0; d < 7; d++) {
        const key = formatDateKey(iterDate);
        const dayData = sessionsByDay[key];
        const minutes = dayData ? dayData.minutes : 0;
        const count = dayData ? dayData.count : 0;
        const topics = dayData ? Array.from(dayData.topics) : [];

        if (minutes > 0) {
          activeDaysCount++;
          totalMins += minutes;
        }

        let level = 0;
        if (minutes > 0 && minutes < 60) level = 1;
        else if (minutes >= 60 && minutes < 150) level = 2;
        else if (minutes >= 150 && minutes < 240) level = 3;
        else if (minutes >= 240) level = 4;

        weekDays.push({
          date: new Date(iterDate),
          key,
          minutes,
          hours: +(minutes / 60).toFixed(1),
          count,
          topics,
          level,
          isFuture: iterDate > today
        });

        iterDate.setDate(iterDate.getDate() + 1);
      }
      generatedWeeks.push(weekDays);
    }

    return {
      weeks: generatedWeeks,
      monthLabels: months,
      totalActiveDays: activeDaysCount,
      totalStudiedHours: +(totalMins / 60).toFixed(1)
    };
  }, [sessionsByDay]);

  const getLevelClass = (level) => {
    switch (level) {
      case 1:
        return styles.lvl1;
      case 2:
        return styles.lvl2;
      case 3:
        return styles.lvl3;
      case 4:
        return styles.lvl4;
      default:
        return styles.lvl0;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>
            <span>🟩</span>
            <span>Study Consistency Heatmap</span>
          </h3>
          <span className={styles.subtitle}>
            {totalActiveDays} active study days • {totalStudiedHours} total hours logged across last {WEEKS_COUNT} weeks
          </span>
        </div>

        <div className={styles.legendArea}>
          <span>Less</span>
          <div className={styles.legendBoxes}>
            <div className={`${styles.dayBox} ${styles.lvl0}`} />
            <div className={`${styles.dayBox} ${styles.lvl1}`} />
            <div className={`${styles.dayBox} ${styles.lvl2}`} />
            <div className={`${styles.dayBox} ${styles.lvl3}`} />
            <div className={`${styles.dayBox} ${styles.lvl4}`} />
          </div>
          <span>More</span>
        </div>
      </div>

      <div className={styles.heatmapWrapper}>
        <div className={styles.weekdayLabels}>
          <div>Mon</div>
          <div></div>
          <div>Wed</div>
          <div></div>
          <div>Fri</div>
          <div></div>
          <div>Sun</div>
        </div>

        <div className={styles.weeksContainer}>
          <div className={styles.monthLabelsRow}>
            {monthLabels.map((m) => (
              <span
                key={`${m.colIndex}-${m.name}`}
                style={{
                  position: 'absolute',
                  left: `${m.colIndex * 16}px`
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          <div className={styles.grid}>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className={styles.weekCol}>
                {week.map((day) => (
                  <div
                    key={day.key}
                    className={`${styles.dayBox} ${day.isFuture ? styles.lvl0 : getLevelClass(day.level)}`}
                    style={{ opacity: day.isFuture ? 0.35 : 1 }}
                    onMouseEnter={() => !day.isFuture && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {hoveredDay?.key === day.key && (
                      <div className={styles.tooltip}>
                        <span className={styles.tooltipDate}>
                          {day.date.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className={styles.tooltipStats}>
                          {day.hours > 0 ? `${day.hours}h (${day.count} sprint${day.count > 1 ? 's' : ''})` : 'No study logged'}
                        </span>
                        {day.topics.length > 0 && (
                          <span className={styles.tooltipTopics}>
                            {day.topics.slice(0, 3).join(', ')}
                            {day.topics.length > 3 ? ` +${day.topics.length - 3} more` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
