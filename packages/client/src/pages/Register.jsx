import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import toast from 'react-hot-toast';

// ─── Inline T&C summary ───────────────────────────────────────────────────────
const TERMS = [
  'You are responsible for verifying recipient details before sending.',
  'Wrong transfers are not reversible — double-check all numbers and amounts.',
  'Your MTN API credentials are encrypted and stored securely.',
  'We do not store your MTN PIN — payments are processed via MTN\'s Disbursements API using your agent wallet.',
  'This platform is for authorised bulk disbursements only.',
  'We store transaction records for audit and reporting purposes.',
];

export default function Register() {
  const { register } = useAuth();
  const navigate      = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [showTerms,    setShowTerms]    = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (!termsChecked) {
      toast.error('You must accept the Terms & Conditions to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-700 tracking-tight">
          MoMo<span className="text-gray-400 font-normal">Bulk</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">Bulk disbursements, simplified</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Create your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
              <span className="text-gray-400 font-normal ml-1">(min. 8 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm
                          placeholder:text-gray-400 focus:outline-none focus:ring-2
                          focus:ring-brand-500 focus:border-transparent transition
                          ${confirm && confirm !== password
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-300'}`}
            />
            {confirm && confirm !== password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Terms & Conditions */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5">

            {/* Toggle to read terms */}
            <button
              type="button"
              onClick={() => setShowTerms((v) => !v)}
              className="text-xs text-brand-600 font-medium hover:underline mb-2 flex items-center gap-1"
            >
              <span>{showTerms ? '▾' : '▸'}</span>
              {showTerms ? 'Hide' : 'Read'} Terms & Conditions
            </button>

            {showTerms && (
              <ul className="text-xs text-gray-600 space-y-1.5 mb-3 pl-1">
                {TERMS.map((term, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-400 shrink-0">•</span>
                    {term}
                  </li>
                ))}
              </ul>
            )}

            {/* Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-0.5 accent-brand-600 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                I have read and agree to the{' '}
                <strong className="font-medium">Terms & Conditions</strong>{' '}
                (v1.0). I understand that wrong transfers are my responsibility.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !termsChecked}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold transition disabled:opacity-60
                       disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                               rounded-full animate-spin" />
            )}
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>

        </form>

        {/* Login link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>

      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Your funds are processed via MTN MoMo Disbursements API.
      </p>

    </div>
  );
}