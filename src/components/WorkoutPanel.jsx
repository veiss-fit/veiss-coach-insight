// src/components/WorkoutPanel.jsx
import { useState, useEffect, useRef } from "react";
import { getExerciseImage } from "../utils/exerciseImages";
import "./WorkoutPanel.css";

// Reusable combobox logic
function EditableDropdown({ value, options, onChange, className, unit }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="custom-combobox-container" ref={containerRef}>
      <div className="input-unit-wrapper">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className={`hybrid-combobox-input ${className}`}
        />
        <button
          type="button"
          className="combobox-arrow-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          ▼
        </button>
        {unit && <span className="outside-unit-label">{unit}</span>}
      </div>

      {isOpen && (
        <ul className="combobox-options-list">
          {options.map((option) => (
            <li
              key={option}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              className="combobox-option-item"
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WorkoutPanel({
  displayedWorkout,
  onUpdateExercise,
  onDeleteExercise,
  onSaveWorkout,
  historyLogs,
  onClearHistory,
}) {
  return (
    <div className="workout-panel-container">
      <div className="panel-header-row">
        <div className="header-meta">
          <h3>Generated Workout</h3>
          <span className="time-badge">
            ⏱️ {displayedWorkout?.totalTime || 0} min total
          </span>
        </div>
        <button className="save-workout-btn" onClick={onSaveWorkout}>
          Save Workout
        </button>
      </div>

      <div className="exercise-list-stack">
        {displayedWorkout?.exercises?.map((item, index) => (
          <div key={index} className="exercise-card">
            <button
              className="delete-exercise-btn"
              onClick={() => onDeleteExercise(index)}
              title="Remove Exercise"
            >
              ⋮
            </button>

            {/* 🖼️ LEFT SIDE: Number and Image */}
            <div className="exercise-visuals">
              <span className="exercise-index">{index + 1}</span>
              <div className="exercise-thumbnail">
                <img
                  src={getExerciseImage(item.name)}
                  alt={item.name}
                  loading="lazy"
                />
              </div>
            </div>

            {/* 📝 RIGHT SIDE: Name on Top, Metrics on Bottom */}
            <div className="exercise-details">
              <input
                type="text"
                value={item.name}
                onChange={(e) =>
                  onUpdateExercise(index, "name", e.target.value)
                }
                className="editable-exercise-name-input"
              />

              <div className="exercise-metrics-grid">
                <div className="metric-box">
                  <label className="metric-label">Sets</label>
                  <EditableDropdown
                    value={item.sets}
                    options={["1", "2", "3", "4", "5", "6"]}
                    onChange={(val) => onUpdateExercise(index, "sets", val)}
                    className="spec-small"
                  />
                </div>

                <div className="metric-box">
                  <label className="metric-label">Reps</label>
                  <EditableDropdown
                    value={item.reps}
                    options={["5", "8", "10", "12", "15", "20", "AMRAP"]}
                    onChange={(val) => onUpdateExercise(index, "reps", val)}
                    className="spec-medium"
                  />
                </div>

                <div className="metric-box">
                  <label className="metric-label">Velocity</label>
                  <EditableDropdown
                    value={item.velocity}
                    options={["1.2", "1.1", "1.0", "0.9", "0.8"]}
                    onChange={(val) => onUpdateExercise(index, "velocity", val)}
                    className="velocity-field"
                    unit="m/s"
                  />
                </div>

                <div className="metric-box">
                  <label className="metric-label">Est. Time</label>
                  <div className="input-unit-wrapper static-readout-padding">
                    <span className="calculated-time-text">{item.estTime}</span>
                    <span className="outside-unit-label text-gray">min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-history-section">
        <div className="analytics-header">
          <h4>📊 History Analysis Log ({historyLogs.length})</h4>
          {historyLogs.length > 0 && (
            <button className="clear-log-btn" onClick={onClearHistory}>
              Clear Logs
            </button>
          )}
        </div>
        <div className="history-timeline-scroll">
          {historyLogs.map((log) => (
            <div key={log.id} className="history-log-item">
              <div className="log-meta">
                <span className="log-date">{log.timestamp}</span>
                <span className="log-muscle-tag">{log.primary} Target</span>
              </div>
              <div className="log-summary">
                <span>⚡ {log.exercisesCount} Moves</span>
                <span>⏱️ {log.totalTime} min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
