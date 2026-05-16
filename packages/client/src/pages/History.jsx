// packages/client/src/pages/History.jsx

import { useQuery }      from '@tanstack/react-query';
import { Link }          from 'react-router-dom';
import api               from '../services/api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `GHS ${Number(n || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GH', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GH', {
    hour:   '2-digit',
    minute: '2-digit',
  });

const STATUS_STYLES = {
  completed:        'bg-green-100 text-green-700',
  processing:       'bg-blue-100 text-blue-700',
  partially_failed: 'bg-orange-100 text-orange-700',
  draft:            'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  completed:        'Completed',
  processing:       'Processing',
  partially_failed: 'Partial',
  draft:            'Draft',
};

// ─── History ──────────────────────────────────────────────────────────────────

export default function History() {
  const { data: batches = [], isLoading, isError } = useQuery({
    queryKey: ['batches'],
    queryFn:  () => api.get('/api/transfers/batches').then((r) => r.data.batches || []),
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">History</h1>
          <p className="text-sm text-gray-500 mt-0.5">All your payment batches</p>
        </div>
        <Link
          to="/transfer"
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700
                     text-white text-sm font-semibold transition">
          + New Transfer
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent
                          rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Loading batches…</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5
                        text-sm text-red-600">
          Failed to load history. Please refresh the page.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && batches.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300
                        p-12 text-center">
          <p className="text-gray-400 text-sm">No batches yet.</p>
          <Link
            to="/transfer"
            className="mt-3 inline-block text-sm text-brand-600
                       font-medium hover:underline">
            Create your first transfer →
          </Link>
        </div>
      )}

      {/* Batches table */}
      {!isLoading && !isError && batches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Reference', 'Status', 'Recipients',
                  'Amount', 'Date', ''].map((h) => (
                  <th key={h}
                    className={`px-4 py-3 text-xs font-medium text-gray-500
                                ${h === 'Amount' || h === 'Recipients'
                                  ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batches.map((batch) => (
                <tr key={batch.id}
                  className="hover:bg-gray-50/60 transition-colors">

                  {/* Reference */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{batch.reference}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{batch.id}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                                     text-xs font-medium
                                     ${STATUS_STYLES[batch.status] ||
                                       'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[batch.status] || batch.status}
                    </span>
                  </td>

                  {/* Recipients */}
                  <td className="px-4 py-3 text-right text-gray-600">
                    {batch.total_recipients}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {fmt(batch.total_amount)}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-500">{fmtDate(batch.created_at)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtTime(batch.created_at)}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/history/${batch.id}`}
                      className="text-xs font-medium text-brand-600
                                 hover:text-brand-800 transition">
                      View →
                    </Link>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}