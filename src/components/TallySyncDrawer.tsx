import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Copy,
  Check,
  Download,
  Server,
} from 'lucide-react';
import { BridgeStatus, VoucherSyncLog } from '../types';

interface TallySyncDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bridgeStatus: BridgeStatus;
  logs: VoucherSyncLog[];
  isPushing: boolean;
  progress: { current: number; total: number };
  xmlPayload: string;
  onDispatchAgain: () => void;
  onDownloadXml: () => void;
  httpAttemptNotice: string | null;
}

export const TallySyncDrawer: React.FC<TallySyncDrawerProps> = ({
  isOpen,
  onClose,
  bridgeStatus,
  logs,
  isPushing,
  progress,
  xmlPayload,
  onDispatchAgain,
  onDownloadXml,
  httpAttemptNotice,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showRawXml, setShowRawXml] = React.useState(false);

  if (!isOpen) return null;

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Tally Bridge Voucher Dispatch Drawer"
    >
      <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Tally Prime / ERP 9 Voucher Dispatch Console
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>Endpoint: http://{bridgeStatus.endpoint}</span>
              <span aria-hidden="true">·</span>
              <span>Company: {bridgeStatus.companyName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
            aria-label="Close Tally Sync Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-slate-700 font-semibold">
              Batch Progress: {progress.current}/{progress.total}
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-emerald-700 font-medium">
              Created: {successCount}
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className={errorCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
              Errors: {errorCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawXml((prev) => !prev)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors cursor-pointer"
            >
              {showRawXml ? 'View Voucher Logs' : 'View XML Envelope'}
            </button>
            <button
              type="button"
              onClick={onDownloadXml}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .XML</span>
            </button>
          </div>
        </div>

        {httpAttemptNotice && (
          <div className="px-5 py-2.5 bg-amber-50/80 border-b border-amber-200 text-xs text-slate-700 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{httpAttemptNotice}</span>
          </div>
        )}

        {isPushing && progress.total > 0 && (
          <div className="w-full h-1 bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-transform duration-150 origin-left"
              style={{
                transform: `scaleX(${Math.min(1, progress.current / Math.max(1, progress.total))})`,
              }}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {showRawXml ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Generated Tally XML Payload (&lt;ENVELOPE&gt; &rarr; &lt;VOUCHER VCHTYPE=&quot;Sales&quot;&gt;)
                </span>
                <button
                  type="button"
                  onClick={handleCopyXml}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied XML</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy XML</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 bg-slate-950 text-slate-200 text-[11px] font-mono rounded-md overflow-x-auto leading-relaxed max-h-[540px]">
                {xmlPayload}
              </pre>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-semibold">
                  <tr>
                    <th className="py-2 pl-3 pr-2">Status</th>
                    <th className="py-2 px-2">Voucher No</th>
                    <th className="py-2 px-2 text-right">Weight</th>
                    <th className="py-2 px-2 text-right">Bill Amt</th>
                    <th className="py-2 px-2">Tally Master ID</th>
                    <th className="py-2 pl-2 pr-3">Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-mono tabular-nums">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center font-sans text-slate-500">
                        {isPushing
                          ? 'Initializing Tally XML stream to localhost:9000...'
                          : 'No vouchers dispatched in this session yet.'}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 pl-3 pr-2 whitespace-nowrap">
                          {log.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Synced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-sans font-medium">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-semibold text-slate-800 whitespace-nowrap">
                          {log.voucherNo}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-700 whitespace-nowrap">
                          {log.weight.toFixed(3)}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                          ₹{log.finalBillAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                          {log.tallyMasterId}
                        </td>
                        <td className="py-2 pl-2 pr-3 font-sans text-[11px] text-slate-600">
                          {log.message}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Port: 9000 · XML Schema: TallyUDF v2.1
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onDispatchAgain}
              disabled={isPushing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {isPushing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isPushing ? 'Syncing Batch...' : 'Re-Push Batch to Tally'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
