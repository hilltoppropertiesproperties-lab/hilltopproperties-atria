let clientPromise;
let resolvedConfig;

async function loadConfig() {
  if (resolvedConfig) return resolvedConfig;

  const injected = window.__HILLTOP_ENV__ || {};
  let fileConfig = {};

  try {
    fileConfig = await import('../supabase-env.js');
  } catch (error) {
    // A missing local config is an expected setup state. The admin UI explains it.
  }

  const url = injected.SUPABASE_URL || fileConfig.SUPABASE_URL || '';
  const anonKey = injected.SUPABASE_ANON_KEY || fileConfig.SUPABASE_ANON_KEY || '';
  resolvedConfig = { url, anonKey, configured: Boolean(url && anonKey) };
  return resolvedConfig;
}

export async function getSupabaseConfiguration() {
  return loadConfig();
}

export async function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const config = await loadConfig();
      if (!config.configured) {
        throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to supabase-env.js.');
      }

      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      return createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    })();
  }

  return clientPromise;
}

