// src/utils/aiGenerator.js
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { calculateWorkoutTime } from "./workoutTimeCalculator";

// Initialize both AI Clients
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

const exerciseFolders = {
  Head: [
    "Chin Tucks",
    "Head Nods",
    "Head Rotations",
    "Jaw Clenches",
    "Isometric Head Pushes",
  ],
  Neck: [
    "Neck Curls",
    "Neck Extensions",
    "Lateral Neck Flexion",
    "Wrestler's Bridges",
    "Isometric Neck Holds",
  ],
  Chest: [
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
  ],
  Core: [
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
  Obliques: [
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
  Shoulders: [
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
  Biceps: [
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
  Forearms: [
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
  Hands: [
    "Gripper Squeezes",
    "Finger Extensions",
    "Rice Bucket Digs",
    "Fingertip Push-Ups",
    "Rubber Band Extensions",
  ],
  Quadriceps: [
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
  Adductors: [
    "Copenhagen Planks",
    "Adductor Machine",
    "Sumo Squats",
    "Cossack Squats",
    "Side Lunges",
    "Cable Adductions",
    "Wide-Stance Leg Press",
    "Banded Adductions",
  ],
  Knees: [
    "Terminal Knee Extensions",
    "Spanish Squats",
    "Poliquin Step-Ups",
    "Patrick Step-Ups",
    "Slant Board Squats",
    "Isometric Wall Sits",
    "Heel Slides",
  ],
  Tibialis: [
    "Tibialis Raises",
    "Heel Walks",
    "Resistance Band Dorsiflexion",
    "Kettlebell Tibialis Raises",
    "Wall Tibialis Raises",
  ],
  Ankles: [
    "Ankle Circles",
    "Banded Plantar Flexion",
    "Banded Dorsiflexion",
    "Ankle Inversions",
    "Ankle Eversons",
    "Balance Board Holds",
  ],
  Feet: [
    "Towel Scrunches",
    "Marble Pickups",
    "Short Foot Exercises",
    "Toe Splay",
    "Plantar Fascia Rolls",
    "Heel Raises",
  ],
  Hair: [
    "Scalp Massages",
    "Vigorous Towel Drying",
    "Post-Workout Brushing",
    "Sweaty Hair Flips",
  ],
  Trapezius: [
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
  "Upper Back": [
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
  Lats: [
    "Pull-Ups",
    "Lat Pulldowns",
    "Straight-Arm Pulldowns",
    "Chin-Ups",
    "Single-Arm Dumbbell Rows",
    "Seated Cable Rows",
    "Renegade Rows",
    "V-Bar Pulldowns",
    "Neutral Grip Pull-Ups",
    "Underhand Lat Pulldowns",
  ],
  "Lower Back": [
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
  Triceps: [
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
  Glutes: [
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
  Hamstrings: [
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
  Calves: [
    "Calf Raises",
    "Seated Calf Raises",
    "Donkey Calf Raises",
    "Leg Press Calf Raises",
    "Single-Leg Calf Raises",
    "Jump Rope",
    "Box Jumps",
    "Tibialis Raises",
    "Farmer's Walk on Toes",
    "Sled Pushes",
  ],
};

export async function generateSmartWorkoutAI(musclesArray, timeLimit) {
  if (!musclesArray || musclesArray.length === 0) return null;
  const primaryLabel = musclesArray.join(", ");

  let allowedExercises = [];
  musclesArray.forEach((muscle) => {
    const foundKey = Object.keys(exerciseFolders).find(
      (k) => k.toLowerCase() === muscle.toLowerCase(),
    );
    if (foundKey) {
      allowedExercises = allowedExercises.concat(exerciseFolders[foundKey]);
    }
  });

  if (allowedExercises.length === 0) {
    allowedExercises = Object.values(exerciseFolders).flat();
  }

  let targetExerciseCount = Math.ceil(timeLimit / 15);
  if (targetExerciseCount > allowedExercises.length) {
    targetExerciseCount = allowedExercises.length;
  }

  const allowedString = allowedExercises.map((ex) => `"${ex}"`).join(", ");

  const prompt = `
    You are an elite sports scientist programming for an athlete. 
    Design a workout targeting: ${primaryLabel}.
    
    Rules:
    1. Generate EXACTLY ${targetExerciseCount} exercises.
    2. Every exercise must be unique. DO NOT REPEAT any exercise.
    3. FATAL ERROR PRECAUTION: You are strictly limited to ONLY these exact exercise names:
       [ ${allowedString} ]
    4. NEVER invent, modify, or combine exercise names.
    
    JSON Schema Requirement:
    Return ONLY a valid JSON object matching this exact structure:
    {
      "primary": "${primaryLabel}",
      "secondary": "List 3-5 secondary muscles engaged",
      "totalTime": ${timeLimit},
      "exercises": [
        { "name": "Exact Name From Allowed List", "sets": "4", "reps": "8", "velocity": "1.0" }
      ]
    }
  `;

  // --- ATTEMPT 1: GOOGLE GEMINI ---
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawWorkout = JSON.parse(response.text);
    return calculateWorkoutTime(rawWorkout, timeLimit);
  } catch (error) {
    console.warn(
      "Gemini Error Caught (Switching to Groq LLaMA fallback...):",
      error,
    );

    // --- ATTEMPT 2: GROQ FALLBACK (Triggered on ANY Gemini failure) ---
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
      });

      const rawWorkout = JSON.parse(chatCompletion.choices[0].message.content);
      return calculateWorkoutTime(rawWorkout, timeLimit);
    } catch (groqError) {
      console.error("Groq Fallback Error:", groqError);
      throw new Error("Both AI providers failed to generate the workout.", {
        cause: groqError,
      });
    }
  }
}
