import { createClient } from '@supabase/supabase-js';

// Use direct values since they are public keys
const supabaseUrl = 'https://bbmaomwpmpfultoiysff.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJibWFvbXdwbXBmdWx0b2l5c2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyMzMxNjMsImV4cCI6MjA1MjgwOTE2M30.GrA8bMvjiFCIdTuGRO_T_6uN7YP6qKUD2R2TkHRNhUw';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});