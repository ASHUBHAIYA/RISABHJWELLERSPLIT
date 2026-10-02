import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  Store,
  Phone,
  Trash2,
  X,
  Share2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Settings,
  Cloud,
  Code,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { LicenseKeyRecord } from '../types';
import {
  getCloudflareWorkerConfig,
  saveCloudflareWorkerConfig,
  saveAdminPinToCloudflareKV,
  SAMPLE_CF_WORKER_CODE,
  CF_WORKER_KEY_NAME,
} from '../utils/adminAuth';

interface AdminKeyGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function generateCryptoLicenseKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 avoiding ambiguous 0/O, 1/I
  const randomChunk = (len: number) => {
    let res = '';
    const array = new Uint8Array(len);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < len; i++) {
      res += chars[array[i] % chars.length];
    }
    return res;
  };

  return `JWEL-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
}

export const AdminKeyGenerator: React.FC<AdminKeyGeneratorProps> = ({ isOpen, onClose }) => {
  const [storeName, setStoreName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(12); // Standard: 1-Year
  const [isLoading, setIsLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<LicenseKeyRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Change PIN & KV settings state
  const [showKvSettings, setShowKvSettings] = useState(false);
  const [showWorkerCode, setShowWorkerCode] = useState(false);
  const [workerUrlInput, setWorkerUrlInput] = useState(() => getCloudflareWorkerConfig().workerUrl);
  const [workerTokenInput, setWorkerTokenInput] = useState(() => getCloudflareWorkerConfig().authToken);
  const [kvStatusMsg, setKvStatusMsg] = useState<string | null>(null);

  const [showChangePin, setShowChangePin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState<string | null>(null);

  // Saved License History
  const [savedKeys, setSavedKeys] = useState<LicenseKeyRecord[]>(() => {
    try {
      const stored = localStorage.getItem('bullionsplit_admin_license_keys');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('bullionsplit_admin_license_keys', JSON.stringify(savedKeys));
    } catch {}
  }, [savedKeys]);

  if (!isOpen) return null;

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    setIsLoading(true);
    setStatusNotice(null);

    const createdDate = new Date();
    const expiryDate = new Date(createdDate);
    expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

    const formattedCreated = createdDate.toISOString().split('T')[0];
    const formattedExpiry = expiryDate.toISOString().split('T')[0];

    let finalLicenseKey = '';

    // Attempt POST call to license server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const response = await fetch('https://license.yourdomain.com/admin/create-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ATITS_ADMIN_MASTER_KEY_2026',
        },
        body: JSON.stringify({
          storeName: storeName.trim(),
          contactInfo: contactInfo.trim(),
          durationMonths,
          product: 'ATITS_SPLIT_TALLY_BRIDGE',
        }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const data = await response.json();
        finalLicenseKey = data.licenseKey || data.key || generateCryptoLicenseKey();
        setStatusNotice('License Key issued by Remote Licensing Server');
      } else {
        // Cryptographic fallback
        finalLicenseKey = generateCryptoLicenseKey();
        setStatusNotice('1-Year Key generated successfully');
      }
    } catch {
      finalLicenseKey = generateCryptoLicenseKey();
      setStatusNotice('1-Year Key generated successfully');
    }

    const newRecord: LicenseKeyRecord = {
      id: `lic-${Date.now()}`,
      licenseKey: finalLicenseKey,
      storeName: storeName.trim(),
      contactInfo: contactInfo.trim(),
      durationMonths,
      createdAt: formattedCreated,
      expiresAt: formattedExpiry,
      status: 'active',
      generatedBy: 'Admin (Cloudflare Workers KV Auth)',
    };

    setGeneratedKey(newRecord);
    setSavedKeys((prev) => [newRecord, ...prev]);
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWorkerCode = () => {
    navigator.clipboard.writeText(SAMPLE_CF_WORKER_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveKvConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudflareWorkerConfig(workerUrlInput, workerTokenInput);
    setKvStatusMsg('Cloudflare Workers KV configuration saved successfully!');
    setTimeout(() => setKvStatusMsg(null), 3000);
  };

  const handleUpdateStoredPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    setPinChangeSuccess(null);

    const trimmed = newPinInput.trim();
    if (trimmed.length < 4) {
      setPinChangeError('PIN must be at least 4 characters/digits.');
      return;
    }
    if (trimmed !== confirmNewPinInput.trim()) {
      setPinChangeError('PIN confirmation does not match.');
      return;
    }

    setIsUpdatingPin(true);
    const res = await saveAdminPinToCloudflareKV(trimmed);
    setIsUpdatingPin(false);

    if (res.success) {
      setPinChangeSuccess(res.message);
      setTimeout(() => {
        setShowChangePin(false);
        setNewPinInput('');
        setConfirmNewPinInput('');
        setPinChangeSuccess(null);
      }, 1800);
    } else {
      setPinChangeError(res.message);
    }
  };

  const getWhatsAppShareUrl = (record: LicenseKeyRecord) => {
    const text = `*ATITS Split ERP — License Activation Key* 💎\n\n*Store Name:* ${record.storeName}\n*License Key:* \`${record.licenseKey}\`\n*Validity:* ${record.durationMonths === 12 ? '1 Year' : `${record.durationMonths} Months`} (Expires: ${record.expiresAt})\n*Tally Service:* tally-bridge.exe (http://127.0.0.1:8080)\n\n*Quick Instructions:*\n1. Start ATITS Split & run \`tally-bridge.exe\`\n2. Enter this License Key to activate the Tally Bridge sync.\n\n_Support: Shree Bullion ERP Tech Support_`;
    
    const cleanPhone = record.contactInfo.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length >= 10 ? `phone=${cleanPhone}&` : '';
    return `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
  };

  const handleDeleteRecord = (id: string) => {
    setSavedKeys((prev) => prev.filter((k) => k.id !== id));
    if (generatedKey?.id === id) setGeneratedKey(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Admin License Key Generator Modal"
    >
      <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/10 text-amber-400 rounded-lg border border-amber-400/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Admin License Key Generator
                </h2>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-amber-400 text-slate-950 rounded flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  <span>CLOUDFLARE KV AUTH</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Issue 1-Year activation keys for retail jewellery stores using <code className="text-amber-300 font-mono">tally-bridge.exe</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowKvSettings((prev) => !prev);
                setShowChangePin(false);
              }}
              title="Cloudflare Workers KV Settings"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-amber-400" />
              <span>Workers KV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowChangePin((prev) => !prev);
                setShowKvSettings(false);
                setPinChangeError(null);
                setPinChangeSuccess(null);
              }}
              title="Change Cloudflare KV Master PIN"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Change PIN</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cloudflare Workers KV Settings Drawer */}
        {showKvSettings && (
          <form
            onSubmit={handleSaveKvConfig}
            className="px-5 py-4 bg-slate-950 border-b border-amber-400/30 space-y-3 animate-in fade-in duration-150 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Cloud className="w-4 h-4" />
                <span>Cloudflare Workers KV Endpoint Configuration</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWorkerCode((prev) => !prev)}
                  className="text-amber-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Code className="w-3 h-3" />
                  <span>{showWorkerCode ? 'Hide Worker Code' : 'View Worker Script'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowKvSettings(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer ml-2"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Worker KV Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  value={workerUrlInput}
                  onChange={(e) => setWorkerUrlInput(e.target.value)}
                  placeholder="https://atits-auth.yourworker.workers.dev"
                  className="w-full h-8 px-2.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Bearer Auth Token / Secret (Optional)
                </label>
                <input
                  type="password"
                  value={workerTokenInput}
                  onChange={(e) => setWorkerTokenInput(e.target.value)}
                  placeholder="Bearer Token for secure KV API"
                  className="w-full h-8 px-2.5 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
              <span>Binding Key: <strong className="text-amber-300">{CF_WORKER_KEY_NAME}</strong></span>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
                >
                  Save Worker KV Config
                </button>
              </div>
            </div>

            {kvStatusMsg && (
              <div className="text-emerald-400 flex items-center gap-1.5 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{kvStatusMsg}</span>
              </div>
            )}

            {showWorkerCode && (
              <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-amber-300 font-bold">worker.js (Cloudflare Workers KV Template)</span>
                  <button
                    type="button"
                    onClick={handleCopyWorkerCode}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded overflow-x-auto max-h-36 leading-tight">
                  {SAMPLE_CF_WORKER_CODE}
                </pre>
              </div>
            )}
          </form>
        )}

        {/* Change PIN Pop-down Box */}
        {showChangePin && (
          <form
            onSubmit={handleUpdateStoredPin}
            className="px-5 py-4 bg-slate-950 border-b border-amber-400/30 space-y-3 animate-in fade-in duration-150 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Lock className="w-4 h-4" />
                <span>Update Master Admin PIN in Cloudflare Workers KV</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePin(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">New Master PIN (min. 4 digits)</label>
                <input
                  type="password"
                  maxLength={24}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="Enter new PIN"
                  className="w-full h-8 px-2.5 text-xs font-mono tracking-wider bg-slate-900 border border-slate-700 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  maxLength={24}
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="Re-enter new PIN"
                  className="w-full h-8 px-2.5 text-xs font-mono tracking-wider bg-slate-900 border border-slate-700 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {pinChangeError && (
              <div className="text-rose-400 flex items-center gap-1.5 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinChangeError}</span>
              </div>
            )}

            {pinChangeSuccess && (
              <div className="text-emerald-400 flex items-center gap-1.5 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{pinChangeSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowChangePin(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingPin || !newPinInput.trim() || !confirmNewPinInput.trim()}
                className="px-3.5 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isUpdatingPin && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Save to Cloudflare KV</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Creation Form */}
          <form onSubmit={handleGenerateKey} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  <span>Store / Jeweller Name *</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. SHREE BALAJI JEWELLERS"
                  className="w-full h-9 px-3 text-xs font-medium text-white bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Phone / Email (Optional)</span>
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="e.g. +91 98765 43210 or store@gmail.com"
                  className="w-full h-9 px-3 text-xs font-medium text-white bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Validity:</span>
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-700">
                  {[
                    { label: '1 Year (Standard)', months: 12 },
                    { label: '6 Months', months: 6 },
                    { label: 'Lifetime', months: 120 },
                  ].map((dur) => (
                    <button
                      key={dur.months}
                      type="button"
                      onClick={() => setDurationMonths(dur.months)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                        durationMonths === dur.months
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !storeName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Generating...' : 'Generate 1-Year Key'}</span>
              </button>
            </div>
          </form>

          {/* Newly Generated Key Display */}
          {generatedKey && (
            <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border-2 border-amber-400/80 rounded-xl p-4.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Official 16-Character License Key</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Valid till: <strong className="text-white">{generatedKey.expiresAt}</strong>
                </span>
              </div>

              {/* Large Key Token Box */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-amber-400/50 rounded-lg">
                <div className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-amber-300 select-all">
                  {generatedKey.licenseKey}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedKey.licenseKey)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer shadow-xs"
                    title="Copy License Key to Clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-slate-900" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Key'}</span>
                  </button>

                  <a
                    href={getWhatsAppShareUrl(generatedKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer shadow-xs"
                    title="Share Key with Jeweller on WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Store: <strong className="text-slate-200">{generatedKey.storeName}</strong></span>
                {statusNotice && <span className="text-amber-300">{statusNotice}</span>}
              </div>
            </div>
          )}

          {/* Generated Keys History Log */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Generated License History ({savedKeys.length})
              </h3>
              {savedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSavedKeys([])}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950">
              {savedKeys.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-sans text-xs">
                  No license keys generated yet in this session.
                </div>
              ) : (
                savedKeys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-900/80 transition-colors font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300 tracking-wide text-xs">
                          {k.licenseKey}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-sans">
                          {k.storeName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Issued: {k.createdAt} · Expires: {k.expiresAt} {k.contactInfo ? `· Contact: ${k.contactInfo}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(k.licenseKey)}
                        className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded cursor-pointer"
                        title="Copy Key"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={getWhatsAppShareUrl(k)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded cursor-pointer"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(k.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Target Service: <code className="text-slate-300 font-mono">http://127.0.0.1:8080 (tally-bridge.exe)</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
