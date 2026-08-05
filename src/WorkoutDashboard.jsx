// src/WorkoutDashboard.jsx
import Sidebar from "./components/Sidebar";
import AnatomyPanel from "./components/AnatomyPanel";
import WorkoutPanel from "./components/WorkoutPanel";
import { useWorkoutData } from "./hooks/useWorkoutData";
import "./WorkoutDashboard.css";

export default function WorkoutDashboard() {
  const {
    selectedMuscles,
    workoutTime,
    setWorkoutTime,
    displayedWorkout,
    savedHistory,
    hoveredMuscle,
    setHoveredMuscle,
    isGenerating,
    handleMuscleToggle,
    handleForceGenerate,
    handleUpdateExercise,
    handleDeleteExercise, // 👈 Destructure new function
    handleSaveActiveWorkout,
    handleClearHistory,
  } = useWorkoutData();

  return (
    <div className="dashboard-wrapper">
      <Sidebar
        selectedMuscles={selectedMuscles}
        onMuscleToggle={handleMuscleToggle}
        workoutTime={workoutTime}
        onTimeChange={setWorkoutTime}
        onGenerateClick={handleForceGenerate}
        isGenerating={isGenerating}
      />

      <div className="dashboard-content-grid">
        <AnatomyPanel
          selectedMuscles={selectedMuscles}
          onBodyPartClick={handleMuscleToggle}
          displayedWorkout={displayedWorkout}
          hoveredMuscle={hoveredMuscle}
          onMuscleHover={setHoveredMuscle}
        />

        <WorkoutPanel
          displayedWorkout={displayedWorkout}
          onUpdateExercise={handleUpdateExercise}
          onDeleteExercise={handleDeleteExercise} // 👈 Pass it down
          onSaveWorkout={handleSaveActiveWorkout}
          historyLogs={savedHistory}
          onClearHistory={handleClearHistory}
        />
      </div>
    </div>
  );
}
