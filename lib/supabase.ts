import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate that URLs are properly formatted
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl))

if (!isSupabaseConfigured) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables are not set. Database features will not work.')
    console.warn('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
  } else if (!isValidUrl(supabaseUrl)) {
    console.warn('NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Please check your .env.local file')
  }
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null as any // Type assertion to allow usage, but will fail gracefully

/**
 * Test Supabase connection
 * Useful for debugging connection issues
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: 'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file'
    }
  }

  try {
    // Try a simple query to test the connection
    const { error } = await supabase.from('flows').select('id').limit(1)
    
    if (error) {
      if (error.code === 'PGRST205') {
        return {
          success: false,
          error: 'Database table "flows" does not exist. Please run the SQL schema from supabase/schema.sql in your Supabase SQL editor.'
        }
      }
      return {
        success: false,
        error: `Supabase connection error: ${error.message} (code: ${error.code || 'unknown'})`
      }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: 'Network error: Failed to connect to Supabase. Please check:\n1. Your NEXT_PUBLIC_SUPABASE_URL is correct\n2. Your Supabase project is active\n3. There are no network restrictions'
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

