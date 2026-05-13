// TypeScript types for Supabase database schema
// These match the tables in your Supabase database

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: 'player' | 'coach' | 'admin';
          created_at: string;
          player_id: string | null;
          coach_id: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role: 'player' | 'coach' | 'admin';
          created_at?: string;
          player_id?: string | null;
          coach_id?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: 'player' | 'coach' | 'admin';
          created_at?: string;
          player_id?: string | null;
          coach_id?: string | null;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          sport: string;
          created_at: string;
          invite_code: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          sport: string;
          created_at?: string;
          invite_code?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          sport?: string;
          created_at?: string;
          invite_code?: string | null;
        };
      };
      coaches: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          team_id: string;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          team_id: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          team_id?: string;
          created_at?: string;
          user_id?: string | null;
        };
      };
      players: {
        Row: {
          id: string;
          full_name: string;
          team_id: string | null;
          jersey_number: number | null;
          created_at: string;
          user_id: string | null;
          level: 'Varsity' | 'JV';
        };
        Insert: {
          id?: string;
          full_name: string;
          team_id?: string | null;
          jersey_number?: number | null;
          created_at?: string;
          user_id?: string | null;
          level?: 'Varsity' | 'JV';
        };
        Update: {
          id?: string;
          full_name?: string;
          team_id?: string | null;
          jersey_number?: number | null;
          created_at?: string;
          user_id?: string | null;
          level?: 'Varsity' | 'JV';
        };
      };
      sessions: {
        Row: {
          id: string;
          team_id: string | null;
          coach_id: string | null;
          user_id: string;
          name: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
          metrics: Json;
          status: string;
        };
        Insert: {
          id?: string;
          team_id?: string | null;
          coach_id?: string | null;
          user_id: string;
          name: string;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metrics?: Json;
          status: string;
        };
        Update: {
          id?: string;
          team_id?: string | null;
          coach_id?: string | null;
          user_id?: string;
          name?: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metrics?: Json;
          status?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          exercise_name: string;
          machine_name: string | null;
          metrics: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          exercise_name: string;
          machine_name?: string | null;
          metrics?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          exercise_name?: string;
          machine_name?: string | null;
          metrics?: Json;
          created_at?: string;
        };
      };
      reps: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          exercise_name: string;
          machine_name: string | null;
          set_number: number;
          rep_number: number;
          weight: number | null;
          average_rep_speed: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          exercise_name: string;
          machine_name?: string | null;
          set_number: number;
          rep_number: number;
          weight?: number | null;
          average_rep_speed?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          exercise_name?: string;
          machine_name?: string | null;
          set_number?: number;
          rep_number?: number;
          weight?: number | null;
          average_rep_speed?: number | null;
          created_at?: string;
        };
      };
      workout_plans: {
        Row: {
          id: string;
          player_id: string;
          coach_id: string | null;
          date: string; // DATE field (not scheduled_date)
          title: string; // Workout name
          description: string | null;
          exercises: Json; // JSONB array of exercises
          notes: string | null;
          is_completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          coach_id?: string | null;
          date: string; // YYYY-MM-DD format
          title: string;
          description?: string | null;
          exercises: Json; // JSONB array
          notes?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          coach_id?: string | null;
          date?: string;
          title?: string;
          description?: string | null;
          exercises?: Json;
          notes?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string; // Not recipient_id
          subject: string; // Not title
          message: string;
          is_read: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string; // Not recipient_id
          subject: string; // Not title
          message: string;
          is_read?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          subject?: string;
          message?: string;
          is_read?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      coach_feedback: {
        Row: {
          id: string;
          player_id: string;
          coach_id: string | null;
          session_id: string | null;
          feedback_type: string;
          title: string;
          message: string;
          metrics: Json | null;
          action_items: Json | null;
          is_read: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          coach_id?: string | null;
          session_id?: string | null;
          feedback_type: string;
          title: string;
          message: string;
          metrics?: Json | null;
          action_items?: Json | null;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          coach_id?: string | null;
          session_id?: string | null;
          feedback_type?: string;
          title?: string;
          message?: string;
          metrics?: Json | null;
          action_items?: Json | null;
          is_read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

