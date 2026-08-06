// src/components/Sidebar.jsx
import { useState, useRef, useEffect } from "react";
import "./Sidebar.css";

const anteriorOptions = [
  "Head",
  "Neck",
  "Chest",
  "Core",
  "Obliques",
  "Shoulders",
  "Biceps",
  "Forearms",
  "Hands",
  "Quadriceps",
  "Adductors",
  "Knees",
  "Tibialis",
  "Ankles",
  "Feet",
];
const posteriorOptions = [
  "Hair",
  "Trapezius",
  "Upper Back",
  "Lats",
  "Lower Back",
  "Triceps",
  "Glutes",
  "Hamstrings",
  "Calves",
];

export default function Sidebar({
  selectedMuscles,
  onMuscleToggle,
  workoutTime, // This remains as absolute minutes for the rest of your app!
  onTimeChange,
  onGenerateClick,
  isGenerating,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 1. UPDATED: Warning state now holds the exact message text!
  const [warningMessage, setWarningMessage] = useState("");

  // 2. States for the custom time unit dropdown
  const [timeUnit, setTimeUnit] = useState("min");
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef(null);

  // Close dropdowns if the user clicks outside of them
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (
        unitDropdownRef.current &&
        !unitDropdownRef.current.contains(event.target)
      ) {
        setIsUnitDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. UPDATED: The Interceptor now checks for both muscles AND time
  const handleGenerateClickWrapper = () => {
    // Check 1: Did they select at least one muscle?
    if (!selectedMuscles || selectedMuscles.length === 0) {
      setWarningMessage("⚠️ Please select at least 1 Muscle Group!");
      setTimeout(() => setWarningMessage(""), 10000);
      return; // Stop generation
    }

    // Check 2: Did they enter a valid time?
    if (workoutTime <= 0) {
      setWarningMessage("⚠️ Please enter a Workout Time greater than 0!");
      setTimeout(() => setWarningMessage(""), 10000);
      return; // Stop generation
    }

    // If both checks pass, clear any warnings and generate!
    setWarningMessage("");
    onGenerateClick();
  };

  // Calculate what number to show in the input box based on the unit
  const displayValue =
    timeUnit === "sec"
      ? workoutTime * 60
      : timeUnit === "hr"
        ? +(workoutTime / 60).toFixed(2)
        : workoutTime;

  // Convert the user's input back into minutes for the rest of the app
  const handleTimeChange = (e) => {
    let val = Number(e.target.value);
    if (val < 0) val = 0;

    let minutes = val;
    if (timeUnit === "sec") minutes = val / 60;
    if (timeUnit === "hr") minutes = val * 60;

    onTimeChange(minutes);
  };

  return (
    <div className="sidebar-container">
      <h2 className="sidebar-title">Create Workout</h2>
      <p className="sidebar-subtitle">
        Generate a complete workout in seconds using AI.
      </p>

      <div className="setup-step">
        <label className="step-label">
          <span className="step-number">1</span> Muscle Groups
        </label>

        <div className="multi-select-container" ref={dropdownRef}>
          <div
            className={`modern-select ${isDropdownOpen ? "active" : ""}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {selectedMuscles.length === 0
              ? "Select Muscle Groups..."
              : selectedMuscles.length === 1
                ? selectedMuscles[0]
                : `${selectedMuscles.length} Groups Selected`}
          </div>

          {isDropdownOpen && (
            <div className="multi-select-menu">
              <div className="multi-select-group-title">Anterior (Front)</div>
              <div className="muscle-pills-container">
                {anteriorOptions.map((muscle) => (
                  <div
                    key={muscle}
                    className={`muscle-pill ${selectedMuscles.includes(muscle) ? "selected" : ""}`}
                    onClick={() => onMuscleToggle(muscle)}
                  >
                    {muscle}
                  </div>
                ))}
              </div>

              <div className="multi-select-group-title">Posterior (Back)</div>
              <div className="muscle-pills-container">
                {posteriorOptions.map((muscle) => (
                  <div
                    key={muscle}
                    className={`muscle-pill ${selectedMuscles.includes(muscle) ? "selected" : ""}`}
                    onClick={() => onMuscleToggle(muscle)}
                  >
                    {muscle}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="setup-step">
        <label className="step-label">
          <span className="step-number">2</span> Workout Time
        </label>

        {/* Updated layout with the Custom React Dropdown */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="number"
            value={displayValue}
            onChange={handleTimeChange}
            className="modern-input"
            step={timeUnit === "hr" ? "0.5" : "1"}
            style={{ flex: 1 }}
            min="0"
          />

          {/* THE CUSTOM DROPDOWN CONTAINER */}
          <div ref={unitDropdownRef} style={{ position: "relative" }}>
            {/* The Clickable Button */}
            <div
              onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                fontWeight: "bold",
                color: "#374151",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: "85px",
                justifyContent: "space-between",
                userSelect: "none",
              }}
            >
              {timeUnit === "hr" ? "hour" : timeUnit}
              <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                {isUnitDropdownOpen ? "▲" : "▼"}
              </span>
            </div>

            {/* The Floating Menu */}
            {isUnitDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: "0",
                  width: "100%",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  zIndex: 50,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {["sec", "min", "hr"].map((unit) => (
                  <div
                    key={unit}
                    onClick={() => {
                      setTimeUnit(unit);
                      setIsUnitDropdownOpen(false);
                    }}
                    style={{
                      padding: "10px 16px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: timeUnit === unit ? "#eab308" : "#4b5563",
                      backgroundColor:
                        timeUnit === unit ? "#fefce8" : "transparent",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (timeUnit !== unit)
                        e.target.style.backgroundColor = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      if (timeUnit !== unit)
                        e.target.style.backgroundColor = "transparent";
                    }}
                  >
                    {unit === "hr" ? "hour" : unit}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. UPDATED: UI block now dynamically renders the custom warning message! */}
      {warningMessage && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #f87171",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "14px",
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          {warningMessage}
        </div>
      )}

      <button
        className="ai-generate-btn"
        onClick={handleGenerateClickWrapper}
        disabled={isGenerating}
        style={{
          opacity: isGenerating ? 0.7 : 1,
          cursor: isGenerating ? "not-allowed" : "pointer",
          pointerEvents: isGenerating ? "none" : "auto",
        }}
      >
        {isGenerating ? "🧠 AI is Thinking..." : "✨ Generate Workout"}
      </button>

      <div className="ai-badge-card">
        <h4>✨ AI Powered</h4>
        <p>
          Our AI will create a personalized workout that targets your selected
          muscle groups within the time frame you choose.
        </p>
      </div>
    </div>
  );
}
