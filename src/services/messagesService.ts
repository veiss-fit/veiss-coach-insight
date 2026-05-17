import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { getCoachTeamIds } from '@/services/playersService';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

/**
 * Send a message/announcement to one or more players
 * @param senderId - Coach's user ID (from profiles table)
 * @param recipientIds - Array of player IDs (will be converted to user IDs)
 * @param title - Message subject
 * @param message - Message content
 * @param type - Message type (not stored in DB, for API compatibility)
 * @param priority - Priority level (not stored in DB, for API compatibility)
 */
export const sendMessage = async (
  senderId: string,
  recipientIds: string[],
  title: string,
  message: string,
  type: 'announcement' | 'feedback' | 'general' = 'announcement',
  priority: 'normal' | 'urgent' = 'normal'
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    // Convert player IDs to user IDs (profile IDs)
    // receiver_id should be the user's profile ID, not player_id
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .in('player_id', recipientIds)
      .eq('role', 'player');

    if (profilesError) {
      console.error('Error fetching player profiles:', profilesError);
      return { success: false, count: 0, error: 'Failed to find player user accounts' };
    }

    if (!profiles || profiles.length === 0) {
      return { success: false, count: 0, error: 'No valid player accounts found' };
    }

    const receiverUserIds = profiles.map(p => p.id);

    // Create message records for each recipient
    // Note: type and priority are not stored in DB, but kept for API compatibility
    // The mobile app determines type dynamically from subject/message content
    const messages: MessageInsert[] = receiverUserIds.map((receiverUserId) => ({
      sender_id: senderId,
      receiver_id: receiverUserId, // Use receiver_id (user's profile ID)
      subject: title, // Use subject (not title)
      message,
      is_read: false,
      is_archived: false,
    }));

    const { data, error } = await supabase
      .from('messages')
      .insert(messages)
      .select();

    if (error) {
      console.error('Error sending messages:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
  } catch (error: any) {
    console.error('Error in sendMessage:', error);
    return { success: false, count: 0, error: error.message || 'Unknown error' };
  }
};

/**
 * Get messages sent by a coach
 */
export const getCoachMessages = async (
  senderId: string,
  limit: number = 50
): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_receiver_id_fkey(full_name)')
      .eq('sender_id', senderId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching coach messages:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getCoachMessages:', error);
    throw error;
  }
};

/**
 * Get messages for a player (for mobile app)
 */
export const getPlayerMessages = async (
  recipientId: string,
  includeArchived: boolean = false
): Promise<Message[]> => {
  try {
    let query = supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(full_name)')
      .eq('receiver_id', recipientId) // Use receiver_id (not recipient_id)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching player messages:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPlayerMessages:', error);
    throw error;
  }
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) {
      console.error('Error marking message as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markMessageAsRead:', error);
    return false;
  }
};

/**
 * Archive a message
 */
export const archiveMessage = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_archived: true, is_read: true })
      .eq('id', messageId);

    if (error) {
      console.error('Error archiving message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in archiveMessage:', error);
    return false;
  }
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteMessage:', error);
    return false;
  }
};

/**
 * Get unread message count for a player
 */
export const getUnreadMessageCount = async (recipientId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', recipientId) // Use receiver_id (not recipient_id)
      .eq('is_read', false)
      .eq('is_archived', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadMessageCount:', error);
    return 0;
  }
};

/**
 * Get message by ID
 */
export const getMessageById = async (messageId: string): Promise<Message | null> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(full_name), profiles!messages_receiver_id_fkey(full_name)')
      .eq('id', messageId)
      .single();

    if (error) {
      console.error('Error fetching message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getMessageById:', error);
    return null;
  }
};

/**
 * Get message statistics for a coach
 */
export const getCoachMessageStats = async (
  senderId: string
): Promise<{ total: number; unread: number; urgent: number }> => {
  try {
    // Total messages sent
    const { count: total } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId);

    // Unread messages (from recipients' perspective)
    const { count: unread } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .eq('is_read', false);

    // Note: priority column doesn't exist, so we can't filter by urgent
    // Return 0 for urgent count since priority is not stored
    return {
      total: total || 0,
      unread: unread || 0,
      urgent: 0, // Priority not stored in database
    };
  } catch (error) {
    console.error('Error in getCoachMessageStats:', error);
    return { total: 0, unread: 0, urgent: 0 };
  }
};

/**
 * Get aggregated message history for the History page, strictly scoped to the coach's own groups.
 * Only returns messages where:
 *  - sender_id = this coach's user ID
 *  - receiver_id = one of this coach's athletes' user IDs
 */
export const getCoachMessageHistory = async (coachUserId: string) => {
  try {
    const teamIds = await getCoachTeamIds(coachUserId);
    if (teamIds.length === 0) return [];

    const { data: scopedPlayers } = await (supabase as any)
      .from('players')
      .select('user_id')
      .in('team_id', teamIds) as { data: Array<{ user_id: string | null }> | null };

    const playerUserIds = (scopedPlayers?.map(p => p.user_id).filter(Boolean) ?? []) as string[];
    if (playerUserIds.length === 0) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', coachUserId)
      .in('receiver_id', playerUserIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const groupedMessages: any[] = [];

    data?.forEach((msg) => {
      const msgTime = new Date(msg.created_at).getTime();
      
      // Try to find a batch with same Title (subject) sent within 60 seconds
      const existingBatch = groupedMessages.find(b => 
        b.title === msg.subject &&
        Math.abs(new Date(b.sentAt).getTime() - msgTime) < 60000
      );

      if (existingBatch) {
        existingBatch.recipientCount++;
      } else {
        groupedMessages.push({
          id: msg.id,
          title: msg.subject, // Map subject -> title
          content: msg.message, // Map message -> content
          // Since priority isn't in DB, assume normal or derive from content if you added a tag
          priority: 'normal', 
          sentAt: msg.created_at,
          recipientCount: 1
        });
      }
    });

    return groupedMessages;
  } catch (error) {
    console.error('Error fetching message history:', error);
    return [];
  }
};