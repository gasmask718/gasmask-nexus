update public.communication_logs
   set summary = 'Inbound call from ' || coalesce(sender_phone, 'unknown number'),
       event_type = coalesce(event_type, 'inbound_call')
 where direction = 'inbound'
   and summary = 'Call placed from browser';