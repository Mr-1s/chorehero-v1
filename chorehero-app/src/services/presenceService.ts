import { supabase } from './supabase';

type PresenceRecord = {
  user_id: string;
  online: boolean;
  last_seen_at: string;
};

class PresenceService {
  private channel: any | null = null;
  private heartbeatId: any | null = null;
  private currentUserId: string | null = null;

  async initialize(userId: string) {
    this.currentUserId = userId;
    await this.setPresence(true);
    this.startHeartbeat();
    this.channel = supabase
      .channel('presence_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {})
      .subscribe();
  }

  async cleanup() {
    if (this.heartbeatId) clearInterval(this.heartbeatId);
    if (this.channel) supabase.removeChannel(this.channel);
    if (this.currentUserId) await this.setPresence(false);
    this.channel = null;
    this.currentUserId = null;
  }

  private startHeartbeat() {
    if (this.heartbeatId) clearInterval(this.heartbeatId);
    this.heartbeatId = setInterval(() => {
      if (this.currentUserId) this.setPresence(true);
    }, 30000);
  }

  private async setPresence(online: boolean) {
    if (!this.currentUserId) return;
    const now = new Date().toISOString();
    await supabase.from('user_presence').upsert({
      user_id: this.currentUserId,
      online,
      last_seen_at: now,
    } satisfies PresenceRecord, { onConflict: 'user_id' as any });
  }

  async getPresence(userId: string): Promise<PresenceRecord | null> {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, online, last_seen_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data as PresenceRecord | null;
  }

  subscribe(userId: string, cb: (presence: PresenceRecord | null) => void) {
    const channel = supabase
      .channel(`presence_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${userId}` }, async () => {
        const latest = await this.getPresence(userId);
        cb(latest);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
}

export const presenceService = new PresenceService();




