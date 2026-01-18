import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://epkbrivypzikexahseyb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwa2JyaXZ5cHppa2V4YWhzZXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxOTEzNjMsImV4cCI6MjA4Mzc2NzM2M30.EUPULxrj0FgR84rG8ImZW5SXLU5P6xvCc94IRUncWPU'

console.log("Testing connection to:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
        console.error("Supabase Error:", error.message);
        console.error("Details:", error);
    } else {
        console.log("Connection Successful! Profiles table check executed.");
    }
  } catch (err) {
    console.error("Network/Client Error:", err);
  }
}

test();
