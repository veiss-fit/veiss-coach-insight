// src/utils/exerciseImages.js

// 📁 COMPACT FOLDER MAPPING
// We group the exercises by folder to keep the code clean and easy to read.
const exerciseFolders = {
  head: [
    "Chin Tucks",
    "Head Nods",
    "Head Rotations",
    "Jaw Clenches",
    "Isometric Head Pushes",
  ],
  neck: [
    "Neck Curls",
    "Neck Extensions",
    "Lateral Neck Flexion",
    "Wrestler's Bridges",
    "Isometric Neck Holds",
  ],
  chest: [
    "Barbell Bench Press",
    "Dumbbell Bench Press",
    "Incline Dumbbell Press",
    "Decline Bench Press",
    "Dumbbell Flyes",
    "Cable Flyes",
    "Push-Ups",
    "Decline Push-Ups",
    "Dumbbell Pullovers",
    "Barbell Chest Flyes",
    "Burpees",
  ],
  core: [
    "Ab Wheel Rollouts",
    "Bicycle Crunches",
    "Cable Crunches",
    "Crunches",
    "Hanging Leg Raises",
    "Leg Raises",
    "Planks",
    "Russian Twists",
    "Side Planks",
    "Woodchoppers",
  ],
  obliques: [
    "Hollow Body Holds",
    "V-Ups",
    "Dead Bugs",
    "Toe Touches",
    "Heel Touches",
    "Side Bends",
    "Spiderman Push-Ups",
    "Windshield Wipers",
    "Pallof Press",
    "Cross-Body Mountain Climbers",
  ],
  shoulders: [
    "Overhead Press",
    "Lateral Raises",
    "Front Raises",
    "Reverse Pec Deck",
    "Arnold Press",
    "Upright Rows",
    "Cable Lateral Raises",
    "Machine Shoulder Press",
    "Push Press",
    "Face Pulls",
  ],
  biceps: [
    "Barbell Bicep Curls",
    "Dumbbell Curls",
    "Hammer Curls",
    "Preacher Curls",
    "Concentration Curls",
    "Cable Curls",
    "Incline Dumbbell Curls",
    "Reverse Curls",
    "Spider Curls",
    "Zottman Curls",
  ],
  forearms: [
    "Wrist Curls",
    "Reverse Wrist Curls",
    "Farmer's Walk",
    "Plate Pinches",
    "Reverse Barbell Curls",
    "Dead Hangs",
    "Towel Pull-Ups",
    "Wrist Roller",
    "Behind-the-Back Wrist Curls",
    "Fat Gripz Holds",
  ],
  hands: [
    "Gripper Squeezes",
    "Finger Extensions",
    "Rice Bucket Digs",
    "Fingertip Push-Ups",
    "Rubber Band Extensions",
  ],
  quadriceps: [
    "Barbell Squats",
    "Leg Press",
    "Lunges",
    "Leg Extensions",
    "Front Squats",
    "Hack Squats",
    "Bulgarian Split Squats",
    "Goblet Squats",
    "Sissy Squats",
    "Step-Ups",
  ],
  adductors: [
    "Copenhagen Planks",
    "Adductor Machine",
    "Sumo Squats",
    "Cossack Squats",
    "Side Lunges",
    "Cable Adductions",
    "Wide-Stance Leg Press",
    "Banded Adductions",
  ],
  knees: [
    "Terminal Knee Extensions",
    "Spanish Squats",
    "Poliquin Step-Ups",
    "Patrick Step-Ups",
    "Slant Board Squats",
    "Isometric Wall Sits",
    "Heel Slides",
  ],
  tibialis: [
    "Tibialis Raises",
    "Heel Walks",
    "Resistance Band Dorsiflexion",
    "Kettlebell Tibialis Raises",
    "Wall Tibialis Raises",
  ],
  ankles: [
    "Ankle Circles",
    "Banded Plantar Flexion",
    "Banded Dorsiflexion",
    "Ankle Inversions",
    "Ankle Eversons",
    "Balance Board Holds",
  ],
  feet: [
    "Towel Scrunches",
    "Marble Pickups",
    "Short Foot Exercises",
    "Toe Splay",
    "Plantar Fascia Rolls",
    "Heel Raises",
  ],
  hair: [
    "Scalp Massages",
    "Vigorous Towel Drying",
    "Post-Workout Brushing",
    "Sweaty Hair Flips",
  ],
  trapezius: [
    "Barbell Shrugs",
    "Dumbbell Shrugs",
    "Upright Rows",
    "Face Pulls",
    "Farmer's Walk",
    "Snatch-Grip High Pulls",
    "Overhead Squats",
    "Power Cleans",
    "Cable Shrugs",
    "Trap Bar Deadlifts",
  ],
  upper_back: [
    "Barbell Rows",
    "Face Pulls",
    "Rear Delt Flyes",
    "T-Bar Rows",
    "Seated Cable Rows",
    "Pendlay Rows",
    "Chest-Supported Rows",
    "Incline Dumbbell Rows",
    "Upright Rows",
    "Meadows Rows",
  ],
  lats: [
    "Pull-Ups",
    "Lat Pulldowns",
    "Straight-Arm Pulldowns",
    "Chin-Ups",
    "Single-Arm Dumbbell Rows",
    "Renegade Rows",
    "V-Bar Pulldowns",
    "Neutral Grip Pull-Ups",
    "Underhand Lat Pulldowns",
  ],
  lower_back: [
    "Deadlifts",
    "Back Extensions",
    "Good Mornings",
    "Superman Holds",
    "Bird Dogs",
    "Reverse Hyperextensions",
    "Rack Pulls",
    "Jefferson Curls",
    "Kettlebell Swings",
    "Glute-Ham Raises",
  ],
  triceps: [
    "Tricep Pushdowns",
    "Skull Crushers",
    "Overhead Tricep Extension",
    "Tricep Dips",
    "Close-Grip Bench Press",
    "Tricep Kickbacks",
    "Diamond Push-Ups",
    "Cable Overhead Extensions",
    "Rope Pushdowns",
    "Bench Dips",
  ],
  glutes: [
    "Hip Thrusts",
    "Glute Bridges",
    "Cable Kickbacks",
    "Bulgarian Split Squats",
    "Walking Lunges",
    "Sumo Squats",
    "Step-Ups",
    "Kettlebell Swings",
    "Clamshells",
    "Reverse Hyperextensions",
  ],
  hamstrings: [
    "Romanian Deadlifts",
    "Leg Curls",
    "Glute-Ham Raises",
    "Good Mornings",
    "Stiff-Legged Deadlifts",
    "Kettlebell Swings",
    "Nordic Hamstring Curls",
    "Single-Leg RDLs",
    "Lying Leg Curls",
    "Seated Leg Curls",
  ],
  calves: [
    "Calf Raises",
    "Seated Calf Raises",
    "Donkey Calf Raises",
    "Leg Press Calf Raises",
    "Single-Leg Calf Raises",
    "Jump Rope",
    "Box Jumps",
    "Farmer's Walk on Toes",
    "Sled Pushes",
  ],
};

