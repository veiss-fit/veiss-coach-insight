// src/hooks/useWorkoutData.js
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { generateSmartWorkoutAI } from "../utils/aiGenerator";
import { calculateWorkoutTime } from "../utils/workoutTimeCalculator";

export function useWorkoutData() {
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [workoutTime, setWorkoutTime] = useState(60);
  const [hoveredMuscle, setHoveredMuscle] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [displayedWorkout, setDisplayedWorkout] = useState({
    primary: "None Selected",
    secondary: "-",
    exercises: [],
    totalTime: 0,
  });

  const [savedHistory, setSavedHistory] = useState([]);

  useEffect(() => {
    async function fetchLogs() {
      if (!supabase) {
        console.warn("Supabase is not configured; skipping history load.");
        return;
      }

      const { data, error } = await supabase
        .from("workout_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch workout history", error);
        return;
      }

      if (data) {
        setSavedHistory(
          data.map((row) => {
            const dateObj = new Date(row.created_at);
            return {
              id: row.id,
              timestamp: `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
              primary: row.primary_muscle,
              totalTime: row.total_time,
              exercisesCount: row.exercises?.length || 0,
              exercises: row.exercises,
            };
          }),
        );
      }
    }
    fetchLogs();
  }, []);

  const handleMuscleToggle = (muscle) => {
    setSelectedMuscles((prev) => {
      let newSelection = prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle];
      if (newSelection.length === 0) {
        setDisplayedWorkout({
          primary: "None Selected",
          secondary: "-",
          exercises: [],
          totalTime: 0,
        });
      }
      return newSelection;
    });
  };

  const handleForceGenerate = async () => {
    if (selectedMuscles.length === 0) {
      alert("Please select at least one muscle group to generate a workout.");
      return;
    }

    setIsGenerating(true);

    try {
      const aiWorkout = await generateSmartWorkoutAI(
        selectedMuscles,
        workoutTime,
      );
      if (aiWorkout) {
        setDisplayedWorkout(aiWorkout);
      }
    } catch (error) {
      console.error("Workout generation failed", error);
      alert("Failed to reach AI. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateExercise = (index, field, newValue) => {
    setDisplayedWorkout((prevWorkout) => {
      if (!prevWorkout || prevWorkout.exercises.length === 0)
        return prevWorkout;

      // 1. Copy the exercises array and update the specific dropdown value
      const updatedExercises = [...prevWorkout.exercises];
      updatedExercises[index] = {
        ...updatedExercises[index],
        [field]: newValue,
      };

      // 2. Build the updated workout object
      const updatedWorkout = {
        ...prevWorkout,
        exercises: updatedExercises,
      };

      // 3. Run the ENTIRE workout through the proportional calculator
      // This perfectly redistributes the minutes across all cards!
      const perfectlyTimedWorkout = calculateWorkoutTime(
        updatedWorkout,
        prevWorkout.totalTime,
      );

      return perfectlyTimedWorkout;
    });
  };

  // 🗑️ NEW: Deletes a specific exercise from the list
  const handleDeleteExercise = (indexToDelete) => {
    setDisplayedWorkout((prevWorkout) => {
      if (!prevWorkout || !prevWorkout.exercises) return prevWorkout;

      const updatedExercises = prevWorkout.exercises.filter(
        (_, index) => index !== indexToDelete,
      );
      const freshTotalMinutes = updatedExercises.reduce(
        (sum, item) => sum + item.estTime,
        0,
      );
      setWorkoutTime(freshTotalMinutes);

      return {
        ...prevWorkout,
        exercises: updatedExercises,
        totalTime: freshTotalMinutes,
      };
    });
  };

  // 💾 RESTORED: Fully functional Supabase save logic
  const handleSaveActiveWorkout = async () => {
    if (!displayedWorkout || displayedWorkout.exercises.length === 0) {
      alert("No workout generated to save.");
      return;
    }

    if (!supabase) {
      alert("Cloud history is unavailable because Supabase is not configured.");
      return;
    }

    const { data, error } = await supabase
      .from("workout_history")
      .insert([
        {
          primary_muscle: displayedWorkout.primary,
          total_time: displayedWorkout.totalTime,
          exercises: displayedWorkout.exercises,
        },
      ])
      .select();

    if (error) {
      alert("Failed to save to cloud: " + error.message);
    } else if (data?.[0]) {
      const newRow = data[0];
      const dateObj = new Date(newRow.created_at);

      setSavedHistory((prev) => [
        {
          id: newRow.id,
          timestamp: `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          primary: newRow.primary_muscle,
          totalTime: newRow.total_time,
          exercisesCount: newRow.exercises.length,
          exercises: newRow.exercises,
        },
        ...prev,
      ]);
    }
  };

  // 🗑️ RESTORED: Fully functional Supabase clear logic
  const handleClearHistory = async () => {
    if (
      window.confirm("Are you sure you want to clear all cloud history logs?")
    ) {
      if (!supabase) {
        alert(
          "Cloud history is unavailable because Supabase is not configured.",
        );
        return;
      }

      await supabase.from("workout_history").delete().neq("id", 0);
      setSavedHistory([]);
    }
  };

  return {
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
    handleDeleteExercise, // 👈 Export new function
    handleSaveActiveWorkout,
    handleClearHistory,
  };
}
