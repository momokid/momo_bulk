// packages/client/src/pages/Settings.jsx

import { useState }                      from 'react';
import { useQuery, useQueryClient }      from '@tanstack/react-query';
import toast                             from 'react-hot-toast';
import api                               from '../services/api.js';

// ─── AddSenderModal ───────────────────────────────────────────────────────────

function AddSenderModal({ open, onClose, onAdded }) {
  const [phone,     setPhone]     = useState('');
  const [label,     setLabel]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const errs = {};
    if (!/^0[0-9]{9}$/.test(phone.replace(/\s+/g, '')))
      errs.phone = 'Enter a valid 10-digit number starting with 0';
    if (!label.trim())
      errs.label = 'Label is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/sender-numbers', {
        phoneNumber: phone.replace(/\s+/g, ''),
        label:       label.trim(),
      });
      toast.success(`${data.senderNumber.mtn_name} added successfully`);
      setPhone(''); setLabel(''); setErrors({});
      onAdded();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add number';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Add Sender Number</h3>
        <p className="text-xs text-gray-500 mb-4">
          The name will be verified with MTN and stored permanently.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mobile Number
            </label>
            <input
              type="tel"
              value={phone}
              autoFocus
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0XXXXXXXXX"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm
                          focus:outline-none focus:ring-2 focus:ring-brand-500
                          ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Main Agent, Business Number…"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm
                          focus:outline-none focus:ring-2 focus:ring-brand-500
                          ${errors.label ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                       font-medium text-gray-700 hover:bg-gray-50 transition
                       disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold transition disabled:opacity-60
                       flex items-center justify-center gap-2">
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                               rounded-full animate-spin" />
            )}
            {isLoading ? 'Verifying with MTN…' : 'Add Number'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditLabelModal ───────────────────────────────────────────────────────────

function EditLabelModal({ open, currentLabel, onSave, onClose }) {
  const [label,     setLabel]     = useState(currentLabel || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) { toast.error('Label is required'); return; }
    setIsLoading(true);
    try {
      await onSave(label.trim());
      onClose();
    } catch {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Edit Label</h3>
        <input
          type="text"
          value={label}
          autoFocus
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} disabled={isLoading}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-sm
                       font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold transition disabled:opacity-60">
            {isLoading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const qc = useQueryClient();

  // ── Disbursement account form state ───────────────────
  const [acctLabel,  setAcctLabel]  = useState('');
  const [acctNumber, setAcctNumber] = useState('');
  const [acctEnv,    setAcctEnv]    = useState('sandbox');
  const [acctLoading,setAcctLoading]= useState(false);

  // ── Sender numbers UI state ───────────────────────────
  const [addSenderOpen,  setAddSenderOpen]  = useState(false);
  const [editLabel,      setEditLabel]      = useState({ open: false, id: null, current: '' });
  const [deleteConfirm,  setDeleteConfirm]  = useState(null); // sender number id

  // ── Queries ───────────────────────────────────────────
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['userAccount'],
    queryFn:  () => api.get('/api/accounts').then((r) => r.data.account),
  });

  const { data: senderNumbers = [], isLoading: numbersLoading } = useQuery({
    queryKey: ['senderNumbers'],
    queryFn:  () => api.get('/api/sender-numbers').then((r) => r.data.senderNumbers || []),
  });

  // ── Disbursement account handlers ─────────────────────

  const handleCreateAccount = async () => {
    if (!acctLabel.trim())  { toast.error('Label is required');          return; }
    if (!acctNumber.trim()) { toast.error('Account number is required'); return; }

    const cleaned = acctNumber.replace(/\s+/g, '');
    if (!/^0[0-9]{9}$/.test(cleaned)) {
      toast.error('Enter a valid 10-digit MoMo number starting with 0');
      return;
    }

    setAcctLoading(true);
    try {
      await api.post('/api/accounts', {
        label:         acctLabel.trim(),
        accountNumber: cleaned,
        environment:   acctEnv,
      });
      toast.success('Disbursement account created successfully');
      setAcctLabel(''); setAcctNumber(''); setAcctEnv('sandbox');
      qc.invalidateQueries({ queryKey: ['userAccount'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create account');
    } finally {
      setAcctLoading(false);
    }
  };

  const handleToggleAccount = async () => {
    if (!account) return;
    try {
      await api.patch(`/api/accounts/${account.id}/toggle`);
      toast.success(`Account ${account.is_active ? 'deactivated' : 'activated'}`);
      qc.invalidateQueries({ queryKey: ['userAccount'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update account');
    }
  };

  const handleDeleteAccount = async () => {
    if (!account) return;
    try {
      await api.delete(`/api/accounts/${account.id}`);
      toast.success('Account deleted');
      qc.invalidateQueries({ queryKey: ['userAccount'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    }
  };

  const handleUpdateAccountLabel = async (label) => {
    try {
      await api.patch(`/api/accounts/${account.id}/label`, { label });
      toast.success('Label updated');
      qc.invalidateQueries({ queryKey: ['userAccount'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update label');
      throw err;
    }
  };

  // ── Sender number handlers ────────────────────────────

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/api/sender-numbers/${id}/default`);
      toast.success('Default number updated');
      qc.invalidateQueries({ queryKey: ['senderNumbers'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update default');
    }
  };

  const handleToggleSender = async (id, isActive) => {
    try {
      await api.patch(`/api/sender-numbers/${id}/toggle`);
      toast.success(`Number ${isActive ? 'deactivated' : 'activated'}`);
      qc.invalidateQueries({ queryKey: ['senderNumbers'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleUpdateSenderLabel = async (label) => {
    try {
      await api.patch(`/api/sender-numbers/${editLabel.id}/label`, { label });
      toast.success('Label updated');
      qc.invalidateQueries({ queryKey: ['senderNumbers'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update label');
      throw err;
    }
  };

  const handleDeleteSender = async (id) => {
    try {
      await api.delete(`/api/sender-numbers/${id}`);
      toast.success('Number deleted');
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ['senderNumbers'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete number');
      setDeleteConfirm(null);
    }
  };

  // ─────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your disbursement account and sender numbers
          </p>
        </div>

        {/* ── Section 1: Disbursement Account ────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Disbursement Account
          </h2>

          {accountLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent
                               rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {!accountLoading && !account && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                No disbursement account set up yet. Add your MTN MoMo agent account
                below to start sending payments.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Label
                  </label>
                  <input
                    type="text"
                    value={acctLabel}
                    onChange={(e) => setAcctLabel(e.target.value)}
                    placeholder="e.g. Main Agent Account"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300
                               text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="tel"
                    value={acctNumber}
                    onChange={(e) => setAcctNumber(e.target.value)}
                    placeholder="0XXXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300
                               text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Environment
                </label>
                <select
                  value={acctEnv}
                  onChange={(e) => setAcctEnv(e.target.value)}
                  className="w-full sm:w-48 px-3.5 py-2.5 rounded-lg border border-gray-300
                             text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="sandbox">Sandbox (testing)</option>
                  <option value="production">Production (live)</option>
                </select>
              </div>

              <button
                onClick={handleCreateAccount}
                disabled={acctLoading}
                className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700
                           text-white text-sm font-semibold transition disabled:opacity-60
                           flex items-center gap-2">
                {acctLoading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent
                                   rounded-full animate-spin" />
                )}
                {acctLoading ? 'Provisioning with MTN…' : 'Create Account'}
              </button>
            </div>
          )}

          {!accountLoading && account && (
            <div className="space-y-4">
              {/* Account details */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-gray-800">
                      {account.label}
                    </p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                                     ${account.is_active
                                       ? 'bg-green-100 text-green-700'
                                       : 'bg-gray-100 text-gray-500'}`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs
                                     bg-blue-50 text-blue-600 font-medium capitalize">
                      {account.environment}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 font-mono">{account.account_number}</p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditLabel({
                      open: true, id: account.id, current: account.label, type: 'account'
                    })}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs
                               font-medium text-gray-700 hover:bg-gray-50 transition">
                    Edit Label
                  </button>
                  <button
                    onClick={handleToggleAccount}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs
                               font-medium text-gray-700 hover:bg-gray-50 transition">
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                               text-red-500 hover:bg-red-50 transition">
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                MTN API credentials are encrypted and stored securely. They cannot be
                viewed after provisioning.
              </p>
            </div>
          )}
        </div>

        {/* ── Section 2: Sender Numbers ───────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Sender Numbers</h2>
            <button
              onClick={() => setAddSenderOpen(true)}
              disabled={!account}
              title={!account ? 'Set up a disbursement account first' : ''}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700
                         text-white text-xs font-semibold transition disabled:opacity-50
                         disabled:cursor-not-allowed">
              + Add Number
            </button>
          </div>

          {!account && (
            <p className="text-sm text-gray-400">
              Set up a disbursement account first before adding sender numbers.
            </p>
          )}

          {account && numbersLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent
                               rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {account && !numbersLoading && senderNumbers.length === 0 && (
            <p className="text-sm text-gray-400">
              No sender numbers added yet. Click "+ Add Number" to get started.
            </p>
          )}

          {account && !numbersLoading && senderNumbers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">
                      Number
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">
                      Label
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">
                      MTN Name
                    </th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-right pb-2 text-xs font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {senderNumbers.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 font-mono text-xs text-gray-700">
                        {n.phone_number}
                      </td>
                      <td className="py-3 text-gray-700">
                        <span className="flex items-center gap-1.5">
                          {n.label}
                          {n.is_default === 1 && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-xs
                                             bg-brand-100 text-brand-700 font-medium">
                              Default
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 text-sm">{n.mtn_name}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs
                                         font-medium
                                         ${n.is_active
                                           ? 'bg-green-100 text-green-700'
                                           : 'bg-gray-100 text-gray-500'}`}>
                          {n.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-3">
                          {!n.is_default && (
                            <button
                              onClick={() => handleSetDefault(n.id)}
                              className="text-xs text-gray-500 hover:text-brand-600
                                         transition">
                              Set Default
                            </button>
                          )}
                          <button
                            onClick={() => setEditLabel({
                              open: true, id: n.id,
                              current: n.label, type: 'sender'
                            })}
                            className="text-xs text-gray-500 hover:text-brand-600
                                       transition">
                            Edit Label
                          </button>
                          <button
                            onClick={() => handleToggleSender(n.id, n.is_active)}
                            className="text-xs text-gray-500 hover:text-gray-800
                                       transition">
                            {n.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(n.id)}
                            className="text-xs text-red-400 hover:text-red-600
                                       transition">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ────────────────────────────────────── */}

      <AddSenderModal
        open={addSenderOpen}
        onClose={() => setAddSenderOpen(false)}
        onAdded={() => qc.invalidateQueries({ queryKey: ['senderNumbers'] })}
      />

      <EditLabelModal
        open={editLabel.open}
        currentLabel={editLabel.current}
        onSave={editLabel.type === 'account'
          ? handleUpdateAccountLabel
          : handleUpdateSenderLabel}
        onClose={() => setEditLabel({ open: false, id: null, current: '', type: '' })}
      />

      {/* Delete sender number confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">Delete this number?</p>
            <p className="text-xs text-gray-400 mb-5">
              Numbers used in batches cannot be deleted — deactivate instead.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                           font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={() => handleDeleteSender(deleteConfirm)}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700
                           text-white text-sm font-semibold transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}