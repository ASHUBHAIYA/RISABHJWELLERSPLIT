import React, { useState } from 'react';
import {
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
  Menu,
  X,
  Layers,
  Sparkles,
  FileSpreadsheet,
  FileCode2,
  Database,
  ScrollText,
  Gem,
  KeyRound,
  Lock,
  ShieldCheck,
  AlertCircle,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { BridgeStatus } from '../types';
import {
  hasAdminPinConfigured,
  verifyAdminPinWithCloudflareKV,
  saveAdminPinToCloudflareKV,
  getCloudflareWorkerConfig,
} from '../utils/adminAuth';

export type ActiveTab = 'workbench' | 'bank-statement' | 'xml-inspector' | 'stock-ledgers' | 'sync-logs';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  bridgeStatus: BridgeStatus;
  onToggleBridgeConnection: () => void;
  onPingBridge: () => void;
  onPushToTally: () => void;
  onOpenBankImport: () => void;
  onOpenAdminKeyGen: () => void;
  isPushing: boolean;
  billCount: number;
  unsyncedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  bridgeStatus,
  onPingBridge,
  onPushToTally,
  onOpenAdminKeyGen,
  isPushing,
  billCount,
  unsyncedCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'workbench', label: 'Splitter', icon: Layers },
    { id: 'bank-statement', label: 'Bank Statement', icon: FileSpreadsheet },
    { id: 'xml-inspector', label: 'XML Envelope', icon: FileCode2 },
    { id: 'stock-ledgers', label: 'Vault Stock', icon: Database },
    { id: 'sync-logs', label: 'Logs', icon: ScrollText },
  ];

  const handleOpenPinModal = () => {
    setPinInput('');
    setConfirmPinInput('');
    setPinError(null);
    const hasPin = hasAdminPinConfigured();
    setIsSettingNewPin(!hasPin);
    setShowPinPrompt(true);
  };

  const handleVerifyOrSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setIsVerifying(true);

    if (isSettingNewPin) {
      // First-time Cloudflare Workers KV PIN initialization
      const trimmed = pinInput.trim();
      if (trimmed.length < 4) {
        setPinError('PIN must be at least 4 characters/digits.');
        setIsVerifying(false);
        return;
      }
      if (trimmed !== confirmPinInput.trim()) {
        setPinError('PIN confirmation does not match.');
        setIsVerifying(false);
        return;
      }

      const res = await saveAdminPinToCloudflareKV(trimmed);
      setIsVerifying(false);
      if (res.success) {
        setShowPinPrompt(false);
        setPinInput('');
        setConfirmPinInput('');
        onOpenAdminKeyGen();
      } else {
        setPinError(res.message || 'Failed to save PIN in Cloudflare Workers KV.');
      }
    } else {
      // Async verification against Cloudflare Workers KV endpoint
      const result = await verifyAdminPinWithCloudflareKV(pinInput);
      setIsVerifying(false);
      if (result.success) {
        setShowPinPrompt(false);
        setPinInput('');
        setPinError(null);
        onOpenAdminKeyGen();
      } else {
        setPinError(result.message || 'Incorrect Admin PIN. Verification failed against Cloudflare Workers KV.');
      }
    }
  };

  const cfConfig = getCloudflareWorkerConfig();

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md text-slate-100 border-b border-slate-800/80 shadow-sm">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between h-14 px-3 sm:px-6">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <a
              href="#workbench"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('workbench');
              }}
              className="flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 shadow-xs ring-1 ring-amber-400/40 group-hover:scale-105 transition-transform">
                <Gem className="w-4 h-4 fill-slate-950/20" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                    ATITS Split
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded">
                    POS
                  </span>
                </div>
              </div>
            </a>
          </div>

          {/* Center: Clean Segmented Navigation Bar */}
          <nav
            className="hidden md:flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner text-xs"
            aria-label="Main Workspace Navigation"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Tally Service Status + Admin Key Trigger + Push Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Minimalist Live Status Pill (Connecting to tally-bridge.exe on 127.0.0.1:8080) */}
            <button
              type="button"
              onClick={onPingBridge}
              title={
                bridgeStatus.connected
                  ? `Connected to local service: ${bridgeStatus.serviceName} on http://${bridgeStatus.endpoint}`
                  : `Local service (${bridgeStatus.serviceName}) Offline on http://${bridgeStatus.endpoint}. Click to test connection.`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                bridgeStatus.connected
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-900/70 text-rose-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {bridgeStatus.connected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    bridgeStatus.connected ? 'bg-emerald-400' : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="font-semibold hidden sm:inline">
                {bridgeStatus.connected ? 'Bridge Online' : 'Bridge Offline'}
              </span>
              <span className="font-semibold sm:hidden">
                {bridgeStatus.connected ? 'Online' : 'Offline'}
              </span>
              <RefreshCw className="w-3 h-3 ml-0.5 text-slate-400 hover:text-white" />
            </button>

            {/* Protected Admin Key Generator Trigger Button */}
            <button
              type="button"
              onClick={handleOpenPinModal}
              title="Admin License Key Generator (Cloudflare Workers KV Auth)"
              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 rounded-lg border border-slate-800 transition-colors cursor-pointer"
              aria-label="Open Admin License Key Generator"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={onPushToTally}
              disabled={isPushing || billCount === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              {isPushing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {isPushing
                  ? 'Syncing...'
                  : unsyncedCount > 0
                  ? `Push (${unsyncedCount.toLocaleString('en-IN')})`
                  : `Push to Tally`}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between px-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenPinModal();
                }}
                className="text-xs text-amber-400 flex items-center gap-1.5 font-semibold py-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Admin License Key Generator</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Admin PIN Verification / Setup Modal */}
      {showPinPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>{isSettingNewPin ? 'Set Cloudflare KV Admin PIN' : 'Admin Authorization'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPinPrompt(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="truncate">
                <span>Auth KV: </span>
                <strong className="text-slate-200 font-mono">{cfConfig.workerUrl ? 'Cloudflare Workers KV' : 'Local KV Storage'}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {isSettingNewPin
                ? 'Create and save your Master Admin PIN directly to your Cloudflare Workers KV namespace.'
                : 'Enter your Master Admin PIN to verify with your Cloudflare Workers KV namespace.'}
            </p>

            <form onSubmit={handleVerifyOrSetPin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {isSettingNewPin ? 'Create Master PIN (min. 4 chars)' : 'Master Admin PIN'}
                </label>
                <input
                  type="password"
                  maxLength={24}
                  autoFocus
                  disabled={isVerifying}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={isSettingNewPin ? 'Create Admin PIN' : 'Enter Stored PIN'}
                  className="w-full h-10 px-3 text-center text-base font-mono tracking-widest bg-slate-950 border border-slate-700 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              {isSettingNewPin && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Confirm Master PIN
                  </label>
                  <input
                    type="password"
                    maxLength={24}
                    disabled={isVerifying}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Re-enter Admin PIN"
                    className="w-full h-10 px-3 text-center text-base font-mono tracking-widest bg-slate-950 border border-slate-700 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {pinError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => setShowPinPrompt(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !pinInput.trim() || (isSettingNewPin && !confirmPinInput.trim())}
                  className="flex-1 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying KV...</span>
                    </>
                  ) : (
                    <span>{isSettingNewPin ? 'Save to KV' : 'Verify PIN'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
