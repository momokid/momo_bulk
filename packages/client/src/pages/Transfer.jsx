// packages/client/src/pages/Transfer.jsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { useQuery }                    from '@tanstack/react-query';
import toast                           from 'react-hot-toast';
import api                             from '../services/api.js';
import { useAuth }                     from '../hooks/useAuth.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  `GHS ${Number(n || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const SCORE_STYLES = {
  STRONG:    'bg-green-100 text-green-700',
  LIKELY:    'bg-yellow-100 text-yellow-700',
  WEAK:      'bg-orange-100 text-orange-700',
  NO_MATCH:  'bg-red-100 text-red-700',
  NOT_FOUND: 'bg-red-100 text-red-700',
  EXCLUDED:  'bg-gray-100 text-gray-400',
  INVALID:   'bg-gray-100 text-gray-400',
  API_ERROR: 'bg-red-100 text-red-600',
};

const SCORE_LABELS = {
  STRONG:    'Strong',
  LIKELY:    'Likely',
  WEAK:      'Weak',
  NO_MATCH:  'No match',
  NOT_FOUND: 'Not found',
  EXCLUDED:  'Excluded',
  INVALID:   'Invalid',
  API_ERROR: 'Error',
};

// ─── ScoreBadge ───────────────────────────────────────────────────────────────

function ScoreBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                      ${SCORE_STYLES[status] || 'bg-gray-100 text-gray-400'}`}>
      {SCORE_LABELS[status] || status}
    </span>
  );
}

// ─── RecipientModal ───────────────────────────────────────────────────────────

function RecipientModal({ open, recipient, onSave, onClose }) {
  const [phone,  setPhone]  = useState('');
  const [name,   setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setPhone(recipient?.phone   || '');
      setName(recipient?.name    || '');
      setAmount(recipient?.amount || '');
      setErrors({});
    }
  }, [open, recipient]);

  const validate = () => {
    const errs = {};
    if (!/^0[0-9]{9}$/.test(phone.replace(/\s+/g, '')))
      errs.phone = 'Enter a valid 10-digit number starting with 0';
    if (!name.trim())
      errs.name = 'Full name is required';
    if (!amount || Number(amount) <= 0)
      errs.amount = 'Enter a valid amount greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ phone: phone.replace(/\s+/g, ''), name: name.trim(), amount: Number(amount) });
  };

  if (!open) return null;

  const field = (label, value, setter, key, type = 'text', extra = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setter(e.target.value)}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none
                    focus:ring-2 focus:ring-brand-500 focus:border-transparent transition
                    ${errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        {...extra}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          {recipient ? 'Edit Recipient' : 'Add Recipient'}
        </h3>
        <div className="space-y-4">
          {field('Mobile Number', phone, setPhone, 'phone', 'tel',
            { placeholder: '0XXXXXXXXX', autoFocus: true })}
          {field('Full Name', name, setName, 'name', 'text',
            { placeholder: 'As on MoMo account' })}
          {field('Amount (GHS)', amount, setAmount, 'amount', 'number',
            { placeholder: '0.00', min: '0.01', step: '0.01' })}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                       font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold transition">
            {recipient ? 'Save changes' : 'Add recipient'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PayModal ─────────────────────────────────────────────────────────────────

function PayModal({ open, mode, count, totalAmount, onConfirm, onClose }) {
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (open) { setPassword(''); setError(''); setIsLoading(false); }
  }, [open]);

  const handleConfirm = async () => {
    if (!password) { setError('Password is required'); return; }
    setIsLoading(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (err) {
      setError(err.message || 'Incorrect password. Please try again.');
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Confirm Payment</h3>
        <p className="text-sm text-gray-500 mb-4">
          {mode === 'all'
            ? `Sending ${fmt(totalAmount)} to ${count} recipient${count !== 1 ? 's' : ''}.`
            : `Sending ${fmt(totalAmount)} to 1 recipient.`}
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
          <p className="text-xs text-amber-700 font-medium">
            ⚠ This action is irreversible. Wrong transfers are your responsibility.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Enter your password to confirm
          </label>
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="••••••••"
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none
                        focus:ring-2 focus:ring-brand-500 focus:border-transparent
                        ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                       font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700
                       text-white text-sm font-semibold transition disabled:opacity-60
                       flex items-center justify-center gap-2">
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                               rounded-full animate-spin" />
            )}
            {isLoading ? 'Processing…' : 'Confirm & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export default function Transfer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  // ── Step ──────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Section 1 ─────────────────────────────────────────
  const [senderNumberId, setSenderNumberId] = useState('');
  const [reference,      setReference]      = useState('');

  // ── Section 2 ─────────────────────────────────────────
  const [recipients,    setRecipients]    = useState([]);
  const [hasExampleNums,setHasExampleNums]= useState(false);
  const [isVerifying,   setIsVerifying]   = useState(false);
  const [isVerified,    setIsVerified]    = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [isExecuting,   setIsExecuting]   = useState(false);

  // ── Modals ────────────────────────────────────────────
  const [recipientModal, setRecipientModal] = useState({ open: false, recipient: null });
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [payModal,       setPayModal]       = useState({ open: false, mode: 'all', targetId: null });

  // ── Queries ───────────────────────────────────────────

  // User's single disbursement account (auto-fetched, not selected)
  const { data: userAccount = null } = useQuery({
    queryKey: ['userAccount'],
    queryFn:  () => api.get('/api/accounts').then((r) => r.data.account),
  });

  const { data: senderNumbers = [] } = useQuery({
    queryKey: ['senderNumbers'],
    queryFn:  () => api.get('/api/sender-numbers').then((r) => r.data.senderNumbers || []),
  });

  // ── Derived ───────────────────────────────────────────
  const selectedSenderNumber = senderNumbers.find((s) => s.id === Number(senderNumberId));

  const eligible       = recipients.filter((r) =>
    !r.excluded && r.valid && ['STRONG', 'LIKELY', 'WEAK'].includes(r.matchStatus));
  const approvedCount  = recipients.filter((r) => r.matchStatus === 'STRONG').length;
  const reviewCount    = recipients.filter((r) => ['LIKELY', 'WEAK'].includes(r.matchStatus)).length;
  const eligibleAmount = eligible.reduce((s, r) => s + Number(r.amount), 0);

  const payTarget = recipients.find((r) => r._id === payModal.targetId);
  const payAmount = payModal.mode === 'all' ? eligibleAmount : (payTarget?.amount || 0);
  const payCount  = payModal.mode === 'all' ? eligible.length : 1;

  // ── Section 1: Continue ───────────────────────────────
  const handleContinue = () => {
    if (!userAccount)     { toast.error('Set up a disbursement account in Settings first.'); return; }
    if (!senderNumberId)  { toast.error('Select a sender number');   return; }
    if (!reference.trim()){ toast.error('Enter a batch reference');  return; }
    setStep(2);
  };

  // ── CSV upload ────────────────────────────────────────
  const handleCSVUpload = async (file) => {
    if (!file) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/api/recipients/parse-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const normalized = data.recipients.map((r) => ({
        ...r,
        _id:        crypto.randomUUID(),
        mtnName:    null,
        matchScore: null,
        matchStatus: r.excluded ? 'EXCLUDED' : null,
      }));

      setRecipients((prev) => [...prev, ...normalized]);
      if (data.hasExampleNumbers) setHasExampleNums(true);
      setIsVerified(false);

      toast.success(`${data.validCount} recipient${data.validCount !== 1 ? 's' : ''} loaded`);
      if (data.excludedCount > 0)
        toast(`${data.excludedCount} example row${data.excludedCount !== 1 ? 's' : ''} excluded`,
          { icon: '⚠️' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to parse CSV');
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Add recipient manually ────────────────────────────
  const handleAddRecipient = ({ phone, name, amount }) => {
    setRecipients((prev) => [
      ...prev,
      { _id: crypto.randomUUID(), phone, name, amount, errors: [],
        valid: true, excluded: false, excludeReason: null,
        mtnName: null, matchScore: null, matchStatus: null },
    ]);
    setRecipientModal({ open: false, recipient: null });
    setIsVerified(false);
    toast.success('Recipient added');
  };

  // ── Edit recipient ────────────────────────────────────
  const handleEditRecipient = ({ phone, name, amount }) => {
    setRecipients((prev) =>
      prev.map((r) =>
        r._id === recipientModal.recipient._id
          ? { ...r, phone, name, amount,
              mtnName: null, matchScore: null, matchStatus: null }
          : r,
      ),
    );
    setRecipientModal({ open: false, recipient: null });
    setIsVerified(false);
    toast.success('Recipient updated');
  };

  // ── Delete recipient ──────────────────────────────────
  const handleDeleteConfirm = () => {
    setRecipients((prev) => prev.filter((r) => r._id !== deleteTarget));
    setDeleteTarget(null);
    setIsVerified(false);
    toast.success('Recipient removed');
  };

  // ── Verify names ──────────────────────────────────────
  const handleVerifyNames = async () => {
    const toVerify = recipients.filter((r) => !r.excluded);
    if (toVerify.length === 0) { toast.error('No recipients to verify'); return; }

    setIsVerifying(true);
    try {
      const { data } = await api.post('/api/recipients/verify-names', {
        recipients: toVerify.map((r) => ({
          phone: r.phone, name: r.name, amount: r.amount,
          valid: r.valid, excluded: r.excluded, errors: r.errors || [],
        })),
        // accountId removed — backend auto-fetches from user's account
      });

      const resultMap = new Map(toVerify.map((r, i) => [r._id, data.recipients[i]]));

      setRecipients((prev) =>
        prev.map((r) => {
          if (r.excluded) return r;
          const res = resultMap.get(r._id);
          if (!res) return r;
          return { ...r, mtnName: res.mtnName,
            matchScore: res.matchScore, matchStatus: res.matchStatus };
        }),
      );
      setIsVerified(true);
      toast.success('Name verification complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Password verification + batch execution ───────────
  const executeTransfer = async (password, recipientsToSend) => {
    try {
      await api.post('/api/auth/login', { email: user.email, password });
    } catch {
      throw new Error('Incorrect password. Please try again.');
    }

    const { data: batchData } = await api.post('/api/transfers/batch', {
      senderNumberId: selectedSenderNumber.id,
      reference:      reference.trim(),
      senderNumber:   selectedSenderNumber.phone_number,
      senderName:     selectedSenderNumber.mtn_name,
      momoAccountId:  userAccount.id,   // auto-fetched, not user-selected
      recipients:     recipientsToSend,
    });

    const batchId = batchData.batch.id;
    await api.post(`/api/transfers/batch/${batchId}/execute`);
    return batchId;
  };

  const handlePayAll = async (password) => {
    setIsExecuting(true);
    try {
      const batchId = await executeTransfer(
        password,
        eligible.map((r) => ({
          phone: r.phone, name: r.name, amount: r.amount,
          valid: r.valid, matchStatus: r.matchStatus,
          mtnName: r.mtnName, matchScore: r.matchScore,
        })),
      );
      setPayModal({ open: false, mode: 'all', targetId: null });
      toast.success('Batch sent successfully!');
      navigate(`/history/${batchId}`);
    } catch (err) {
      setIsExecuting(false);
      throw err;
    }
  };

  const handlePaySingle = async (password) => {
    const r = payTarget;
    if (!r) return;
    setIsExecuting(true);
    try {
      const batchId = await executeTransfer(password, [{
        phone: r.phone, name: r.name, amount: r.amount,
        valid: r.valid, matchStatus: r.matchStatus,
        mtnName: r.mtnName, matchScore: r.matchScore,
      }]);
      setPayModal({ open: false, mode: 'single', targetId: null });
      toast.success('Transfer sent!');
      navigate(`/history/${batchId}`);
    } catch (err) {
      setIsExecuting(false);
      throw err;
    }
  };

  // ── Step bubble ───────────────────────────────────────
  const Bubble = ({ n, done }) => (
    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center
                      font-bold shrink-0
                      ${done ? 'bg-green-500 text-white' : 'bg-brand-600 text-white'}`}>
      {done ? '✓' : n}
    </span>
  );

  // ─────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">New Transfer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send bulk payments via MTN MoMo</p>
        </div>

        {/* ── Section 1: Batch Setup ─────────────────── */}
        <div className={`bg-white rounded-xl border p-6
                         ${step > 1 ? 'border-green-200' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Bubble n={1} done={step > 1} /> Batch Setup
            </h2>
            {step > 1 && (
              <button onClick={() => setStep(1)}
                className="text-xs text-brand-600 hover:underline">Edit</button>
            )}
          </div>

          {step === 1 ? (
            <div className="space-y-4">

              {/* No account warning */}
              {!userAccount && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200
                                rounded-lg px-4 py-3">
                  <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      No disbursement account found
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Set up your MTN MoMo disbursement account before sending payments.
                    </p>
                    <a href="/settings"
                      className="text-xs font-semibold text-amber-700 underline mt-1 inline-block">
                      Go to Settings →
                    </a>
                  </div>
                </div>
              )}

              {/* Sender number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sender Number
                </label>
                <select value={senderNumberId}
                  onChange={(e) => setSenderNumberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300
                             text-sm focus:outline-none focus:ring-2
                             focus:ring-brand-500 bg-white">
                  <option value="">Select sender…</option>
                  {senderNumbers.filter((s) => s.is_active).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.phone_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Batch Reference
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                  placeholder="e.g. May 2025 Salary, Week 3 Allowance…"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300
                             text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button onClick={handleContinue} disabled={!userAccount}
                className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700
                           text-white text-sm font-semibold transition
                           disabled:opacity-50 disabled:cursor-not-allowed">
                Continue →
              </button>
            </div>
          ) : (
            // Collapsed summary
            <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="text-gray-400">Account: </span>
                {userAccount?.label} ({userAccount?.account_number})
              </span>
              <span>
                <span className="text-gray-400">Sender: </span>
                {selectedSenderNumber?.phone_number} ({selectedSenderNumber?.mtn_name})
              </span>
              <span>
                <span className="text-gray-400">Ref: </span>
                {reference}
              </span>
            </div>
          )}
        </div>

        {/* ── Section 2: Recipients ──────────────────── */}
        {step === 2 && (
          <div className="space-y-4">

            {/* Section header */}
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Bubble n={2} done={false} />
                Recipients
                {recipients.length > 0 && (
                  <span className="text-gray-400 font-normal">({recipients.length})</span>
                )}
              </h2>

              <div className="flex flex-wrap gap-2 ml-auto">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadLoading}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs
                             font-medium text-gray-700 hover:bg-gray-50 transition
                             disabled:opacity-60">
                  {uploadLoading ? 'Uploading…' : '↑ Upload CSV'}
                </button>

                <button
                  onClick={() => setRecipientModal({ open: true, recipient: null })}
                  className="px-3 py-1.5 rounded-lg border border-brand-300 text-xs
                             font-medium text-brand-700 hover:bg-brand-50 transition">
                  + Add Recipient
                </button>

                {recipients.length > 0 && (
                  <button
                    onClick={() => {
                      setRecipients([]);
                      setHasExampleNums(false);
                      setIsVerified(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                               text-red-500 hover:bg-red-50 transition">
                    Clear All
                  </button>
                )}
              </div>

              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => {
                  handleCSVUpload(e.target.files?.[0]);
                  e.target.value = '';
                }} />
            </div>

            {/* Example numbers warning */}
            {hasExampleNums && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200
                              rounded-lg px-4 py-3">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <p className="text-sm text-amber-700">
                  <strong>Example rows excluded</strong> — template phone numbers detected
                  and will not be sent.
                </p>
              </div>
            )}

            {/* Empty state */}
            {recipients.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300
                              p-12 text-center">
                <p className="text-gray-400 text-sm">No recipients yet.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Upload a CSV or add recipients manually.
                </p>
              </div>
            )}

            {/* Validation errors summary */}
            {recipients.some((r) => r.errors?.length > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg
                              px-4 py-3 space-y-0.5">
                <p className="text-xs font-semibold text-red-700 mb-1">Rows with errors:</p>
                {recipients
                  .filter((r) => r.errors?.length > 0)
                  .flatMap((r) => r.errors)
                  .map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
              </div>
            )}

            {/* Recipients table */}
            {recipients.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['#', 'Mobile Number', 'Your Name', 'MTN Name', 'Score',
                        'Amount (GHS)', 'Actions'].map((h) => (
                        <th key={h}
                          className={`px-4 py-3 text-xs font-medium text-gray-500
                                      ${h === 'Amount (GHS)' || h === 'Actions'
                                        ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recipients.map((r, i) => {
                      const excluded = r.excluded;
                      const invalid  = !r.valid && !r.excluded;
                      const canPay   = isVerified &&
                        ['STRONG', 'LIKELY', 'WEAK'].includes(r.matchStatus);

                      return (
                        <tr key={r._id}
                          className={`transition-colors ${excluded
                            ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50/60'}`}>
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {r.phone}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{r.name}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {r.mtnName || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {excluded
                              ? <ScoreBadge status="EXCLUDED" />
                              : invalid
                                ? <ScoreBadge status="INVALID" />
                                : <ScoreBadge status={r.matchStatus} />}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">
                            {fmt(r.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3">
                              {!excluded && (
                                <button
                                  onClick={() =>
                                    setRecipientModal({ open: true, recipient: r })}
                                  className="text-xs text-gray-500 hover:text-brand-600
                                             transition">
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteTarget(r._id)}
                                className="text-xs text-gray-500 hover:text-red-600
                                           transition">
                                Delete
                              </button>
                              {canPay && (
                                <button
                                  onClick={() =>
                                    setPayModal({ open: true, mode: 'single',
                                      targetId: r._id })}
                                  className="text-xs font-semibold text-brand-600
                                             hover:text-brand-800 transition">
                                  Pay
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Verify Names */}
            {recipients.length > 0 && (
              <div className="flex justify-end">
                <button onClick={handleVerifyNames} disabled={isVerifying}
                  className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900
                             text-white text-sm font-medium transition disabled:opacity-60
                             flex items-center gap-2">
                  {isVerifying && (
                    <span className="w-4 h-4 border-2 border-white
                                     border-t-transparent rounded-full animate-spin" />
                  )}
                  {isVerifying ? 'Verifying…' : '✓ Verify Names'}
                </button>
              </div>
            )}

            {/* Summary + Pay All */}
            {isVerified && eligible.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-600 mb-4">
                  Ready to pay:{' '}
                  <span className="font-semibold text-green-700">
                    {approvedCount} approved
                  </span>
                  {reviewCount > 0 && (
                    <>
                      {' '}|{' '}
                      <span className="font-semibold text-yellow-700">
                        {reviewCount} needs review
                      </span>
                    </>
                  )}
                  {' '}|{' '}
                  <span className="font-semibold text-gray-800">
                    {fmt(eligibleAmount)} total
                  </span>
                </p>
                <button
                  onClick={() => setPayModal({ open: true, mode: 'all', targetId: null })}
                  disabled={isExecuting}
                  className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700
                             text-white font-semibold text-sm transition disabled:opacity-60
                             flex items-center justify-center gap-2">
                  {isExecuting && (
                    <span className="w-4 h-4 border-2 border-white
                                     border-t-transparent rounded-full animate-spin" />
                  )}
                  Pay All — {fmt(eligibleAmount)}
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────── */}

      <RecipientModal
        open={recipientModal.open}
        recipient={recipientModal.recipient}
        onSave={recipientModal.recipient ? handleEditRecipient : handleAddRecipient}
        onClose={() => setRecipientModal({ open: false, recipient: null })}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">
              Remove this recipient?
            </p>
            <p className="text-xs text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm
                           font-medium text-gray-700 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700
                           text-white text-sm font-semibold transition">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <PayModal
        open={payModal.open}
        mode={payModal.mode}
        count={payCount}
        totalAmount={payAmount}
        onConfirm={payModal.mode === 'all' ? handlePayAll : handlePaySingle}
        onClose={() => setPayModal({ open: false, mode: 'all', targetId: null })}
      />
    </>
  );
}