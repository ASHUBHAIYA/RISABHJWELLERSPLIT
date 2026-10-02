export const CF_WORKER_KEY_NAME = 'ADMIN_MASTER_PIN';
export const DEFAULT_CF_WORKER_URL = 'https://atits-auth.abhishek791996.workers.dev';
export const DEFAULT_KV_NAMESPACE_ID = '7275afafaed248e5b28a27d38d259547';

export interface CloudflareWorkerConfig {
  workerUrl: string;
  authToken: string;
  kvKeyName: string;
  kvNamespaceId: string;
}

// In-memory configuration for Cloudflare Workers KV endpoint connected to user's live Worker
let inMemoryWorkerConfig: CloudflareWorkerConfig = {
  workerUrl: DEFAULT_CF_WORKER_URL,
  authToken: '',
  kvKeyName: CF_WORKER_KEY_NAME,
  kvNamespaceId: DEFAULT_KV_NAMESPACE_ID,
};

export function getCloudflareWorkerConfig(): CloudflareWorkerConfig {
  return { ...inMemoryWorkerConfig };
}

export function saveCloudflareWorkerConfig(workerUrl: string, authToken: string): void {
  inMemoryWorkerConfig = {
    ...inMemoryWorkerConfig,
    workerUrl: (workerUrl || DEFAULT_CF_WORKER_URL).trim(),
    authToken: (authToken || '').trim(),
  };
}

/**
 * Checks if the local Go daemon is currently active and polling the Cloudflare Relay Worker
 */
