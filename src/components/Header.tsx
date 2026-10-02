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
} from 'lucide-react';
import { BridgeStatus } from '../types';

export type ActiveTab = 'workbench' | 'bank-statement' | 'xml-inspector' | 'stock-ledgers' | 'sync-logs';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  bridgeStatus: BridgeStatus;
  onToggleBridgeConnection: () => void;
  onPingBridge: () => void;
  onPushToTally: () => void;
  onOpenBankImport: () => void;
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
  isPushing,
  billCount,
  unsyncedCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'workbench', label: 'Splitter', icon: Layers },
    { id: 'bank-statement', label: 'Bank Statement', icon: FileSpreadsheet },
    { id: 'xml-inspector', label: 'XML Envelope', icon: FileCode2 },
    { id: 'stock-ledgers', label: 'Vault Stock', icon: Database },
    { id: 'sync-logs', label: 'Logs', icon: ScrollText },
  ];

  return (
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

        {/* Right: Uncluttered Tally Status Pill & Push Button */}
        <div className="flex items-center gap-2.5">
          {/* Minimalist Live Status Pill */}
          <button
            type="button"
            onClick={onPingBridge}
            title={
              bridgeStatus.connected
                ? `Tally Prime is Online on http://${bridgeStatus.endpoint}`
                : `Tally Prime is Offline on http://${bridgeStatus.endpoint}. Click to test connection.`
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
              {bridgeStatus.connected ? 'Tally Online' : 'Tally Offline'}
            </span>
            <span className="font-semibold sm:hidden">
              {bridgeStatus.connected ? 'Online' : 'Offline'}
            </span>
            <RefreshCw className="w-3 h-3 ml-0.5 text-slate-400 hover:text-white" />
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
        </div>
      )}
    </header>
  );
};
