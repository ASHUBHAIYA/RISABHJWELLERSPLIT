import React, { useState } from 'react';
import {
  Copy,
  Check,
  Download,
  Send,
  Database,
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  Server,
  HelpCircle,
  Plus,
  Trash2,
  Layers,
  FileCode2,
} from 'lucide-react';
import { BridgeStatus, SplitBill, SplitConfig, VoucherSyncLog, StockItemPreset } from '../types';

interface XmlInspectorViewProps {
  xmlPayload: string;
  mastersXmlPayload?: string;
  bills: SplitBill[];
  config: SplitConfig;
  bridgeStatus?: BridgeStatus;
  onDownloadXml: () => void;
  onDownloadMastersXml?: () => void;
  onPushToTally: () => void;
  onBackToWorkbench: () => void;
}

export const XmlInspectorView: React.FC<XmlInspectorViewProps> = ({
  xmlPayload,
  mastersXmlPayload,
  bills,
  config,
  bridgeStatus,
  onDownloadXml,
  onDownloadMastersXml,
  onPushToTally,
  onBackToWorkbench,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'vouchers' | 'masters'>('vouchers');

  const currentPayload = activeTab === 'vouchers' ? xmlPayload : (mastersXmlPayload || '');

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToWorkbench}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workbench</span>
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <h2 className="text-sm font-bold text-slate-900">
            Tally XML Envelope Inspector ({bills.length} Vouchers)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-200/80 rounded-md text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('vouchers')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                activeTab === 'vouchers'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vouchers XML
            </button>
            {mastersXmlPayload && (
              <button
                type="button"
                onClick={() => setActiveTab('masters')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === 'masters'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masters XML (All Masters)
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied XML' : 'Copy XML'}</span>
          </button>
          <button
            type="button"
            onClick={activeTab === 'vouchers' ? onDownloadXml : (onDownloadMastersXml || onDownloadXml)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{activeTab === 'vouchers' ? 'Download Vouchers .xml' : 'Download Masters .xml'}</span>
          </button>
          <button
            type="button"
            onClick={onPushToTally}
            disabled={!bridgeStatus?.connected || bills.length === 0}
            title={
              !bridgeStatus?.connected
                ? 'Tally Bridge is Offline. Start tally-bridge.exe & open company in Tally.'
                : 'Dispatch 2-Step Sync into Tally'
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{bridgeStatus?.connected ? 'Dispatch 2-Step Sync' : 'Tally Offline'}</span>
          </button>
        </div>
      </div>

      <div className="p-5 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-[640px]">
        <pre className="leading-relaxed">{currentPayload}</pre>
      </div>
    </section>
  );
};

interface StockAndLedgersViewProps {
  stockMap: Record<string, number>;
  setStockMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  itemPresets: StockItemPreset[];
  onAddItemPreset: (preset: StockItemPreset) => void;
  onRemoveItemPreset: (name: string) => void;
  postLedgers: string[];
  onAddPostLedger: (name: string) => void;
  onRemovePostLedger: (name: string) => void;
  salesLedgers: string[];
  onAddSalesLedger: (name: string) => void;
  onRemoveSalesLedger: (name: string) => void;
  bridgeStatus: BridgeStatus;
  setBridgeStatus: React.Dispatch<React.SetStateAction<BridgeStatus>>;
  onBackToWorkbench: () => void;
}

export const StockAndLedgersView: React.FC<StockAndLedgersViewProps> = ({
  stockMap,
  setStockMap,
  itemPresets,
  onAddItemPreset,
  onRemoveItemPreset,
  postLedgers,
  onAddPostLedger,
  onRemovePostLedger,
  salesLedgers,
  onAddSalesLedger,
  onRemoveSalesLedger,
  bridgeStatus,
  setBridgeStatus,
  onBackToWorkbench,
}) => {
  const [customEndpoint, setCustomEndpoint] = useState(bridgeStatus.endpoint);
  const [customCompany, setCustomCompany] = useState(bridgeStatus.companyName);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToWorkbench}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Splitter Workbench</span>
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Tally Master Ledgers, Inventory &amp; Vault Stock Settings
            </h2>
            <p className="text-xs text-slate-500">
              Manage opening balances, sales accounts, counter cash ledgers &amp; Tally integration
            </p>
          </div>
        </div>
      </div>

      {/* Tally Connection Settings & Diagnostics */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tally Prime / ERP 9 Bridge Settings</h3>
              <p className="text-xs text-slate-500">Configure local XML server port &amp; active company connection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md ${
                bridgeStatus.connected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {bridgeStatus.connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{bridgeStatus.connected ? 'Bridge Connected' : 'Bridge Offline'}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tally Bridge Endpoint (Port)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="127.0.0.1:8080"
                className="h-8 flex-1 px-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
              <button
                type="button"
                onClick={() => setBridgeStatus((prev) => ({ ...prev, endpoint: customEndpoint }))}
                className="px-3 py-1 text-xs font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Company Name in Tally
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                placeholder="SHREE BULLION & JEWELLERS PVT LTD"
                className="h-8 flex-1 px-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-amber-600"
              />
              <button
                type="button"
                onClick={() => setBridgeStatus((prev) => ({ ...prev, companyName: customCompany }))}
                className="px-3 py-1 text-xs font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>

          <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>Windows Bridge Service:</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Run <strong className="text-slate-900 font-mono">tally-bridge.exe</strong> locally on port <strong className="text-slate-900 font-mono">127.0.0.1:8080</strong>, or enable Tally Prime XML server (<strong className="text-slate-900">F1 &rarr; Connectivity</strong>) on port <strong className="text-slate-900 font-mono">9000</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Stock Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Database className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-900">Vault Opening Stock Balance (Grams)</h3>
          </div>
          <div className="space-y-3">
            {itemPresets.map((preset) => {
              const currentStock = stockMap[preset.name] ?? preset.openingStock;
              return (
                <div
                  key={preset.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{preset.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">HSN: {preset.hsnCode} · Grams</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      value={currentStock}
                      onChange={(e) =>
                        setStockMap((prev) => ({
                          ...prev,
                          [preset.name]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-28 h-8 px-2 text-xs font-mono font-bold text-right border border-slate-300 rounded bg-white focus:outline-none focus:border-amber-600"
                    />
                    <span className="text-xs font-bold text-slate-500 font-mono">g</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ledgers Configuration */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">Active Party &amp; Sales Ledgers</h3>
            <span className="text-xs text-slate-500 font-mono">{postLedgers.length + salesLedgers.length} Ledgers</span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1.5">Post / Cash Ledgers:</span>
              <div className="flex flex-wrap gap-1.5">
                {postLedgers.map((l) => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-medium rounded-md border border-slate-200"
                  >
                    <span>{l}</span>
                    {postLedgers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemovePostLedger(l)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="block text-xs font-bold text-slate-700 mb-1.5">Sales Accounts:</span>
              <div className="flex flex-wrap gap-1.5">
                {salesLedgers.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-950 text-xs font-medium rounded-md border border-amber-200"
                  >
                    <span>{s}</span>
                    {salesLedgers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveSalesLedger(s)}
                        className="text-amber-600 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

interface SyncLogsViewProps {
  logs: VoucherSyncLog[];
  onClearLogs: () => void;
  onPushToTally: () => void;
  onBackToWorkbench: () => void;
}

export const SyncLogsView: React.FC<SyncLogsViewProps> = ({
  logs,
  onClearLogs,
  onPushToTally,
  onBackToWorkbench,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToWorkbench}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workbench</span>
          </button>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <h2 className="text-sm font-bold text-slate-900">
            Tally Prime Dispatch &amp; Sync Audit Logs ({logs.length} entries)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              Clear Logs
            </button>
          )}
          <button
            type="button"
            onClick={onPushToTally}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch to Tally</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
            <tr>
              <th className="py-2.5 pl-4 pr-2">Timestamp</th>
              <th className="py-2.5 px-2">Status</th>
              <th className="py-2.5 px-2">Voucher No</th>
              <th className="py-2.5 px-2">Item</th>
              <th className="py-2.5 px-2 text-right">Weight (g)</th>
              <th className="py-2.5 px-2 text-right">Rate (₹/g)</th>
              <th className="py-2.5 px-2 text-right">Bill Amt</th>
              <th className="py-2.5 px-2">Tally Master ID</th>
              <th className="py-2.5 pl-2 pr-4">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs font-mono tabular-nums">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center font-sans text-slate-500">
                  No voucher dispatch logs recorded yet. Click &ldquo;Push to Tally&rdquo; to dispatch your split bills.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2 pl-4 pr-2 text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.status === 'success' ? 'Created' : 'Failed'}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-semibold text-slate-900 whitespace-nowrap">
                    {log.voucherNo}
                  </td>
                  <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{log.itemName}</td>
                  <td className="py-2 px-2 text-right text-slate-900 whitespace-nowrap">
                    {log.weight.toFixed(3)} g
                  </td>
                  <td className="py-2 px-2 text-right text-slate-700 whitespace-nowrap">
                    ₹{log.rate.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-slate-950 whitespace-nowrap">
                    ₹{log.finalBillAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{log.tallyMasterId}</td>
                  <td className="py-2 pl-2 pr-4 text-slate-600 text-xs truncate max-w-xs font-sans">
                    {log.message}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