// ⚙️ AUTOMATIC DICTIONARY GENERATOR
// This loops through the groups above and automatically creates perfect file paths.
const customImages = {};

for (const [folder, exercises] of Object.entries(exerciseFolders)) {
  for (const ex of exercises) {
    // Strips out spaces, hyphens, and apostrophes (e.g., "Push-Ups" becomes "PushUps")
    const safeFileName = ex.replace(/[^a-zA-Z0-9]/g, "");

    // Automatically maps to a .jpeg extension inside its specific folder
    customImages[ex] = `/exercises/${folder}/${safeFileName}.jpeg`;
  }
}

export function getExerciseImage(exerciseName) {
  if (!exerciseName) {
    return "https://placehold.co/120x120/1f2937/ffffff?text=Move";
  }

  // 1. Protect words that naturally end in 'ss' (like "Press") from being chopped
  const isPress = exerciseName.toLowerCase().endsWith("ss");

  // 2. Automatically generate all plural and singular versions for typos
  const nameWithoutS =
    !isPress && exerciseName.endsWith("s")
      ? exerciseName.slice(0, -1)
      : exerciseName;
  const nameWithoutEs =
    !isPress && exerciseName.endsWith("es")
      ? exerciseName.slice(0, -2)
      : exerciseName;
  const nameWithS = exerciseName + "s";
  const nameWithEs = exerciseName + "es";

  // 3. Array of variants to check against your dictionary
  const possibleMatches = [
    exerciseName,
    nameWithoutS,
    nameWithoutEs,
    nameWithS,
    nameWithEs,
  ];

  // 4. SMART MATCH: Loop through variants. If ANY match the list above, use it!
  for (const possibleName of possibleMatches) {
    const foundKey = Object.keys(customImages).find(
      (key) => key.toLowerCase() === possibleName.toLowerCase(),
    );
    if (foundKey) {
      return customImages[foundKey];
    }
  }

  // 5. Fallback Generator if the image file doesn't exist yet
  const urlSafeText = exerciseName.replace(/\s+/g, "+");
  return `https://placehold.co/120x120/1f2937/ffffff?text=${urlSafeText}&font=Montserrat`;
}
