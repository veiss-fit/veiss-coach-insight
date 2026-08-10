// src/lib/validators.ts

export const Validators = {
  // ===== EMAIL & PASSWORD =====
  email: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : "Invalid email format";
  },

  password: (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters";
    return null;
  },

  passwordConfirm: (password: string, confirmPassword: string) => {
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  },

  // ===== REQUIRED FIELDS =====
  required: (value: any, fieldName: string) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },

  // ===== PLAYER FIELDS =====
  playerName: (name: string) => {
    if (!name || name.trim().length < 2) {
      return "Player name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Player name must be less than 100 characters";
    }
    return null;
  },

  jerseyNumber: (num: string | number | null) => {
    if (num === null || num === '' || num === undefined) {
      return null; // Optional field
    }
    const n = Number(num);
    if (isNaN(n) || n < 0 || n > 99) return "Jersey number must be between 0-99";
    return null;
  },

  // ===== TEAM FIELDS =====
  teamName: (name: string) => {
    if (!name || name.trim().length < 2) {
      return "Team name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Team name must be less than 100 characters";
    }
    return null;
  },

  // ===== WORKOUT FIELDS =====
  workoutName: (name: string) => {
    if (!name || name.trim().length < 2) {
      return "Workout name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Workout name must be less than 100 characters";
    }
    return null;
  },

  exerciseName: (name: string) => {
    if (!name || name.trim().length < 2) {
      return "Exercise name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Exercise name must be less than 100 characters";
    }
    return null;
  },

  workoutSets: (sets: number) => {
    if (sets < 1 || sets > 20) {
      return "Sets must be between 1 and 20";
    }
    return null;
  },

  workoutReps: (reps: number) => {
    if (reps < 1 || reps > 100) {
      return "Reps must be between 1 and 100";
    }
    return null;
  },

  workoutWeight: (weight: number) => {
    if (weight < 0) return "Weight cannot be negative";
    if (weight > 1000) return "Weight exceeds maximum limit (1000)";
    return null;
  },

  // ===== ANNOUNCEMENT FIELDS =====
  announcementTitle: (title: string) => {
    if (!title || title.trim().length < 2) {
      return "Title must be at least 2 characters";
    }
    if (title.trim().length > 200) {
      return "Title must be less than 200 characters";
    }
    return null;
  },

  announcementMessage: (message: string) => {
    if (!message || message.trim().length < 2) {
      return "Message must be at least 2 characters";
    }
    if (message.trim().length > 1000) {
      return "Message must be less than 1000 characters";
    }
    return null;
  },

  // ===== PROFILE FIELDS =====
  fullName: (name: string) => {
    if (!name || name.trim().length < 2) {
      return "Full name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Full name must be less than 100 characters";
    }
    return null;
  },
};