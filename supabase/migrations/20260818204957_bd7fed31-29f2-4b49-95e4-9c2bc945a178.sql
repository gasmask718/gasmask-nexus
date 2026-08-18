INSERT INTO public.us_state_names (name, state) VALUES
  ('AASCO','PR'),('ADJUNTAS','PR'),('AGUADA','PR'),('AGUADILLA','PR'),('AGUAS BUENAS','PR'),('AIBONITO','PR'),('ANASCO','PR'),('ARECIBO','PR'),('ARROYO','PR'),('BARCELONETA','PR'),('BARRANQUITAS','PR'),('BAYAMN','PR'),('BAYAMON','PR'),('CABO ROJO','PR'),('CAGUAS','PR'),('CAMUY','PR'),('CANOVANAS','PR'),('CANVANAS','PR'),('CAROLINA','PR'),('CATANO','PR'),('CATAO','PR'),('CAYEY','PR'),('CEIBA','PR'),('CIALES','PR'),('CIDRA','PR'),('COAMO','PR'),('COMERIO','PR'),('COMERO','PR'),('COROZAL','PR'),('CULEBRA','PR'),('DORADO','PR'),('FAJARDO','PR'),('FLORIDA','PR'),('GUANICA','PR'),('GUAYAMA','PR'),('GUAYANILLA','PR'),('GUAYNABO','PR'),('GUNICA','PR'),('GURABO','PR'),('HATILLO','PR'),('HORMIGUEROS','PR'),('HUMACAO','PR'),('ISABELA','PR'),('JAYUYA','PR'),('JUANA DAZ','PR'),('JUANA DIAZ','PR'),('JUNCOS','PR'),('LAJAS','PR'),('LARES','PR'),('LAS MARAS','PR'),('LAS MARIAS','PR'),('LAS PIEDRAS','PR'),('LOIZA','PR'),('LOZA','PR'),('LUQUILLO','PR'),('MANAT','PR'),('MANATI','PR'),('MARICAO','PR'),('MAUNABO','PR'),('MAYAGEZ','PR'),('MAYAGUEZ','PR'),('MOCA','PR'),('MOROVIS','PR'),('NAGUABO','PR'),('NARANJITO','PR'),('OROCOVIS','PR'),('PATILLAS','PR'),('PENUELAS','PR'),('PEUELAS','PR'),('PONCE','PR'),('QUEBRADILLAS','PR'),('RINCN','PR'),('RINCON','PR'),('RIO GRANDE','PR'),('RO GRANDE','PR'),('SABANA GRANDE','PR'),('SALINAS','PR'),('SAN GERMAN','PR'),('SAN GERMN','PR'),('SAN JUAN','PR'),('SAN LORENZO','PR'),('SAN SEBASTIAN','PR'),('SAN SEBASTIN','PR'),('SANTA ISABEL','PR'),('TOA ALTA','PR'),('TOA BAJA','PR'),('TRUJILLO ALTO','PR'),('UTUADO','PR'),('VEGA ALTA','PR'),('VEGA BAJA','PR'),('VIEQUES','PR'),('VILLALBA','PR'),('YABUCOA','PR'),('YAUCO','PR')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.va_call_logs
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS to_number_source text,
  ADD COLUMN IF NOT EXISTS derived_state text,
  ADD COLUMN IF NOT EXISTS jurisdiction_recovery_status text,
  ADD COLUMN IF NOT EXISTS jurisdiction_recovered_at timestamptz;

ALTER TABLE public.va_call_logs
  ADD COLUMN IF NOT EXISTS to_number_last10 text
  GENERATED ALWAYS AS (right(regexp_replace(coalesce(to_number,''), '[^0-9]', '', 'g'), 10)) STORED;

CREATE INDEX IF NOT EXISTS idx_va_call_logs_to_last10 ON public.va_call_logs (to_number_last10);