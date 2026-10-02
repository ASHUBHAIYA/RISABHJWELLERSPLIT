import { SplitBill, SplitConfig, BankVoucherEntry } from '../types';

export function formatTallyDate(isoDate: string): string {
  const cleaned = (isoDate || '').replace(/-/g, '');
  if (/^\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Escapes XML strings safely, stripping any preexisting XML/HTML entity encoding down
 * to raw text first to guarantee zero double-escaping (e.g. `&amp;` will never become `&amp;amp;`).
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  const unescaped = String(unsafe)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");

  return unescaped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Automatically creates all required Tally Masters (Units of Measure, Stock Items, Sales Ledgers,
 * Tax/Duty Ledgers, Round Off, and Party/Cash Ledgers) in an "All Masters" import envelope.
 * Importing this before vouchers guarantees Tally will never reject entries for missing master records.
 */
export function generateTallyMastersXml(
  bills: SplitBill[],
  companyName: string = 'SHREE BULLION & JEWELLERS PVT LTD',
  config?: SplitConfig
): string {
  const safeCompany = escapeXml(companyName);

  // 1. Unique Units of Measure
  const units = new Set<string>(['GMS']);
  if (config?.unitLabel) units.add(config.unitLabel.trim().toUpperCase());

  // 2. Unique Stock Items
  const stockItems = new Set<string>();
  if (config?.itemName) stockItems.add(config.itemName.trim());
  bills.forEach((b) => {
    if (b.itemName) stockItems.add(b.itemName.trim());
  });

  // 3. Unique Sales Ledgers
  const salesLedgers = new Set<string>();
  if (config?.itemSalesAccount) salesLedgers.add(config.itemSalesAccount.trim());
  bills.forEach((b) => {
    if (b.itemSalesAccount) salesLedgers.add(b.itemSalesAccount.trim());
  });
  if (salesLedgers.size === 0) salesLedgers.add('Sales Account');

  // 4. Unique Tax/Duty Ledgers
  const gstRate = config?.gstRate ?? (bills[0]?.gstRate || 3);
  const halfGstRate = Number((gstRate / 2).toFixed(2));
  const taxLedgers = new Set<string>([
    `CGST OUTPUT ${halfGstRate}%`,
    `SGST OUTPUT ${halfGstRate}%`,
    'CGST',
    'SGST',
    'IGST',
  ]);

  // 5. Unique Party / Cash / Counter Ledgers
  const partyLedgers = new Set<string>();
  if (config?.postAccountName) partyLedgers.add(config.postAccountName.trim());
  bills.forEach((b) => {
    if (b.postAccountName) partyLedgers.add(b.postAccountName.trim());
  });
  if (partyLedgers.size === 0) partyLedgers.add('Cash');

  // Build XML blocks
  const unitBlocks = Array.from(units)
    .map((u) => {
      const uSafe = escapeXml(u);
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <UNIT NAME="${uSafe}" ACTION="Create">
          <NAME>${uSafe}</NAME>
          <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          <DECIMALPLACES>3</DECIMALPLACES>
          <ORIGINALNAME>Grams</ORIGINALNAME>
        </UNIT>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  const stockItemBlocks = Array.from(stockItems)
    .map((item) => {
      const itemSafe = escapeXml(item);
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="${itemSafe}" ACTION="Create">
          <NAME>${itemSafe}</NAME>
          <BASEUNITS>GMS</BASEUNITS>
          <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
          <ISBATCHWISEON>No</ISBATCHWISEON>
          <ISPERISHABLEON>No</ISPERISHABLEON>
          <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
          <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
        </STOCKITEM>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  const salesLedgerBlocks = Array.from(salesLedgers)
    .map((s) => {
      const sSafe = escapeXml(s);
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${sSafe}" ACTION="Create">
          <NAME>${sSafe}</NAME>
          <PARENT>Sales Accounts</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
          <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
          <TAXTYPE>Others</TAXTYPE>
        </LEDGER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  const taxLedgerBlocks = Array.from(taxLedgers)
    .map((t) => {
      const tSafe = escapeXml(t);
      const isCgst = t.includes('CGST');
      const isSgst = t.includes('SGST');
      const dutyHead = isCgst ? 'Central Tax' : isSgst ? 'State Tax' : 'Integrated Tax';
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${tSafe}" ACTION="Create">
          <NAME>${tSafe}</NAME>
          <PARENT>Duties &amp; Taxes</PARENT>
          <TAXTYPE>GST</TAXTYPE>
          <GSTDUTYHEAD>${dutyHead}</GSTDUTYHEAD>
          <RATEOFTAXCALCULATION>${halfGstRate}</RATEOFTAXCALCULATION>
        </LEDGER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  const roundOffBlock = `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="ROUND OFF" ACTION="Create">
          <NAME>ROUND OFF</NAME>
          <PARENT>Indirect Expenses</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <ROUNDINGMETHOD>Normal Rounding</ROUNDINGMETHOD>
          <ROUNDINGLIMIT>1</ROUNDINGLIMIT>
        </LEDGER>
      </TALLYMESSAGE>`;

  const partyLedgerBlocks = Array.from(partyLedgers)
    .map((p) => {
      const pSafe = escapeXml(p);
      const isCash = /cash|counter|petty|vault/i.test(p);
      const parent = isCash ? 'Cash-in-hand' : 'Sundry Debtors';
      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${pSafe}" ACTION="Create">
          <NAME>${pSafe}</NAME>
          <PARENT>${parent}</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
        </LEDGER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${unitBlocks}
${stockItemBlocks}
${salesLedgerBlocks}
${taxLedgerBlocks}
${roundOffBlock}
${partyLedgerBlocks}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Generates Tally Sales Vouchers XML Import Envelope
 */
export function generateTallyXmlEnvelope(
  bills: SplitBill[],
  config: SplitConfig,
  companyName: string = 'SHREE BULLION & JEWELLERS PVT LTD'
): string {
  const tallyDate = formatTallyDate(config.billDate);
  const halfGstRate = Number((config.gstRate / 2).toFixed(2));
  const safeCompany = escapeXml(companyName);

  const voucherMessages = bills
    .map((bill, index) => {
      const cgstAmount = Number((bill.gstAmount / 2).toFixed(2));
      const sgstAmount = Number((bill.gstAmount - cgstAmount).toFixed(2));
      const remoteId = `bullionsplit-${tallyDate}-${String(bill.billNumber).padStart(4, '0')}`;
      const vchKey = `${remoteId}:${index + 1}`;

      const roundOffEntry =
        Math.abs(bill.roundOff) > 0.0001
          ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>ROUND OFF</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${bill.roundOff < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${bill.roundOff.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`
          : '';

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER REMOTEID="${escapeXml(remoteId)}" VCHKEY="${escapeXml(vchKey)}" VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(bill.voucherNo)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(bill.postAccountName)}</PARTYLEDGERNAME>
          <BASICBASEPARTYNAME>${escapeXml(bill.postAccountName)}</BASICBASEPARTYNAME>
          <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <ISINVOICE>Yes</ISINVOICE>
          <NARRATION>Retail Counter Bullion Cash Sale - Split Batch #${bill.billNumber} (${bill.weight.toFixed(3)} ${escapeXml(config.unitLabel)} @ ${bill.rate.toFixed(2)})</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(bill.postAccountName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>-${bill.finalBillAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>CGST OUTPUT ${halfGstRate}%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${cgstAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>SGST OUTPUT ${halfGstRate}%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${sgstAmount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>${roundOffEntry}
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${escapeXml(bill.itemName)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
            <RATE>${bill.rate.toFixed(2)}/${escapeXml(config.unitLabel)}</RATE>
            <AMOUNT>${bill.grossAmount.toFixed(2)}</AMOUNT>
            <ACTUALQTY> ${bill.weight.toFixed(3)} ${escapeXml(config.unitLabel)}</ACTUALQTY>
            <BILLEDQTY> ${bill.weight.toFixed(3)} ${escapeXml(config.unitLabel)}</BILLEDQTY>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${escapeXml(bill.itemSalesAccount)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${bill.grossAmount.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateBankVouchersTallyXml(
  entries: BankVoucherEntry[],
  companyName: string = 'SHREE BULLION & JEWELLERS PVT LTD'
): string {
  const safeCompany = escapeXml(companyName);
  const voucherMessages = entries
    .filter((e) => e.selected)
    .map((e, index) => {
      const tallyDate = formatTallyDate(e.date);
      const isReceipt = e.type === 'Receipt';
      const vchType = isReceipt ? 'Receipt' : 'Payment';
      const vchNumber = e.refNo || `${isReceipt ? 'BRCT' : 'BPMT'}-${index + 1}`;
      const remoteId = `bank-stmt-${tallyDate}-${index + 1}-${vchNumber}`;
      const vchKey = `${remoteId}:${index + 1}`;

      const amtStr = Math.abs(e.amount).toFixed(2);

      if (isReceipt) {
        return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER REMOTEID="${escapeXml(remoteId)}" VCHKEY="${escapeXml(vchKey)}" VCHTYPE="Receipt" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(vchNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(e.partyLedger)}</PARTYLEDGERNAME>
          <NARRATION>${escapeXml(e.narration)} · Ref: ${escapeXml(e.refNo)}</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(e.bankLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>-${amtStr}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(e.partyLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>${amtStr}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
      } else {
        return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER REMOTEID="${escapeXml(remoteId)}" VCHKEY="${escapeXml(vchKey)}" VCHTYPE="Payment" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(vchNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(e.partyLedger)}</PARTYLEDGERNAME>
          <NARRATION>${escapeXml(e.narration)} · Ref: ${escapeXml(e.refNo)}</NARRATION>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(e.partyLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>-${amtStr}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(e.bankLedger)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${amtStr}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
      }
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateExcelCsvContent(
  bills: SplitBill[],
  summary: unknown,
  config: SplitConfig
): string {
  const headers = [
    'Bill #',
    'Voucher No',
    'Bill Date',
    'Post Account Ledger',
    'Stock Item',
    'Sales Ledger',
    `Weight (${config.unitLabel})`,
    'Unit Rate (INR)',
    'Gross Taxable Amt (INR)',
    'GST Rate (%)',
    'GST Amt (INR)',
    'Net Amt (INR)',
    'Round Off (INR)',
    'Final Bill Amt (INR)',
  ];

  const rows = bills.map((b) => [
    b.billNumber,
    `"${b.voucherNo}"`,
    b.billDate,
    `"${b.postAccountName}"`,
    `"${b.itemName}"`,
    `"${b.itemSalesAccount}"`,
    b.weight.toFixed(3),
    b.rate.toFixed(2),
    b.grossAmount.toFixed(2),
    b.gstRate.toFixed(2),
    b.gstAmount.toFixed(2),
    b.netAmount.toFixed(2),
    b.roundOff.toFixed(2),
    b.finalBillAmount.toFixed(2),
  ]);

  const totalWeight = bills.reduce((acc, b) => acc + Math.round(b.weight * 1000), 0) / 1000;
  const totalGross = bills.reduce((acc, b) => acc + b.grossAmount, 0);
  const totalGst = bills.reduce((acc, b) => acc + b.gstAmount, 0);
  const totalNet = bills.reduce((acc, b) => acc + b.netAmount, 0);
  const totalRoundOff = bills.reduce((acc, b) => acc + b.roundOff, 0);
  const totalFinal = bills.reduce((acc, b) => acc + b.finalBillAmount, 0);

  const summaryRow = [
    'TOTAL',
    `"${bills.length} Vouchers"`,
    config.billDate,
    `"${config.postAccountName}"`,
    `"${config.itemName}"`,
    `"${config.itemSalesAccount}"`,
    totalWeight.toFixed(3),
    '',
    totalGross.toFixed(2),
    config.gstRate.toFixed(2),
    totalGst.toFixed(2),
    totalNet.toFixed(2),
    totalRoundOff.toFixed(2),
    totalFinal.toFixed(2),
  ];

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\r\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
