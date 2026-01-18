import { createClient } from '@supabase/supabase-js'

// User provided: https://brxbbxymvvlqpiiukauv.supabase.co
// Ref in Key:    brxbbyxymvvlqpiukauv

const url1 = 'https://brxbbxymvvlqpiiukauv.supabase.co'; // Typed by user
const url2 = 'https://brxbbyxymvvlqpiukauv.supabase.co'; // From Key

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyeGJieHltdnZscXBpaXVrYXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MzU3MzcsImV4cCI6MjA4NDMxMTczN30.f2q8JchMUZOEMoCMoKUpkC8nxT1wr4scNC8F1akDCn4';

console.log("Testing Typed URL:", url1);
const client1 = createClient(url1, key);

async function test(client, name) {
  try {
    const { data, error } = await client.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
        console.log(`[${name}] Supabase Error:`, error.message);
    } else {
        console.log(`[${name}] Connection Successful!`);
    }
  } catch (err) {
    console.log(`[${name}] Network Error:`, err.message);
  }
}

async function run() {
    await test(client1, "Typed_URL");
    
    console.log("Testing Key-Derived URL:", url2);
    const client2 = createClient(url2, key);
    await test(client2, "Key_URL");
}

run();
