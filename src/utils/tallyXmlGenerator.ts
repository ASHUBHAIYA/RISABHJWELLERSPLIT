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

export function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateTallyXmlEnvelope(
  bills: SplitBill[],
  config: SplitConfig,
  companyName: string = 'SHREE BULLION & JEWELLERS PVT LTD'
): string {
  const tallyDate = formatTallyDate(config.billDate);
  const halfGstRate = Number((config.gstRate / 2).toFixed(2));

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
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
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
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateExcelCsvContent(bills: SplitBill[], config: SplitConfig): string {
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
