import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Bus, MapPin, Clock, Users, Calendar, CheckCircle2, XCircle,
  ArrowRight, Send, Shield, Loader2, AlertTriangle, RefreshCw,
  DollarSign, ArrowUpDown, Star
} from 'lucide-react';

const GOLD = '#C9A84C';

type ResponseMode = null | 'quote' | 'unavailable' | 'alternate';

interface TokenData {
  id: string;
  booking_request_id: string;
  partner_id: string;
  secure_token: string;
  expires_at: string;
  used: boolean;
}

interface RequestData {
  id: string;
  pickup_city: string;
  pickup_state: string;
  dropoff_city: string;
  dropoff_state: string;
  trip_date: string;
  trip_time: string;
  passenger_count: number;
  trip_type: string;
  bus_type_preference: string;
  special_requests: string;
  requested_amenities: string[];
  notes: string;
}

export default function PartnerRespond() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [request, setRequest] = useState<RequestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ResponseMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Quote form
  const [quoteForm, setQuoteForm] = useState({
    quoted_price: '',
    vehicle_type: '',
    capacity: '',
    amenities: '',
    quote_notes: '',
    deposit_required: '',
  });

  // Decline form
  const [declineReason, setDeclineReason] = useState('');

  // Alternate form
  const [alternateForm, setAlternateForm] = useState({
    notes: '',
    vehicle_type: '',
    quoted_price: '',
  });

  useEffect(() => {
    if (!token) { setError('No token provided'); setLoading(false); return; }
    validateToken();
  }, [token]);

  async function validateToken() {
    setLoading(true);
    try {
      const { data: tokenRow, error: tErr } = await supabase
        .from('cb_partner_response_tokens')
        .select('*')
        .eq('secure_token', token)
        .single();

      if (tErr || !tokenRow) { setError('Invalid or expired link. Please contact TopTier for a new link.'); return; }
      if (tokenRow.used) { setError('This link has already been used. If you need to update your response, please contact TopTier.'); return; }
      if (new Date(tokenRow.expires_at) < new Date()) { setError('This link has expired. Please contact TopTier for a new link.'); return; }

      setTokenData(tokenRow);

      const { data: reqData, error: rErr } = await supabase
        .from('cb_booking_requests')
        .select('*')
        .eq('id', tokenRow.booking_request_id)
        .single();

      if (rErr || !reqData) { setError('Request not found.'); return; }
      setRequest(reqData as any);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitQuote() {
    if (!quoteForm.quoted_price || Number(quoteForm.quoted_price) <= 0) {
      toast.error('Please enter a valid price'); return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: {
          action: 'submit_quote',
          request_id: tokenData!.booking_request_id,
          partner_id: tokenData!.partner_id,
          quoted_price: Number(quoteForm.quoted_price),
          vehicle_type: quoteForm.vehicle_type || null,
          capacity: quoteForm.capacity ? Number(quoteForm.capacity) : null,
          amenities: quoteForm.amenities ? quoteForm.amenities.split(',').map(a => a.trim()).filter(Boolean) : null,
          quote_notes: quoteForm.quote_notes || null,
          deposit_required: quoteForm.deposit_required ? Number(quoteForm.deposit_required) : 0,
          availability_status: 'quoted',
          response_method: 'partner_link',
        },
      });
      if (error) throw error;

      // Mark token as used
      await supabase.from('cb_partner_response_tokens')
        .update({ used: true, used_at: new Date().toISOString(), response_type: 'quoted' })
        .eq('id', tokenData!.id);

      setSubmitted(true);
      toast.success('Quote submitted successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: {
          action: 'submit_quote',
          request_id: tokenData!.booking_request_id,
          partner_id: tokenData!.partner_id,
          quoted_price: 0,
          availability_status: 'unavailable',
          quote_notes: declineReason || 'Not available',
          response_method: 'partner_link',
        },
      });
      if (error) throw error;

      await supabase.from('cb_partner_response_tokens')
        .update({ used: true, used_at: new Date().toISOString(), response_type: 'unavailable' })
        .eq('id', tokenData!.id);

      setSubmitted(true);
      toast.success('Response recorded');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAlternate() {
    if (!alternateForm.notes) { toast.error('Please add details about your alternative offer'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('cb-dispatch-engine', {
        body: {
          action: 'submit_quote',
          request_id: tokenData!.booking_request_id,
          partner_id: tokenData!.partner_id,
          quoted_price: alternateForm.quoted_price ? Number(alternateForm.quoted_price) : 0,
          vehicle_type: alternateForm.vehicle_type || null,
          availability_status: 'alternate_offer',
          alternate_offer_notes: alternateForm.notes,
          response_method: 'partner_link',
        },
      });
      if (error) throw error;

      await supabase.from('cb_partner_response_tokens')
        .update({ used: true, used_at: new Date().toISOString(), response_type: 'alternate' })
        .eq('id', tokenData!.id);

      setSubmitted(true);
      toast.success('Alternative offer submitted!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: GOLD }} />
          <p className="text-sm text-zinc-400">Validating your link...</p>
        </motion.div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Link Issue</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">{error}</p>
        </motion.div>
      </div>
    );
  }

  // ── Submitted ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Response Received!</h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            Thank you for your response. Our team will review and follow up shortly.
          </p>
          <p className="text-[11px] text-zinc-600">You can close this page.</p>
        </motion.div>
      </div>
    );
  }

  if (!request || !tokenData) return null;

  const tripTypeLabels: Record<string, string> = {
    one_way: 'One Way',
    round_trip: 'Round Trip',
    multi_stop: 'Multi Stop',
    hourly: 'Hourly Charter',
  };

  // ── Main Response UI ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] rounded-full blur-[120px] opacity-[0.04]" style={{ backgroundColor: GOLD }} />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
            <Bus className="w-4 h-4" style={{ color: GOLD }} />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">TopTier Transportation</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">New Transportation Request</h1>
          <p className="text-sm text-zinc-500">Please review the details and submit your response</p>
        </motion.div>

        {/* Route Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/[0.05] border border-white/[0.08] rounded-2xl p-6 mb-4 text-center"
        >
          <div className="flex items-center justify-center gap-4">
            <div>
              <p className="text-xl font-bold text-white">{request.pickup_city || 'TBD'}</p>
              <p className="text-xs text-zinc-500">{request.pickup_state || ''}</p>
            </div>
            <ArrowRight className="w-6 h-6 text-zinc-600" />
            <div>
              <p className="text-xl font-bold text-white">{request.dropoff_city || 'TBD'}</p>
              <p className="text-xs text-zinc-500">{request.dropoff_state || ''}</p>
            </div>
          </div>
        </motion.div>

        {/* Trip Details Grid */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4"
        >
          {[
            { icon: Calendar, label: 'Date', value: request.trip_date || 'TBD' },
            { icon: Clock, label: 'Time', value: request.trip_time || 'TBD' },
            { icon: Users, label: 'Passengers', value: request.passenger_count || 'TBD' },
            { icon: ArrowUpDown, label: 'Trip Type', value: tripTypeLabels[request.trip_type] || request.trip_type || 'One Way' },
          ].map((item, i) => (
            <div key={i} className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <item.icon className="w-3 h-3 text-zinc-600" />
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">{item.label}</span>
              </div>
              <p className="text-sm font-bold text-white">{item.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Bus Preference & Special Requests */}
        {(request.bus_type_preference || request.special_requests) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4 space-y-3"
          >
            {request.bus_type_preference && (
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Vehicle Preference</p>
                <p className="text-sm text-zinc-300">{request.bus_type_preference}</p>
              </div>
            )}
            {request.special_requests && (
              <div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Special Requests</p>
                <p className="text-sm text-zinc-300">{request.special_requests}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        {!mode && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="space-y-2.5 mt-6"
          >
            <button
              onClick={() => setMode('quote')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl backdrop-blur-xl bg-emerald-500/[0.08] border border-emerald-500/20 hover:bg-emerald-500/[0.12] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-emerald-400">Available — Submit Quote</p>
                <p className="text-[11px] text-zinc-500">I can fulfill this request and want to submit my pricing</p>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-500/40 group-hover:text-emerald-400 transition-colors" />
            </button>

            <button
              onClick={() => setMode('unavailable')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl backdrop-blur-xl bg-red-500/[0.06] border border-red-500/15 hover:bg-red-500/[0.1] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-red-400">Not Available</p>
                <p className="text-[11px] text-zinc-500">I cannot fulfill this request at this time</p>
              </div>
              <ArrowRight className="w-4 h-4 text-red-500/40 group-hover:text-red-400 transition-colors" />
            </button>

            <button
              onClick={() => setMode('alternate')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl backdrop-blur-xl bg-amber-500/[0.06] border border-amber-500/15 hover:bg-amber-500/[0.1] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-amber-400">Offer Alternative</p>
                <p className="text-[11px] text-zinc-500">I have a different vehicle or option to propose</p>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-500/40 group-hover:text-amber-400 transition-colors" />
            </button>
          </motion.div>
        )}

        {/* ── QUOTE FORM ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {mode === 'quote' && (
            <motion.div
              key="quote"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: GOLD }} />
                  Submit Your Quote
                </h2>
                <button onClick={() => setMode(null)} className="text-xs text-zinc-500 hover:text-zinc-300">← Back</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Price ($) *</label>
                  <Input
                    type="number"
                    value={quoteForm.quoted_price}
                    onChange={e => setQuoteForm(p => ({ ...p, quoted_price: e.target.value }))}
                    placeholder="2500"
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Vehicle Type</label>
                  <Input
                    value={quoteForm.vehicle_type}
                    onChange={e => setQuoteForm(p => ({ ...p, vehicle_type: e.target.value }))}
                    placeholder="56-Passenger Coach"
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Capacity (seats)</label>
                  <Input
                    type="number"
                    value={quoteForm.capacity}
                    onChange={e => setQuoteForm(p => ({ ...p, capacity: e.target.value }))}
                    placeholder="56"
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Deposit Required ($)</label>
                  <Input
                    type="number"
                    value={quoteForm.deposit_required}
                    onChange={e => setQuoteForm(p => ({ ...p, deposit_required: e.target.value }))}
                    placeholder="500"
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Amenities (comma separated)</label>
                <Input
                  value={quoteForm.amenities}
                  onChange={e => setQuoteForm(p => ({ ...p, amenities: e.target.value }))}
                  placeholder="WiFi, Restroom, Power Outlets, Reclining Seats"
                  className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Additional Notes</label>
                <Textarea
                  value={quoteForm.quote_notes}
                  onChange={e => setQuoteForm(p => ({ ...p, quote_notes: e.target.value }))}
                  placeholder="Any details about your vehicle, availability, or service..."
                  className="mt-1 text-sm bg-white/[0.03] border-white/[0.08] text-white min-h-[80px] rounded-xl"
                />
              </div>

              <Button
                className="w-full h-11 text-sm font-bold rounded-xl shadow-lg"
                style={{ backgroundColor: GOLD, color: '#000' }}
                disabled={submitting}
                onClick={handleSubmitQuote}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Submit Quote</>}
              </Button>
            </motion.div>
          )}

          {/* ── DECLINE FORM ───────────────────────────────────────── */}
          {mode === 'unavailable' && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  Not Available
                </h2>
                <button onClick={() => setMode(null)} className="text-xs text-zinc-500 hover:text-zinc-300">← Back</button>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Reason (optional)</label>
                <Textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="Fleet booked, maintenance, too far, etc."
                  className="mt-1 text-sm bg-white/[0.03] border-white/[0.08] text-white min-h-[80px] rounded-xl"
                />
              </div>

              <Button
                className="w-full h-11 text-sm font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white"
                disabled={submitting}
                onClick={handleDecline}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Confirm Not Available'}
              </Button>
            </motion.div>
          )}

          {/* ── ALTERNATE FORM ─────────────────────────────────────── */}
          {mode === 'alternate' && (
            <motion.div
              key="alternate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-6 backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  Offer Alternative
                </h2>
                <button onClick={() => setMode(null)} className="text-xs text-zinc-500 hover:text-zinc-300">← Back</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Alternative Vehicle</label>
                  <Input
                    value={alternateForm.vehicle_type}
                    onChange={e => setAlternateForm(p => ({ ...p, vehicle_type: e.target.value }))}
                    placeholder="Mini Coach, Shuttle, etc."
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Price ($)</label>
                  <Input
                    type="number"
                    value={alternateForm.quoted_price}
                    onChange={e => setAlternateForm(p => ({ ...p, quoted_price: e.target.value }))}
                    placeholder="1800"
                    className="mt-1 h-10 text-sm bg-white/[0.03] border-white/[0.08] text-white rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Details *</label>
                <Textarea
                  value={alternateForm.notes}
                  onChange={e => setAlternateForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Describe what you can offer instead..."
                  className="mt-1 text-sm bg-white/[0.03] border-white/[0.08] text-white min-h-[100px] rounded-xl"
                />
              </div>

              <Button
                className="w-full h-11 text-sm font-bold rounded-xl shadow-lg"
                style={{ backgroundColor: GOLD, color: '#000' }}
                disabled={submitting}
                onClick={handleAlternate}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Submit Alternative</>}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] text-zinc-600">
            <Shield className="w-3 h-3" />
            <span>Secure link · Expires {new Date(tokenData.expires_at).toLocaleDateString()}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
