// Run with: node scripts/verify-supabase.js
// Confirms the Supabase connection and that all table grants are working
// after unpausing the project or running the security migration.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env.local') })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const TABLES = ['profiles', 'recipes', 'made_it_log', 'grocery_items', 'pantry_items', 'meal_plans']

async function verify() {
  console.log('Supabase URL:', process.env.VITE_SUPABASE_URL)
  console.log('')

  // 1. Basic connectivity — anon can reach the API
  console.log('1. Checking connectivity...')
  const { error: pingError } = await supabase.from('recipes').select('id').limit(1)
  if (pingError && pingError.code !== 'PGRST116') {
    // PGRST116 = no rows, which is fine
    console.error('   FAIL:', pingError.message)
    if (pingError.message.includes('permission denied')) {
      console.error('   → Missing GRANT on recipes. Run supabase/migrations/20260519_security_grants.sql')
    }
  } else {
    console.log('   OK — API reachable')
  }

  // 2. Check each table is queryable (will fail if grants are missing)
  console.log('\n2. Checking table grants (SELECT)...')
  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error && !['PGRST116', '42501'].includes(error.code)) {
      // Real errors only; 42501 = permission denied means grants missing
      console.log(`   ${table}: FAIL — ${error.message}`)
    } else if (error?.code === '42501') {
      console.log(`   ${table}: FAIL — permission denied (grants missing)`)
    } else {
      console.log(`   ${table}: OK`)
    }
  }

  // 3. Check increment_made_count function is callable
  console.log('\n3. Checking RPC grant...')
  const { error: rpcError } = await supabase.rpc('increment_made_count', {
    recipe_id: '00000000-0000-0000-0000-000000000000'
  })
  if (rpcError && rpcError.code === '42501') {
    console.log('   increment_made_count: FAIL — permission denied (GRANT EXECUTE missing)')
  } else {
    // any other error (e.g. no matching row) is fine — we just care about permissions
    console.log('   increment_made_count: OK')
  }

  console.log('\nDone.')
}

verify()