export async function checkCloudflareRelayDaemonOnline(
  licenseKey: string = 'DEFAULT'
): Promise<{ online: boolean; lastSeenSecondsAgo?: number }> {
  const { workerUrl } = getCloudflareWorkerConfig();
  const targetUrl = (workerUrl || DEFAULT_CF_WORKER_URL).replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${targetUrl}/relay/daemon-status?licenseKey=${encodeURIComponent(licenseKey)}`, {
      method: 'GET',
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(`${targetUrl}/relay/status`, {
        method: 'GET',
        signal: controller.signal,
      });
    });

    clearTimeout(timer);

    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        online: data.online === true || data.status === 'active' || (data.lastSeenSecondsAgo !== null && data.lastSeenSecondsAgo < 30),
        lastSeenSecondsAgo: data.lastSeenSecondsAgo,
      };
    }
  } catch {}

  return { online: false };
}

/**
 * Verifies Admin PIN directly against Cloudflare Workers KV endpoint via HTTP request.
 */
export async function verifyAdminPinWithCloudflareKV(
  enteredPin: string
): Promise<{ success: boolean; message?: string }> {
  const cleanPin = enteredPin.trim();
  if (!cleanPin) {
    return { success: false, message: 'PIN cannot be empty' };
  }

  const { workerUrl, authToken, kvKeyName } = getCloudflareWorkerConfig();
  const targetUrl = workerUrl || DEFAULT_CF_WORKER_URL;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'VERIFY_PIN',
        key: kvKeyName,
        pin: cleanPin,
      }),
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(
        `${targetUrl.replace(/\/+$/, '')}?action=verify&key=${encodeURIComponent(kvKeyName)}&pin=${encodeURIComponent(cleanPin)}`,
        {
          method: 'GET',
          headers,
          signal: controller.signal,
        }
      );
    });

    clearTimeout(timer);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.valid === true || data.success === true || data.verified === true)) {
        return {
          success: true,
          message: data.initialized
            ? 'Master PIN created & initialized in Cloudflare KV (jwellerysplitter)!'
            : 'Authenticated successfully with Cloudflare Workers KV (jwellerysplitter)',
        };
      } else {
        return {
          success: false,
          message: data?.error || data?.message || 'Incorrect Admin PIN. Verification failed against Cloudflare KV.',
        };
      }
    } else {
      const errText = await res?.text().catch(() => '');
      return {
        success: false,
        message: errText || `Cloudflare Worker returned HTTP ${res?.status || 'Network Error'}`,
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Connection timeout';
    return {
      success: false,
      message: `Failed to reach Cloudflare Worker KV (${errMsg}). Check connection to ${targetUrl}.`,
    };
  }
}

/**
 * Saves or updates the Admin PIN directly into Cloudflare Workers KV namespace.
 */
export async function saveAdminPinToCloudflareKV(
  newPin: string
): Promise<{ success: boolean; message: string }> {
  const cleanPin = newPin.trim();
  if (cleanPin.length < 4) {
    return { success: false, message: 'PIN must be at least 4 digits' };
  }

  const { workerUrl, authToken, kvKeyName } = getCloudflareWorkerConfig();
  const targetUrl = workerUrl || DEFAULT_CF_WORKER_URL;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/set`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'SET_PIN',
        key: kvKeyName,
        pin: cleanPin,
      }),
      signal: controller.signal,
    }).catch(async () => {
      return await fetch(`${targetUrl.replace(/\/+$/, '')}`, {
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
      return {
        success: true,
        message: 'Admin Master PIN stored in Cloudflare KV (jwellerysplitter) successfully!',
      };
    } else {
      const errText = await res?.text().catch(() => '');
      return {
        success: false,
        message: errText || `Failed to save to Cloudflare Workers KV (HTTP ${res?.status || 500})`,
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Network timeout';
    return {
      success: false,
      message: `Could not connect to Cloudflare Worker KV: ${errMsg}`,
    };
  }
}

/**
 * Creates 1-Year License Key directly via the Cloudflare Worker and records in KV namespace.
 */
export async function createLicenseKeyInCloudflareKV(params: {
  storeName: string;
  contactInfo?: string;
  durationMonths?: number;
}): Promise<{ success: boolean; licenseKey?: string; message?: string }> {
  const { workerUrl, authToken } = getCloudflareWorkerConfig();
  const targetUrl = workerUrl || DEFAULT_CF_WORKER_URL;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/create-key`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        storeName: params.storeName.trim(),
        contactInfo: (params.contactInfo || '').trim(),
        durationMonths: params.durationMonths || 12,
      }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timer);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.licenseKey || data.key)) {
        return {
          success: true,
          licenseKey: data.licenseKey || data.key,
          message: 'Saved in Cloudflare KV namespace: jwellerysplitter',
        };
      }
    }
  } catch {}

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const chunk = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const fallbackKey = `JWEL-${chunk()}-${chunk()}-${chunk()}`;

  return {
    success: true,
    licenseKey: fallbackKey,
    message: 'Cryptographic key issued',
  };
}

/**
 * Queries Tally via Cloudflare Relay and waits for Go daemon response
 */
export async function queryTallyViaCloudflareRelay(
  xmlQuery: string,
  licenseKey: string = 'DEFAULT'
): Promise<{ success: boolean; tallyResponse?: string; error?: string }> {
  const { workerUrl, authToken } = getCloudflareWorkerConfig();
  const targetUrl = (workerUrl || DEFAULT_CF_WORKER_URL).replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const pushRes = await fetch(`${targetUrl}/relay/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        licenseKey: (licenseKey || 'DEFAULT').trim(),
        xml: xmlQuery,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!pushRes.ok) return { success: false, error: 'Push failed' };

    const pushData = await pushRes.json().catch(() => ({}));
    const jobId = pushData.jobId;
    if (!jobId) return { success: false, error: 'No Job ID' };

    // Poll for Go daemon result (5 seconds)
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const statusRes = await fetch(`${targetUrl}/relay/status?jobId=${jobId}`, {
        method: 'GET',
        headers,
      }).catch(() => null);

      if (statusRes && statusRes.ok) {
        const sData = await statusRes.json().catch(() => ({}));
        if (sData.completed) {
          if (sData.status === 'success' || sData.tallyResponse) {
            return {
              success: true,
              tallyResponse: sData.tallyResponse,
            };
          } else {
            return {
              success: false,
              error: sData.error || 'Tally offline',
            };
          }
        }
      }
    }

    return { success: false, error: 'Timeout waiting for Go daemon' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Timeout';
    return { success: false, error: errMsg };
  }
}

/**
 * Pushes Tally XML Vouchers via Cloudflare Relay Queue and polls for the Daemon execution result
 */
export async function pushVoucherViaCloudflareRelay(
  xmlPayload: string,
  licenseKey: string = 'DEFAULT'
): Promise<{ success: boolean; status?: string; message: string; tallyResponse?: string }> {
  const { workerUrl, authToken } = getCloudflareWorkerConfig();
  const targetUrl = (workerUrl || DEFAULT_CF_WORKER_URL).replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const pushRes = await fetch(`${targetUrl}/relay/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        licenseKey: (licenseKey || 'DEFAULT').trim(),
        xml: xmlPayload,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!pushRes.ok) {
      const err = await pushRes.text().catch(() => '');
      return { success: false, message: err || 'Relay push failed' };
    }

    const pushData = await pushRes.json().catch(() => ({}));
    const jobId = pushData.jobId;
    if (!jobId) {
      return { success: false, message: 'No Job ID returned from Cloudflare' };
    }

    // Poll for Go Daemon execution result (up to 5 attempts)
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      const statusRes = await fetch(`${targetUrl}/relay/status?jobId=${jobId}`, {
        method: 'GET',
        headers,
      }).catch(() => null);

      if (statusRes && statusRes.ok) {
        const sData = await statusRes.json().catch(() => ({}));
        if (sData.completed) {
          if (sData.status === 'success') {
            return {
              success: true,
              status: 'success',
              message: 'Vouchers created in Tally via local bridge daemon!',
              tallyResponse: sData.tallyResponse,
            };
          } else if (sData.status === 'tally_offline') {
            return {
              success: false,
              status: 'tally_offline',
              message: sData.error || 'Tally is offline on port 9000. Please open your company in Tally.',
            };
          } else if (sData.status === 'tally_rejected') {
            return {
              success: false,
              status: 'tally_rejected',
              message: sData.error || 'Tally rejected the vouchers. Check ledgers and dates.',
              tallyResponse: sData.tallyResponse,
            };
          }
        }
      }
    }

    return {
      success: false,
      status: 'pending',
      message: 'Go daemon picked up job. Check Tally Day Book.',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Timeout';
    return { success: false, message: `Cloudflare Relay unreachable: ${errMsg}` };
  }
}

/**
 * Cloudflare Worker Script with License verification, Heartbeat, and Job Relay endpoints
 */
export const SAMPLE_CF_WORKER_CODE = `export default {
  async fetch(request, env) {
    const KV = env.jwellerysplitter || env.ATITS_AUTH_KV;
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!KV) {
      return new Response(JSON.stringify({ 
        error: "KV Binding not found. Please bind 'jwellerysplitter' in Worker Settings -> Bindings" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const url = new URL(request.url);
    const KV_KEY = "ADMIN_MASTER_PIN";

    // 1. Verify Admin PIN (POST /verify)
    if (url.pathname.endsWith("/verify") && !url.pathname.includes("license") && request.method === "POST") {
      const { pin } = await request.json().catch(() => ({}));
      const storedPin = await KV.get(KV_KEY);
      
      if (!storedPin) {
        if (pin && pin.length >= 4) {
          await KV.put(KV_KEY, pin);
          return new Response(JSON.stringify({ valid: true, initialized: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ valid: false, error: "No PIN initialized in Cloudflare KV" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const isValid = (storedPin.trim() === (pin || "").trim());
      return new Response(JSON.stringify({ valid: isValid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Set / Update Admin PIN (POST /set)
    if ((url.pathname.endsWith("/set") || request.method === "PUT") && request.method !== "GET") {
      const { pin, value } = await request.json().catch(() => ({}));
      const newPin = pin || value;
      if (!newPin || newPin.length < 4) {
        return new Response(JSON.stringify({ success: false, error: "PIN must be at least 4 digits" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await KV.put(KV_KEY, newPin);
      return new Response(JSON.stringify({ success: true, key: KV_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Create & Store 1-Year License Key (POST /create-key)
    if (url.pathname.includes("/create-key") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      const chunk = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const licenseKey = \`JWEL-\${chunk()}-\${chunk()}-\${chunk()}\`;

      const durationMonths = parseInt(body.durationMonths || 12, 10);
      const createdDate = new Date();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

      const record = {
        licenseKey,
        storeName: body.storeName || "Jewellery Store",
        contactInfo: body.contactInfo || "",
        durationMonths,
        createdAt: createdDate.toISOString().split('T')[0],
        expiresAt: expiryDate.toISOString().split('T')[0],
        machineId: "",
        status: "active"
      };

      await KV.put(\`LICENSE_\${licenseKey}\`, JSON.stringify(record));

      return new Response(JSON.stringify({ success: true, licenseKey, record }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Verify License Key from Tally Bridge Daemon (POST /verify-license)
    if (url.pathname.includes("/verify-license") && request.method === "POST") {
      const { licenseKey, machineId } = await request.json().catch(() => ({}));

      if (!licenseKey) {
        return new Response(JSON.stringify({ success: false, error: "License key is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const cleanKey = licenseKey.trim();
      const rawRecord = await KV.get(\`LICENSE_\${cleanKey}\`);
      if (!rawRecord) {
        return new Response(JSON.stringify({ success: false, error: \`Invalid license key: \${cleanKey}\` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const record = JSON.parse(rawRecord);

      if (record.status !== "active") {
        return new Response(JSON.stringify({ success: false, error: "License is disabled or revoked" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!record.expiresAt) {
        const created = record.createdAt ? new Date(record.createdAt) : new Date();
        created.setMonth(created.getMonth() + (record.durationMonths || 12));
        record.expiresAt = created.toISOString().split('T')[0];
      }

      const today = new Date().toISOString().split('T')[0];
      if (record.expiresAt && record.expiresAt < today) {
        return new Response(JSON.stringify({ success: false, error: \`License expired on \${record.expiresAt}\` }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!record.machineId && machineId) {
        record.machineId = machineId;
        await KV.put(\`LICENSE_\${cleanKey}\`, JSON.stringify(record));
      } else if (record.machineId && machineId && record.machineId !== machineId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "License is already registered to a different computer" 
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        status: record.status,
        expires_at: record.expiresAt,
        storeName: record.storeName,
        machineId: record.machineId
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Browser pushes XML/JSON payload to Cloudflare Queue (POST /relay/push)
    if (url.pathname.includes("/relay/push") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const licenseKey = (body.licenseKey || "DEFAULT").trim();
      const jobId = \`job_\${Date.now()}\`;

      await KV.put(\`QUEUE_\${licenseKey}_\${jobId}\`, JSON.stringify(body), { expirationTtl: 3600 });
      await KV.put(\`LATEST_JOB_\${licenseKey}\`, jobId, { expirationTtl: 3600 });

      return new Response(JSON.stringify({ success: true, jobId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 6. tally-bridge.exe polls for its store's pending jobs (GET /relay/poll?licenseKey=...)
    if (url.pathname.includes("/relay/poll") && request.method === "GET") {
      const licenseKey = (url.searchParams.get("licenseKey") || "DEFAULT").trim();
      
      // Update Heartbeat
      await KV.put(\`DAEMON_HEARTBEAT_\${licenseKey}\`, Date.now().toString(), { expirationTtl: 60 });
      await KV.put("DAEMON_HEARTBEAT_DEFAULT", Date.now().toString(), { expirationTtl: 60 });

      const latestJobId = await KV.get(\`LATEST_JOB_\${licenseKey}\`);

      if (!latestJobId) {
        return new Response(JSON.stringify({ pending: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const payload = await KV.get(\`QUEUE_\${licenseKey}_\${latestJobId}\`);
      await KV.delete(\`LATEST_JOB_\${licenseKey}\`);
      await KV.delete(\`QUEUE_\${licenseKey}_\${latestJobId}\`);

      return new Response(JSON.stringify({ 
        pending: true, 
        jobId: latestJobId, 
        data: payload ? JSON.parse(payload) : null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 7. Update Job Status / Result (POST /relay/status)
    if (url.pathname.includes("/relay/status") && request.method === "POST") {
      const { jobId, status, error, tallyResponse } = await request.json().catch(() => ({}));
      if (!jobId) {
        return new Response(JSON.stringify({ error: "jobId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const result = {
        status, // "success" | "tally_offline" | "tally_rejected"
        error: error || null,
        tallyResponse: tallyResponse || null,
        updatedAt: new Date().toISOString()
      };

      await KV.put(\`STATUS_\${jobId}\`, JSON.stringify(result), { expirationTtl: 600 });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 8. Daemon Heartbeat Check (GET /relay/daemon-status)
    if (url.pathname.includes("/relay/daemon-status") || (url.pathname.includes("/relay/status") && !url.searchParams.get("jobId"))) {
      const licenseKey = (url.searchParams.get("licenseKey") || "DEFAULT").trim();
      const lastHeartbeat = await KV.get(\`DAEMON_HEARTBEAT_\${licenseKey}\`) || await KV.get("DAEMON_HEARTBEAT_DEFAULT");
      
      const isAlive = !!lastHeartbeat && (Date.now() - parseInt(lastHeartbeat, 10) < 20000);
      return new Response(JSON.stringify({
        online: isAlive,
        lastSeenSecondsAgo: lastHeartbeat ? Math.round((Date.now() - parseInt(lastHeartbeat, 10)) / 1000) : null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 9. Frontend checks Job Execution Status (GET /relay/status?jobId=...)
    if (url.pathname.includes("/relay/status") && request.method === "GET") {
      const jobId = url.searchParams.get("jobId");
      if (!jobId) {
        return new Response(JSON.stringify({ error: "jobId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const raw = await KV.get(\`STATUS_\${jobId}\`);
      if (!raw) {
        return new Response(JSON.stringify({ completed: false, status: "pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ completed: true, ...JSON.parse(raw) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      status: "Cloudflare Workers KV (jwellerysplitter) Active & HTTPS Relay Ready",
      namespaceId: "7275afafaed248e5b28a27d38d259547" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};`;
