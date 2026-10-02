export const LOCAL_ADMIN_PIN_KEY = 'atits_admin_master_pin';
export const CF_WORKER_URL_KEY = 'atits_cf_worker_kv_url';
export const CF_WORKER_TOKEN_KEY = 'atits_cf_worker_kv_token';
export const CF_WORKER_KEY_NAME = 'ADMIN_MASTER_PIN';

export interface CloudflareWorkerConfig {
  workerUrl: string;
  authToken: string;
  kvKeyName: string;
}

export function getCloudflareWorkerConfig(): CloudflareWorkerConfig {
  try {
    const workerUrl = localStorage.getItem(CF_WORKER_URL_KEY) || 'https://license.yourdomain.com/admin/kv';
    const authToken = localStorage.getItem(CF_WORKER_TOKEN_KEY) || '';
    return {
      workerUrl: workerUrl.trim(),
      authToken: authToken.trim(),
      kvKeyName: CF_WORKER_KEY_NAME,
    };
  } catch {
    return {
      workerUrl: 'https://license.yourdomain.com/admin/kv',
      authToken: '',
      kvKeyName: CF_WORKER_KEY_NAME,
    };
  }
}

export function saveCloudflareWorkerConfig(workerUrl: string, authToken: string): void {
  try {
    localStorage.setItem(CF_WORKER_URL_KEY, workerUrl.trim());
    localStorage.setItem(CF_WORKER_TOKEN_KEY, authToken.trim());
  } catch {}
}

export function getLocalCachedPin(): string | null {
  try {
    const p = localStorage.getItem(LOCAL_ADMIN_PIN_KEY);
    return p && p.trim().length > 0 ? p.trim() : null;
  } catch {
    return null;
  }
}

export function setLocalCachedPin(pin: string): void {
  try {
    localStorage.setItem(LOCAL_ADMIN_PIN_KEY, pin.trim());
  } catch {}
}

/**
 * Checks if PIN is initialized either locally or configured with Cloudflare Worker.
 */
export function hasAdminPinConfigured(): boolean {
  return !!getLocalCachedPin() || !!localStorage.getItem(CF_WORKER_URL_KEY);
}

/**
 * Verifies Admin PIN against Cloudflare Workers KV endpoint, falling back to local cached KV.
 */
export async function verifyAdminPinWithCloudflareKV(
  enteredPin: string
): Promise<{ success: boolean; source: 'cloudflare-kv' | 'local-kv'; message?: string }> {
  const cleanPin = enteredPin.trim();
  if (!cleanPin) {
    return { success: false, source: 'local-kv', message: 'PIN cannot be empty' };
  }

  const { workerUrl, authToken, kvKeyName } = getCloudflareWorkerConfig();

  // If a Cloudflare Worker URL is configured, attempt remote Cloudflare Workers KV verification
  if (workerUrl && workerUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'VERIFY_PIN',
          key: kvKeyName,
          pin: cleanPin,
        }),
        signal: controller.signal,
      }).catch(async () => {
        // Fallback endpoint style (e.g. direct /get or /check)
        return await fetch(`${workerUrl.replace(/\/+$/, '')}?key=${encodeURIComponent(kvKeyName)}&pin=${encodeURIComponent(cleanPin)}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      });

      clearTimeout(timer);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.valid === true || data.success === true || data.verified === true)) {
          // Sync local cache
          setLocalCachedPin(cleanPin);
          return { success: true, source: 'cloudflare-kv', message: 'Verified securely via Cloudflare Workers KV' };
        } else if (data && data.valid === false) {
          return { success: false, source: 'cloudflare-kv', message: 'Incorrect PIN according to Cloudflare Workers KV' };
        }
      }
    } catch {
      // If network fails to reach Cloudflare worker, fall back to local cached KV
    }
  }

  // Local Key-Value verification fallback
  const localPin = getLocalCachedPin();
  if (localPin) {
    if (localPin === cleanPin) {
      return { success: true, source: 'local-kv', message: 'Verified via local key-value cache' };
    } else {
      return { success: false, source: 'local-kv', message: 'Incorrect Admin PIN' };
    }
  }

  // If no PIN stored yet
  return { success: false, source: 'local-kv', message: 'No Master PIN initialized in Cloudflare KV or local storage.' };
}

/**
 * Saves a new Admin PIN to Cloudflare Workers KV and syncs to local key-value cache.
 */
export async function saveAdminPinToCloudflareKV(
  newPin: string
): Promise<{ success: boolean; source: 'cloudflare-kv' | 'local-kv'; message: string }> {
  const cleanPin = newPin.trim();
  if (cleanPin.length < 4) {
    return { success: false, source: 'local-kv', message: 'PIN must be at least 4 digits' };
  }

  const { workerUrl, authToken, kvKeyName } = getCloudflareWorkerConfig();
  let workerSaved = false;

  if (workerUrl && workerUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2200);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/set`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'SET_PIN',
          key: kvKeyName,
          pin: cleanPin,
        }),
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(`${workerUrl.replace(/\/+$/, '')}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            key: kvKeyName,
            value: cleanPin,
          }),
          signal: controller.signal,
        });
      });

      clearTimeout(timer);
      if (res && res.ok) {
        workerSaved = true;
      }
    } catch {
      workerSaved = false;
    }
  }

  // Always sync to local key-value cache
  setLocalCachedPin(cleanPin);

  if (workerSaved) {
    return {
      success: true,
      source: 'cloudflare-kv',
      message: 'Admin PIN saved to Cloudflare Workers KV namespace successfully!',
    };
  } else {
    return {
      success: true,
      source: 'local-kv',
      message: 'Admin PIN saved locally (Cloudflare Worker endpoint unreachable or not yet configured).',
    };
  }
}

/**
 * Cloudflare Worker Sample Deployment Code snippet for quick setup
 */
export const SAMPLE_CF_WORKER_CODE = `/**
 * Cloudflare Worker with KV Binding: ATITS_AUTH_KV
 * Deploy in 1 click or via wrangler:
 * wrangler kv:namespace create "ATITS_AUTH_KV"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const KV_KEY = "ADMIN_MASTER_PIN";

    // 1. Verify PIN Endpoint
    if (url.pathname.endsWith("/verify") && request.method === "POST") {
      const { pin } = await request.json().catch(() => ({}));
      const storedPin = await env.ATITS_AUTH_KV.get(KV_KEY);
      
      if (!storedPin) {
        // If not set yet, automatically store this initial PIN
        if (pin) {
          await env.ATITS_AUTH_KV.put(KV_KEY, pin);
          return new Response(JSON.stringify({ valid: true, initialized: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ valid: false, message: "No PIN set" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const isValid = (storedPin.trim() === (pin || "").trim());
      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Set / Update PIN Endpoint
    if ((url.pathname.endsWith("/set") || request.method === "PUT") && request.method !== "GET") {
      const { pin, value } = await request.json().catch(() => ({}));
      const newPin = pin || value;
      if (!newPin || newPin.length < 4) {
        return new Response(JSON.stringify({ success: false, error: "Invalid PIN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await env.ATITS_AUTH_KV.put(KV_KEY, newPin);
      return new Response(JSON.stringify({ success: true, key: KV_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ status: "Cloudflare Workers KV Auth Service Active" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};`;
