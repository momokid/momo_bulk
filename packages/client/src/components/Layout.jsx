import { Outlet, NavLink, useLocation } from 'react-router-dom';

const FLOW_STEPS = [
  { path: '/sender',     label: 'Sender'     },
  { path: '/recipients', label: 'Recipients' },
  { path: '/verify',     label: 'Verify'     },
  { path: '/confirm',    label: 'Confirm'    },
  { path: '/processing', label: 'Processing' },
];

const FLOW_PATHS = FLOW_STEPS.map((s) => s.path);

export default function Layout() {
  const location = useLocation();
  const isFlowPage = FLOW_PATHS.includes(location.pathname);
  const currentStep = FLOW_PATHS.indexOf(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Navigation ───────────────────────── */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

          {/* Logo */}
          <NavLink to="/sender" className="font-bold text-brand-700 text-lg tracking-tight">
            MoMo<span className="text-gray-400 font-normal">Bulk</span>
          </NavLink>

          {/* Right nav */}
          <div className="flex items-center gap-6">
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              History
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              Settings
            </NavLink>
          </div>
        </div>
      </nav>

      {/* ── Flow Progress Bar ─────────────────────── */}
      {isFlowPage && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center gap-1">
              {FLOW_STEPS.map((step, index) => {
                const isDone    = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.path} className="flex items-center gap-1">
                    {/* Step bubble */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isCurrent
                        ? 'bg-brand-600 text-white'
                        : isDone
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                      {step.label}
                    </div>

                    {/* Connector */}
                    {index < FLOW_STEPS.length - 1 && (
                      <div className={`h-px w-4 ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Page Content ─────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>

    </div>
  );
}