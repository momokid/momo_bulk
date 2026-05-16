// packages/client/src/pages/BatchDetail.jsx

import { useState }              from 'react';
import { useParams, Link }       from 'react-router-dom';
import { useQuery }              from '@tanstack/react-query';
import toast                     from 'react-hot-toast';
import api                       from '../services/api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `GHS ${Number(n || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Status styles ────────────────────────────────────────────────────────────

const BATCH_STATUS = {
  completed:        { style: 'bg-green-100 text-green-700',  label: 'Completed'  },
  processing:       { style: 'bg-blue-100 text-blue-700',    label: 'Processing' },
  partially_failed: { style: 'bg-orange-100 text-orange-700',label: 'Partial'    },
  draft:            { style: 'bg-gray-100 text-gray-500',    label: 'Draft'      },
};

const TRANSFER_STATUS = {
  success:    { style: 'bg-green-100 text-green-700',  label: 'Success'    },
  failed:     { style: 'bg-red-100 text-red-700',      label: 'Failed'     },
  pending:    { style: 'bg-gray-100 text-gray-500',    label: 'Pending'    },
  processing: { style: 'bg-blue-100 text-blue-700',    label: 'Processing' },
  skipped:    { style: 'bg-gray-100 text-gray-400',    label: 'Skipped'    },
};

// ─── Download helper ──────────────────────────────────────────────────────────

const downloadBlob = async (url, filename, setLoading) => {
  setLoading(true);
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const href = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(href);
  } catch {
    toast.error('Download failed. Please try again.');
  } finally {
    setLoading(false);
  }
};

// ─── BatchDetail ──────────────────────────────────────────────────────────────

export default function BatchDetail() {
  const { batchId } = useParams();

  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [csvLoading,  setCsvLoading]  = useState(false);
  const [rowLoading,  setRowLoading]  = useState(null); // transfer id

  const { data, isLoading, isError } = useQuery({
    queryKey: ['batch', batchId],
    queryFn:  () =>
      api.get(`/api/transfers/batch/${batchId}`).then((r) => r.data.batch),
  });

  const batch     = data || null;
  const transfers = batch?.transfers || [];

  // ── Summary counts ────────────────────────────────────
  const successCount  = transfers.filter((t) => t.status === 'success').length;
  const failedCount   = transfers.filter((t) => t.status === 'failed').length;
  const pendingCount  = transfers.filter((t) =>
    ['pending', 'processing'].includes(t.status)).length;

  // ── Download handlers ─────────────────────────────────
  const handleBatchPDF = () =>
    downloadBlob(
      `/api/reports/batch/${batchId}/pdf`,
      `batch-${batchId}-advice.pdf`,
      setPdfLoading,
    );

  const handleCSV = () =>
    downloadBlob(
      `/api/reports/batch/${batchId}/csv`,
      `batch-${batchId}-export.csv`,
      setCsvLoading,
    );

  const handleSinglePDF = (transferId) =>
    downloadBlob(
      `/api/reports/batch/${batchId}/transfer/${transferId}/pdf`,
      `advice-${transferId}.pdf`,
      (v) => setRowLoading(v ? transferId : null),
    );

  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link to="/history"
        className="inline-flex items-center gap-1 text-sm text-gray-500
                   hover:text-gray-800 transition">
        ← Back to History
      </Link>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent
                          rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Loading batch…</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5
                        text-sm text-red-600">
          Failed to load batch. It may not exist or belong to your account.
        </div>
      )}

      {batch && (
        <>
          {/* ── Batch header ───────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-800">
                  {batch.reference}
                </h1>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs
                                  font-medium
                                  ${BATCH_STATUS[batch.status]?.style ||
                                    'bg-gray-100 text-gray-500'}`}>
                  {BATCH_STATUS[batch.status]?.label || batch.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Batch #{batch.id} · {fmtDate(batch.created_at)}
              </p>
            </div>

            {/* Download buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCSV}
                disabled={csvLoading}
                className="px-3 py-2 rounded-lg border border-gray-300 text-xs
                           font-medium text-gray-700 hover:bg-gray-50 transition
                           disabled:opacity-60 flex items-center gap-1.5">
                {csvLoading
                  ? <span className="w-3 h-3 border-2 border-gray-400
                                     border-t-transparent rounded-full animate-spin" />
                  : '↓'} CSV
              </button>
              <button
                onClick={handleBatchPDF}
                disabled={pdfLoading}
                className="px-3 py-2 rounded-lg border border-gray-300 text-xs
                           font-medium text-gray-700 hover:bg-gray-50 transition
                           disabled:opacity-60 flex items-center gap-1.5">
                {pdfLoading
                  ? <span className="w-3 h-3 border-2 border-gray-400
                                     border-t-transparent rounded-full animate-spin" />
                  : '↓'} Batch PDF
              </button>
            </div>
          </div>

          {/* ── Summary cards ──────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Amount',  value: fmt(batch.total_amount)   },
              { label: 'Recipients',    value: batch.total_recipients     },
              { label: 'Successful',    value: successCount,
                color: successCount > 0 ? 'text-green-700' : 'text-gray-800' },
              { label: 'Failed',        value: failedCount,
                color: failedCount > 0 ? 'text-red-600' : 'text-gray-800'  },
            ].map(({ label, value, color }) => (
              <div key={label}
                className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-400 uppercase
                               tracking-wide mb-1">
                  {label}
                </p>
                <p className={`text-xl font-bold ${color || 'text-gray-800'}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Batch info ─────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4
                          flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              <span className="text-gray-400">Sender: </span>
              <span className="text-gray-700">{batch.sender_number}</span>
              {batch.sender_name && (
                <span className="text-gray-500"> ({batch.sender_name})</span>
              )}
            </span>
            {batch.account_label && (
              <span>
                <span className="text-gray-400">Account: </span>
                <span className="text-gray-700">{batch.account_label}</span>
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-amber-600 font-medium">
                ⚠ {pendingCount} transfer{pendingCount !== 1 ? 's' : ''} still pending
              </span>
            )}
          </div>

          {/* ── Transfers table ────────────────────────── */}
          {transfers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['#', 'Mobile Number', 'Your Name', 'MTN Name',
                      'Amount', 'Status', 'MTN Ref', ''].map((h) => (
                      <th key={h}
                        className={`px-4 py-3 text-xs font-medium text-gray-500
                                    ${h === 'Amount' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transfers.map((t, i) => {
                    const st = TRANSFER_STATUS[t.status] ||
                      { style: 'bg-gray-100 text-gray-500', label: t.status };

                    return (
                      <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {t.recipient_phone}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {t.recipient_name_input}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {t.recipient_name_mtn ||
                            <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(t.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full
                                           text-xs font-medium ${st.style}`}>
                            {st.label}
                          </span>
                          {t.failure_reason && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {t.failure_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                          {t.mtn_reference ||
                            <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.status === 'success' && (
                            <button
                              onClick={() => handleSinglePDF(t.id)}
                              disabled={rowLoading === t.id}
                              className="text-xs text-brand-600 hover:text-brand-800
                                         transition disabled:opacity-60">
                              {rowLoading === t.id ? '…' : '↓ PDF'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

    </div>
  );
}