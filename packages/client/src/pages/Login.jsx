// packages/client/src/pages/Login.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">

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
          Sign in to your account
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
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-brand-500 focus:border-transparent transition"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700
                       text-white text-sm font-semibold transition disabled:opacity-60
                       disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent
                               rounded-full animate-spin" />
            )}
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

        </form>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-brand-600 font-medium hover:underline"
          >
            Create one
          </Link>
        </p>

      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 mt-8 text-center">
        Your funds are processed via Official MTN MoMo Platforms.
      </p>

    </div>
  );
}
