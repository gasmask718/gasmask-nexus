import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed';
export type CallItemStatus = 'queued' | 'dialing' | 'answered' | 'transferred' | 'no_answer' | 'failed' | 'completed' | 'opted_out';

export interface ColdCallCampaign {
  id: string;
  created_by: string;
  campaign_type: 'tts_blast' | 'normal_blast';
  tts_script: string | null;
  voice_id: string | null;
  handoff_number: string;
  status: CampaignStatus;
  total_numbers: number;
  completed_count: number;
  transferred_count: number;
  created_at: string;
}

export interface ColdCallItem {
  id: string;
  campaign_id: string;
  phone_number: string;
  status: CallItemStatus;
  call_sid: string | null;
  duration: number | null;
  disposition: string | null;
  created_at: string;
  updated_at: string;
}

export function useColdCallBlast() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<ColdCallCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<ColdCallCampaign | null>(null);
  const [callItems, setCallItems] = useState<ColdCallItem[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPreviewingTTS, setIsPreviewingTTS] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('cold_call_campaigns')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Failed to fetch campaigns:', error);
      return;
    }
    setCampaigns((data || []) as unknown as ColdCallCampaign[]);
  }, [user]);

  // Fetch items for active campaign
  const fetchCallItems = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase
      .from('cold_call_items')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to fetch call items:', error);
      return;
    }
    setCallItems((data || []) as unknown as ColdCallItem[]);
  }, []);

  // Realtime subscription for call items
  useEffect(() => {
    if (!activeCampaign) return;
    const channel = supabase
      .channel(`cold-call-items-${activeCampaign.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cold_call_items',
          filter: `campaign_id=eq.${activeCampaign.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setCallItems(prev => {
              const updated = payload.new as unknown as ColdCallItem;
              const idx = prev.findIndex(i => i.id === updated.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = updated;
                return copy;
              }
              return [...prev, updated];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCampaign]);

  // Also subscribe to campaign updates
  useEffect(() => {
    if (!activeCampaign) return;
    const channel = supabase
      .channel(`cold-call-campaign-${activeCampaign.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cold_call_campaigns',
          filter: `id=eq.${activeCampaign.id}`,
        },
        (payload) => {
          setActiveCampaign(payload.new as unknown as ColdCallCampaign);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCampaign?.id]);

  // Preview TTS audio
  const previewTTS = async (script: string, voiceId?: string) => {
    setIsPreviewingTTS(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text: script, voice_id: voiceId || 'JBFqnCBsd6RMkjVDRZzb' },
      });
      if (res.error) throw res.error;
      // The function returns audio data - create blob URL
      if (res.data?.audio_url) {
        setPreviewAudioUrl(res.data.audio_url);
      } else if (res.data) {
        // If it returns base64 or direct data
        const blob = new Blob([res.data], { type: 'audio/mpeg' });
        setPreviewAudioUrl(URL.createObjectURL(blob));
      }
      toast.success('TTS preview generated');
    } catch (err: any) {
      console.error('TTS preview error:', err);
      toast.error('Failed to generate TTS preview');
    } finally {
      setIsPreviewingTTS(false);
    }
  };

  // Launch TTS Blast
  const launchTTSBlast = async (params: {
    phoneNumbers: string[];
    ttsScript: string;
    handoffNumber: string;
    voiceId?: string;
  }) => {
    if (!user) return;
    setIsLaunching(true);
    try {
      const res = await supabase.functions.invoke('cold-call-tts-blast', {
        body: {
          phone_numbers: params.phoneNumbers,
          tts_script: params.ttsScript,
          handoff_number: params.handoffNumber,
          voice_id: params.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
          campaign_type: 'tts_blast',
        },
      });

      if (res.error) throw res.error;

      const campaign = res.data?.campaign;
      if (campaign) {
        setActiveCampaign(campaign as ColdCallCampaign);
        await fetchCallItems(campaign.id);
        toast.success(`TTS Blast launched! Dialing ${params.phoneNumbers.length} numbers`);
      }
      await fetchCampaigns();
    } catch (err: any) {
      console.error('TTS blast error:', err);
      toast.error(err.message || 'Failed to launch TTS blast');
    } finally {
      setIsLaunching(false);
    }
  };

  // Launch Normal Call Blast
  const launchNormalBlast = async (params: {
    phoneNumbers: string[];
    handoffNumber: string;
  }) => {
    if (!user) return;
    setIsLaunching(true);
    try {
      const res = await supabase.functions.invoke('cold-call-tts-blast', {
        body: {
          phone_numbers: params.phoneNumbers,
          handoff_number: params.handoffNumber,
          campaign_type: 'normal_blast',
        },
      });

      if (res.error) throw res.error;

      const campaign = res.data?.campaign;
      if (campaign) {
        setActiveCampaign(campaign as ColdCallCampaign);
        await fetchCallItems(campaign.id);
        toast.success(`Normal Blast launched! Dialing ${params.phoneNumbers.length} numbers`);
      }
      await fetchCampaigns();
    } catch (err: any) {
      console.error('Normal blast error:', err);
      toast.error(err.message || 'Failed to launch normal blast');
    } finally {
      setIsLaunching(false);
    }
  };

  // Load a campaign
  const selectCampaign = async (campaign: ColdCallCampaign) => {
    setActiveCampaign(campaign);
    await fetchCallItems(campaign.id);
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return {
    campaigns,
    activeCampaign,
    callItems,
    isLaunching,
    isPreviewingTTS,
    previewAudioUrl,
    previewTTS,
    launchTTSBlast,
    launchNormalBlast,
    selectCampaign,
    fetchCampaigns,
  };
}
