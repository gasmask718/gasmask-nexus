// Frontend entry point for the canonical SBO stat/prop-type normalization.
//
// RE-EXPORT, not a copy. The single implementation lives in
// supabase/functions/_shared/statNormalize.ts so edge functions and the client
// resolve to the SAME canonical vocabulary. Never inline the map here.
export * from '../../../supabase/functions/_shared/statNormalize';
