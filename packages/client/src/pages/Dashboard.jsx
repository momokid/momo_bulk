// packages/client/src/pages/Dashboard.jsx

import { useQuery }    from '@tanstack/react-query';
import { Link }        from 'react-router-dom';
import { useAuth }     from '../hooks/useAuth.jsx';
import api             from '../services/api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount) =>
  `GHS ${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-GH', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['batches'],
    queryFn:  async () => {
      const { data } = await api.get('/api/transfers/batches');
      return data.batches || [];
    },
  });

  const batches = data || [];

  // ── Computed stats ─────────────────────────────────
  const totalBatches    = batches.length;
  const totalAmount     = batches.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalRecipients = batches.reduce((s, b) => s + Number(b.total_recipients || 0), 0);
  const completedCount  = batches.filter((b) =>
    b.status === 'completed' || b.status === 'partially_failed'
  ).length;

  const recentBatches = [...batches].slice(0, 5);

  return (
    <div className="space-y-8">

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, {user?.email}
          </p>
        </div>
        <Link
          to="/transfer"
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700
                     text-white text-sm font-semibold transition"
        >
          + New Transfer
        </Link>
      </div>

      {/* ── Stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Batches"
          value={totalBatches}
          sub={`${completedCount} executed`}
        />
        <StatCard
          label="Total Disbursed"
          value={fmt(totalAmount)}
        />
        <StatCard
          label="Total Recipients"
          value={totalRecipients.toLocaleString()}
        />
        <StatCard
          label="Active Account"
          value={totalBatches > 0 ? '✓' : '—'}
          sub="MTN MoMo"
        />
      </div>

      {/* ── Recent Batches ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Batches</h2>
          {batches.length > 5 && (
            <Link to="/history" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          )}
        </div>

        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent
                            rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 mt-3">Loading batches…</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">
            Failed to load batches. Please refresh the page.
          </div>
        )}

        {!isLoading && !isError && batches.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 border-dashed
                          p-10 text-center">
            <p className="text-gray-400 text-sm">No batches yet.</p>
            <Link
              to="/transfer"
              className="mt-3 inline-block text-sm text-brand-600 font-medium hover:underline"
            >
              Create your first transfer →
            </Link>
          </div>
        )}

        {!isLoading && !isError && recentBatches.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                    Recipients
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                    Amount
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {batch.reference}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                                       text-xs font-medium ${STATUS_STYLES[batch.status]}`}>
                        {STATUS_LABELS[batch.status] || batch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {batch.total_recipients}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">
                      {fmt(batch.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {fmtDate(batch.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/history/${batch.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}