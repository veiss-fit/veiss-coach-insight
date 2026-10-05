import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

/**
 * Push a title/body to a set of user IDs, tolerating individual failures.
 * Returns how many actually went out vs. were attempted.
 */
const sendPushes = async (
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<{ sent: number; attempted: number }> => {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      supabase.functions.invoke('send-push-notification', {
        body: { userId, title, body, data },
      })
    )
  );

  let failures = 0;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failures++;
      console.error(`Push network error for userId ${userIds[i]}:`, r.reason);
    } else if (r.value?.error) {
      failures++;
      console.error(`Push function error for userId ${userIds[i]}:`, r.value.error);
    }
  });

  return { sent: userIds.length - failures, attempted: userIds.length };
};

/**
 * Send a message/announcement to one or more players
 * @param senderId - Coach's user ID (from profiles table)
 * @param recipientIds - Array of player IDs (will be converted to user IDs)
 * @param title - Message subject
 * @param message - Message content
 * @param type - Message type (not stored in DB, for API compatibility)
 * @param priority - Priority level, persisted on each message row
 */
export const sendMessage = async (
  senderId: string,
  recipientIds: string[],
  title: string,
  message: string,
  type: 'announcement' | 'feedback' | 'general' = 'announcement',
  priority: 'normal' | 'urgent' = 'normal',
  scheduledAt?: Date
): Promise<{
  success: boolean;
  count: number;
  error?: string;
  /** Push notifications actually delivered; messages are stored regardless. */
  notificationsSent?: number;
  notificationsAttempted?: number;
}> => {
  try {
    const isScheduled = !!scheduledAt;

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

    // Cast before narrowing: TS's postgrest-js query-builder generics collapse
    // `profiles` to `never` here once combined with the `.length === 0` check
    // (pre-existing quirk from `Database` missing Views/Functions — see B3 notes),
    // even though the runtime value is a plain `{id: string}[] | null`.
    const profileRows = (profiles ?? []) as { id: string }[];
    if (profileRows.length === 0) {
      return { success: false, count: 0, error: 'No valid player accounts found' };
    }

    const receiverUserIds = profileRows.map(p => p.id);

    // Create message records for each recipient
    // Note: type is not stored in DB (the mobile app derives it from content)
    const messages: MessageInsert[] = receiverUserIds.map((receiverUserId) => ({
      sender_id: senderId,
      receiver_id: receiverUserId,
      subject: title,
      message,
      is_read: false,
      is_archived: false,
      scheduled_at: isScheduled ? scheduledAt!.toISOString() : null,
      is_delivered: !isScheduled,
      priority,
    }));

    const { data, error } = await supabase
      .from('messages')
      // @ts-expect-error pre-existing query-builder typing quirk (see profileRows
      // above) — insert() resolves to `never` for this table regardless of payload shape.
      .insert(messages)
      .select();

    if (error) {
      console.error('Error sending messages:', error);
      return { success: false, count: 0, error: error.message };
    }

    // Scheduled messages get pushed by deliverScheduledMessages once they're actually due.
    if (isScheduled) {
      return { success: true, count: data?.length || 0 };
    }

    const { sent, attempted } = await sendPushes(
      receiverUserIds,
      title ?? 'New Announcement',
      message,
      { type: 'announcement', screen: 'Announcements' }
    );

    // The messages are stored either way, so this is not a send failure — but the
    // coach should know whether anyone was actually pinged.
    return {
      success: true,
      count: data?.length || 0,
      notificationsSent: sent,
      notificationsAttempted: attempted,
    };
  } catch (error: any) {
    console.error('Error in sendMessage:', error);
    return { success: false, count: 0, error: error.message || 'Unknown error' };
  }
};

/**
 * Deliver scheduled messages whose scheduled_at has passed.
 * Call on dashboard load and on a polling interval.
 */
export const deliverScheduledMessages = async (senderId: string): Promise<number> => {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('messages')
      .select('id, receiver_id, subject, message')
      .eq('sender_id', senderId)
      .eq('is_delivered', false)
      .lte('scheduled_at', now);

    const pending = data as { id: string; receiver_id: string; subject: string; message: string }[] | null;

    if (!pending?.length) return 0;

    const ids = pending.map(m => m.id);
    await supabase
      .from('messages')
      // @ts-expect-error pre-existing query-builder typing quirk (see profileRows above)
      .update({ is_delivered: true })
      .in('id', ids);

    await Promise.allSettled(
      pending.map((m) =>
        sendPushes(
          [m.receiver_id],
          m.subject ?? 'New Announcement',
          m.message,
          { type: 'announcement', screen: 'Announcements' }
        )
      )
    );

    return ids.length;
  } catch (error) {
    console.error('Error in deliverScheduledMessages:', error);
    return 0;
  }
};

/**
 * Get aggregated message history for the History page, scoped to messages sent by this coach.
 * Filters by sender_id = coach's auth user ID — messages are always sent as the coach's user.
 */
export const getCoachMessageHistory = async (userId: string) => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!messages) return [];

    // Same pre-existing query-builder typing quirk (see sendMessage above) —
    // select('*') resolves rows to `never` for this table.
    const rows = messages as Message[];

    // Group by subject + calendar date so bulk announcements appear as one row
    const batchMap = new Map<string, any>();
    rows.forEach((msg) => {
      const key = `${msg.subject}-${msg.created_at?.slice(0, 10)}`;
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          id: msg.id,
          title: msg.subject,
          content: msg.message,
          sentAt: msg.created_at,
          scheduledAt: msg.scheduled_at ?? null,
          isDelivered: msg.is_delivered,
          priority: msg.priority ?? 'normal',
          recipientCount: 0,
        });
      }
      batchMap.get(key).recipientCount++;
    });

    return Array.from(batchMap.values());
  } catch (error) {
    console.error('Error fetching message history:', error);
    throw error;
  }
};