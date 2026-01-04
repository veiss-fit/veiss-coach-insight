import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to subscribe to new messages for real-time updates
 */
export const useMessagesSubscription = (
  onNewMessage: (message: any) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('New message received:', payload.new);
          onNewMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewMessage, enabled]);
};

/**
 * Hook to subscribe to new workout sessions
 */
export const useSessionsSubscription = (
  onNewSession: (session: any) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel('sessions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
        },
        (payload) => {
          console.log('New session received:', payload.new);
          onNewSession(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewSession, enabled]);
};

/**
 * Hook to subscribe to workout plan changes (completions)
 */
export const useWorkoutPlansSubscription = (
  onPlanChange: (plan: any) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel('workout-plans-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workout_plans',
        },
        (payload) => {
          console.log('Workout plan updated:', payload.new);
          onPlanChange(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onPlanChange, enabled]);
};

/**
 * Hook to subscribe to new players being added
 */
export const usePlayersSubscription = (
  onNewPlayer: (player: any) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
        },
        (payload) => {
          console.log('New player added:', payload.new);
          onNewPlayer(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onNewPlayer, enabled]);
};

/**
 * Hook to subscribe to multiple table changes at once
 */
export const useDashboardSubscription = (
  callbacks: {
    onNewMessage?: (message: any) => void;
    onNewSession?: (session: any) => void;
    onNewPlayer?: (player: any) => void;
    onPlanUpdate?: (plan: any) => void;
  },
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const channels: RealtimeChannel[] = [];

    // Messages subscription
    if (callbacks.onNewMessage) {
      const messagesChannel = supabase
        .channel('dashboard-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            callbacks.onNewMessage!(payload.new);
          }
        )
        .subscribe();
      channels.push(messagesChannel);
    }

    // Sessions subscription
    if (callbacks.onNewSession) {
      const sessionsChannel = supabase
        .channel('dashboard-sessions')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sessions',
          },
          (payload) => {
            callbacks.onNewSession!(payload.new);
          }
        )
        .subscribe();
      channels.push(sessionsChannel);
    }

    // Players subscription
    if (callbacks.onNewPlayer) {
      const playersChannel = supabase
        .channel('dashboard-players')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'players',
          },
          (payload) => {
            callbacks.onNewPlayer!(payload.new);
          }
        )
        .subscribe();
      channels.push(playersChannel);
    }

    // Workout plans subscription
    if (callbacks.onPlanUpdate) {
      const plansChannel = supabase
        .channel('dashboard-plans')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'workout_plans',
          },
          (payload) => {
            callbacks.onPlanUpdate!(payload.new);
          }
        )
        .subscribe();
      channels.push(plansChannel);
    }

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [callbacks, enabled]);
};

