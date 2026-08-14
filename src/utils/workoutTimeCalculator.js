// src/utils/workoutTimeCalculator.js

function calculateWeight(exercise) {
  const sets = Math.min(Number(exercise.sets) || 3, 5);
  const reps = Math.min(Number(exercise.reps) || 10, 15);

  const velocity = Number(exercise.velocity) || 1.0;

  const velocityMultiplier = velocity > 0 ? 1 / velocity : 1.0;

  return sets * reps * velocityMultiplier;
}

export function calculateWorkoutTime(workout, totalTime) {
  if (!workout || !workout.exercises || workout.exercises.length === 0) {
    return workout;
  }

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
      // Assign time proportionally based on the safely capped weight
      ex.estTime = Math.max(1, Math.round((targetTime * weight) / totalWeight));
      assigned += ex.estTime;
    }
  });

  workout.totalTime = targetTime;
  workout.actualTotalTime = targetTime;

  return workout;
}
