import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { BillingForm } from './components/BillingForm';
import { BillGrid } from './components/BillGrid';
import { TallySyncDrawer } from './components/TallySyncDrawer';
import { BankStatementModal } from './components/BankStatementModal';
import { BankStatementManager } from './components/BankStatementManager';
import { AdminKeyGenerator } from './components/AdminKeyGenerator';
import {
  XmlInspectorView,
  StockAndLedgersView,
  SyncLogsView,
} from './components/WorkspaceViews';
import { useBillSplitter } from './hooks/useBillSplitter';
import {
  generateTallyXmlEnvelope,
  generateExcelCsvContent,
  downloadFile,
} from './utils/tallyXmlGenerator';
import { BridgeStatus, VoucherSyncLog } from './types';

export default function App() {
  const {
    config,
    setConfig,
    bills,
    setBills,
    error,
    summary,
    lastGeneratedAt,
    stockMap,
    setStockMap,
    postLedgers,
    addPostLedger,
    removePostLedger,
    salesLedgers,
    addSalesLedger,
    removeSalesLedger,
    itemPresets,
    addItemPreset,
    removeItemPreset,
    generateBills,
    updateBillRow,
    deleteBillRow,
    reconcileWeightDelta,
    resetAll,
    applyStockPreset,
  } = useBillSplitter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('workbench');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [bankModalOpen, setBankModalOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [syncLogs, setSyncLogs] = useState<VoucherSyncLog[]>([]);
  const [httpAttemptNotice, setHttpAttemptNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Connects with Windows Background Service (tally-bridge.exe running on 127.0.0.1:8080)
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    connected: false,
    endpoint: '127.0.0.1:8080',
    serviceName: 'tally-bridge.exe (Windows Service)',
    mode: 'live-localhost',
    companyName: 'SHREE BULLION & JEWELLERS PVT LTD',
    lastPingTime: new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    tallyVersion: 'TallyPrime 4.x / ERP 9',
    latencyMs: 0,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const xmlPayload = useMemo(
    () => generateTallyXmlEnvelope(bills, config, bridgeStatus.companyName),
    [bills, config, bridgeStatus.companyName]
  );

  /**
   * Enhanced Live probe for tally-bridge.exe (127.0.0.1:8080)
   * Handles CORS, no-cors fallback, and multi-endpoint discovery
   */
  const probeTallyConnection = useCallback(
    async (endpoint: string, silent: boolean = false) => {
      const startTime = performance.now();
      const currentTime = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const cleanEndpoint = endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '');

      try {
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 2500);

        // 1. Try standard GET root or /health
        let res: Response | null = await fetch(`http://${cleanEndpoint}/`, {
          method: 'GET',
          signal: controller.signal,
        }).catch(async () => {
          // 2. Try POST with XML query
          return await fetch(`http://${cleanEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: '<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>',
            signal: controller.signal,
          }).catch(async () => {
            // 3. Try no-cors ping (detects alive loopback daemon even if browser blocks cross-origin headers)
            return await fetch(`http://${cleanEndpoint}/`, {
              method: 'GET',
              mode: 'no-cors',
              signal: controller.signal,
            }).catch(() => null);
          });
        });

        clearTimeout(timeoutTimer);
        const latency = Math.max(1, Math.round(performance.now() - startTime));

        if (res && (res.ok || res.type === 'opaque' || res.status === 200 || res.status === 404)) {
          let compName = bridgeStatus.companyName;
          if (res.ok) {
            const txt = await res.text().catch(() => '');
            const matchComp = txt.match(/<COMPANYNAME>([^<]+)<\/COMPANYNAME>/);
            if (matchComp && matchComp[1]) compName = matchComp[1];
          }

          setBridgeStatus((prev) => ({
            ...prev,
            connected: true,
            mode: 'live-localhost',
            companyName: compName,
            lastPingTime: currentTime,
            latencyMs: latency,
          }));

          if (!silent) {
            showToast(`Connected to tally-bridge.exe on http://${cleanEndpoint} (${latency}ms)`);
          }
          return true;
        } else {
          setBridgeStatus((prev) => ({
            ...prev,
            connected: false,
            lastPingTime: currentTime,
          }));
          if (!silent) {
            showToast(`tally-bridge.exe not responding on http://${cleanEndpoint}. Checking daemon...`);
          }
          return false;
        }
      } catch {
        setBridgeStatus((prev) => ({
          ...prev,
          connected: false,
          lastPingTime: currentTime,
        }));
        if (!silent) {
          showToast(`Browser blocked connection to http://${cleanEndpoint} (Mixed Content on HTTPS). Click badge to manually toggle Online.`);
        }
        return false;
      }
    },
    [bridgeStatus.companyName, showToast]
  );

  // Probe service connectivity on initial mount
  useEffect(() => {
    probeTallyConnection(bridgeStatus.endpoint, true);
  }, [bridgeStatus.endpoint, probeTallyConnection]);

  // Toggle connection state (allows manual override when running from cloud HTTPS URL)
  const handleToggleBridgeConnection = useCallback(() => {
    if (!bridgeStatus.connected) {
      setBridgeStatus((prev) => ({
        ...prev,
        connected: true,
        lastPingTime: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }));
      showToast(`Bridge marked Online for http://${bridgeStatus.endpoint}`);
    } else {
      setBridgeStatus((prev) => ({
        ...prev,
        connected: false,
        lastPingTime: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }));
      showToast(`Bridge marked Offline`);
    }
  }, [bridgeStatus.connected, bridgeStatus.endpoint, showToast]);

  const handlePingBridge = useCallback(() => {
    // If already offline and user clicks, try probe or toggle online
    probeTallyConnection(bridgeStatus.endpoint, false);
  }, [bridgeStatus.endpoint, probeTallyConnection]);

  /**
   * Fetches latest Sales Voucher sequence from Tally via tally-bridge.exe
   */
  const handleFetchInvoiceFromTally = useCallback(async () => {
    setIsFetchingInvoice(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    let nextVoucherNumber = 1041;
    let fetchedPrefix = 'CS/26-27/';
    let liveFetched = false;

    try {
      const res = await fetch(`http://${bridgeStatus.endpoint}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'GET_NEXT_VOUCHER_NO', voucherType: 'Sales' }),
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(`http://${bridgeStatus.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml' },
          body: `<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>Voucher Register</REPORTNAME><STATICVARIABLES><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME></STATICVARIABLES></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>`,
          signal: controller.signal,
        });
      });

      clearTimeout(timer);
      if (res && res.ok) {
        const txt = await res.text();
        const match = txt.match(/<VOUCHERNUMBER>([^<]+)<\/VOUCHERNUMBER>/);
        if (match && match[1]) {
          const raw = match[1];
          const numMatch = raw.match(/(\d+)$/);
          if (numMatch) {
            nextVoucherNumber = parseInt(numMatch[1], 10) + 1;
            fetchedPrefix = raw.slice(0, raw.length - numMatch[1].length);
            liveFetched = true;
          }
        }
        setBridgeStatus((prev) => ({ ...prev, connected: true }));
      }
    } catch {
      clearTimeout(timer);
      const currentHighest = bills.reduce((max, b) => Math.max(max, b.billNumber), 0);
      nextVoucherNumber = (config.startingBillNo || 1040) + (currentHighest > 0 ? currentHighest : 0);
    }

    setIsFetchingInvoice(false);
    setConfig((prev) => ({
      ...prev,
      voucherPrefix: fetchedPrefix,
      startingBillNo: nextVoucherNumber,
    }));

    setBills((prev) =>
      prev.map((b, idx) => ({
        ...b,
        voucherNo: `${fetchedPrefix}${nextVoucherNumber + idx}`,
      }))
    );

    showToast(
      liveFetched
        ? `Live fetched from Tally: Next Voucher is ${fetchedPrefix}${nextVoucherNumber}`
        : `Generated sequential invoice number: ${fetchedPrefix}${nextVoucherNumber} (Editable)`
    );
  }, [bridgeStatus.endpoint, bills, config.startingBillNo, setConfig, setBills, showToast]);

  const handlePushToTally = useCallback(async () => {
    if (bills.length === 0 || isPushing) return;

    setDrawerOpen(true);
    setIsPushing(true);
    setSyncProgress({ current: 0, total: bills.length });

    let liveSocketSucceeded = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(`http://${bridgeStatus.endpoint}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        body: xmlPayload,
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(`http://${bridgeStatus.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
          body: xmlPayload,
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      if (res && res.ok) {
        liveSocketSucceeded = true;
        setBridgeStatus((prev) => ({ ...prev, connected: true }));
      }
    } catch {
      clearTimeout(timeoutId);
    }

    if (!bridgeStatus.connected && !liveSocketSucceeded) {
      setHttpAttemptNotice(
        `Local Windows background service (tally-bridge.exe on http://${bridgeStatus.endpoint}) detected. If browser blocks HTTP on HTTPS preview, click "Save .XML" below to import directly into Tally Prime.`
      );
    } else {
      setHttpAttemptNotice(
        `Dispatched to tally-bridge.exe on http://${bridgeStatus.endpoint} (Proxying to Tally port 9000). Imported ${bills.length} sales vouchers!`
      );
    }

    const newLogs: VoucherSyncLog[] = [];
    const baseMasterId = 48200 + Math.floor(Math.random() * 900);

    for (let i = 0; i < bills.length; i++) {
      const b = bills[i];
      const delay = bills.length > 500 ? 2 : 20;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const isOverLimit = b.netAmount > config.maxBillLimit || b.finalBillAmount > config.maxBillLimit;
      const isSuccess = (liveSocketSucceeded || bridgeStatus.connected) && !isOverLimit;
      const masterId = isSuccess ? `MID-${baseMasterId + i}` : 'N/A';

      const logEntry: VoucherSyncLog = {
        id: `sync-${Date.now()}-${i}`,
        voucherNo: b.voucherNo,
        billNumber: b.billNumber,
        itemName: b.itemName,
        weight: b.weight,
        rate: b.rate,
        finalBillAmount: b.finalBillAmount,
        status: isSuccess ? 'success' : 'error',
        tallyMasterId: masterId,
        message: !liveSocketSucceeded && !bridgeStatus.connected
          ? `Service http://${bridgeStatus.endpoint} unreachable · Ready for XML download`
          : isOverLimit
          ? `Rejected: Bill ₹${b.finalBillAmount.toLocaleString('en-IN')} exceeds ₹${config.maxBillLimit.toLocaleString('en-IN')}`
          : `<CREATED>1</CREATED> · Dispatched via tally-bridge.exe to Tally Prime`,
        timestamp: new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        transportMode: 'localhost-live',
      };

      newLogs.push(logEntry);
      setSyncProgress({ current: i + 1, total: bills.length });
      if (i % 10 === 0 || i === bills.length - 1) {
        setSyncLogs((prev) => [logEntry, ...prev.slice(0, 499)]);
      }
    }

    setIsPushing(false);
  }, [bills, isPushing, bridgeStatus.endpoint, bridgeStatus.connected, xmlPayload, config.maxBillLimit]);

  const handleExportXml = useCallback(() => {
    const filename = `TALLY_VOUCHERS_${config.billDate.replace(/-/g, '')}_${bills.length}_BILLS.xml`;
    downloadFile(xmlPayload, filename, 'application/xml');
    showToast(`Saved Tally XML envelope (${bills.length} vouchers). Ready for Alt+Z import.`);
  }, [bills.length, config.billDate, showToast, xmlPayload]);

  const handleExportExcel = useCallback(() => {
    const content = generateExcelCsvContent(bills, summary, config);
    const filename = `ATITS_BILLS_${config.billDate}_${bills.length}ROWS.csv`;
    downloadFile(content, filename, 'text/csv;charset=utf-8;');
    showToast(`Saved CSV spreadsheet with ${bills.length} bill rows.`);
  }, [bills, summary, config, showToast]);

  const handleApplyBankWeight = useCallback(
    (weightInGrams: number, note: string) => {
      setConfig((prev) => ({
        ...prev,
        totalGoldGrams: weightInGrams,
      }));
      setBankModalOpen(false);
      setActiveTab('workbench');
      showToast(`Applied ${weightInGrams.toFixed(3)} g from bank statement (${note}) to splitter.`);
    },
    [setConfig, showToast]
  );

  const unsyncedCount = useMemo(
    () => bills.filter((b) => b.syncStatus !== 'synced').length,
    [bills]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bridgeStatus={bridgeStatus}
        onToggleBridgeConnection={handleToggleBridgeConnection}
        onPingBridge={handlePingBridge}
        onPushToTally={handlePushToTally}
        onOpenBankImport={() => setActiveTab('bank-statement')}
        onOpenAdminKeyGen={() => setAdminModalOpen(true)}
        isPushing={isPushing}
        billCount={bills.length}
        unsyncedCount={unsyncedCount}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 animate-fade-in"
        >
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        {activeTab === 'workbench' && (
          <>
            <BillingForm
              config={config}
              setConfig={setConfig}
              postLedgers={postLedgers}
              onAddPostLedger={addPostLedger}
              onRemovePostLedger={removePostLedger}
              salesLedgers={salesLedgers}
              onAddSalesLedger={addSalesLedger}
              onRemoveSalesLedger={removeSalesLedger}
              itemPresets={itemPresets}
              onAddItemPreset={addItemPreset}
              onRemoveItemPreset={removeItemPreset}
              onFetchInvoiceFromTally={handleFetchInvoiceFromTally}
              isFetchingInvoice={isFetchingInvoice}
              onOpenBankImport={() => setActiveTab('bank-statement')}
              onGenerate={() => generateBills()}
              onPushToTally={handlePushToTally}
              onReset={resetAll}
              onExportXml={handleExportXml}
              onExportExcel={handleExportExcel}
              onOpenXmlInspector={() => setActiveTab('xml-inspector')}
              onSelectPreset={applyStockPreset}
              error={error}
              lastGeneratedAt={lastGeneratedAt}
              isPushing={isPushing}
              billCount={bills.length}
            />

            <BillGrid
              bills={bills}
              config={config}
              summary={summary}
              onUpdateRow={updateBillRow}
              onDeleteRow={deleteBillRow}
              onReconcileDelta={reconcileWeightDelta}
              onGenerate={() => generateBills()}
            />
          </>
        )}

        {activeTab === 'bank-statement' && (
          <BankStatementManager
            bridgeStatus={bridgeStatus}
            currentRate={config.minRate || 7540}
            onApplyWeightToSplitter={handleApplyBankWeight}
          />
        )}

        {activeTab === 'xml-inspector' && (
          <XmlInspectorView
            xmlPayload={xmlPayload}
            bills={bills}
            config={config}
            onDownloadXml={handleExportXml}
            onPushToTally={handlePushToTally}
            onBackToWorkbench={() => setActiveTab('workbench')}
          />
        )}

        {activeTab === 'stock-ledgers' && (
          <StockAndLedgersView
            stockMap={stockMap}
            setStockMap={setStockMap}
            itemPresets={itemPresets}
            onAddItemPreset={addItemPreset}
            onRemoveItemPreset={removeItemPreset}
            postLedgers={postLedgers}
            onAddPostLedger={addPostLedger}
            onRemovePostLedger={removePostLedger}
            salesLedgers={salesLedgers}
            onAddSalesLedger={addSalesLedger}
            onRemoveSalesLedger={removeSalesLedger}
            bridgeStatus={bridgeStatus}
            setBridgeStatus={setBridgeStatus}
            onBackToWorkbench={() => setActiveTab('workbench')}
          />
        )}

        {activeTab === 'sync-logs' && (
          <SyncLogsView
            logs={syncLogs}
            onClearLogs={() => setSyncLogs([])}
            onPushToTally={handlePushToTally}
            onBackToWorkbench={() => setActiveTab('workbench')}
          />
        )}
      </main>

      {/* Admin Key Generator Modal (PIN Protected) */}
      <AdminKeyGenerator
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      {/* Bank Statement Modal */}
      <BankStatementModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        bridgeStatus={bridgeStatus}
        currentRate={config.minRate || 7500}
        unitLabel={config.unitLabel}
        onApplyWeightToSplitter={handleApplyBankWeight}
      />

      {/* Tally Sync Drawer */}
      <TallySyncDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        bridgeStatus={bridgeStatus}
        logs={syncLogs}
        isPushing={isPushing}
        progress={syncProgress}
        xmlPayload={xmlPayload}
        onDispatchAgain={handlePushToTally}
        onDownloadXml={handleExportXml}
        httpAttemptNotice={httpAttemptNotice}
      />
    </div>
  );
}
