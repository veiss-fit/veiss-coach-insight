// src/utils/workoutTimeCalculator.js

function calculateWeight(exercise) {
  const sets = Number(exercise.sets) || 3;
  const reps = Number(exercise.reps) || 10;
  const velocity = Number(exercise.velocity) || 1.0;

  // Slower velocity (e.g., 0.5) increases the weight so it gets a larger slice of the total time.
  const velocityMultiplier = velocity > 0 ? 1 / velocity : 1.0;

  return sets * reps * velocityMultiplier;
}

export function calculateWorkoutTime(workout, totalTime) {
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return workout;
  }

  // Use the provided totalTime, or fallback to the workout's existing total
  const targetTime = Number(totalTime) || Number(workout.totalTime);

  // Calculate workload weight for each exercise
  const totalWeight = workout.exercises.reduce((sum, ex) => {
    return sum + calculateWeight(ex);
  }, 0);

  let assigned = 0;

  workout.exercises.forEach((ex, index) => {
    const weight = calculateWeight(ex);

    if (index === workout.exercises.length - 1) {
      // The final exercise takes the remaining balance to guarantee 100% precision
      ex.estTime = Math.max(1, targetTime - assigned);
    } else {
      // Assign time proportionally based on sets * reps * velocity
      ex.estTime = Math.max(1, Math.round((targetTime * weight) / totalWeight));
      assigned += ex.estTime;
    }
  });

  workout.totalTime = targetTime;
  workout.actualTotalTime = targetTime;

  return workout;
}
