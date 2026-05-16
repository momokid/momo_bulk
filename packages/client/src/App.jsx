import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute  from './components/ProtectedRoute.jsx';
import Layout          from './components/Layout.jsx';
import Login           from './pages/Login.jsx';
import Register        from './pages/Register.jsx';
import Transfer        from './pages/Transfer.jsx';
import History         from './pages/History.jsx';
import BatchDetail     from './pages/BatchDetail.jsx';
import Settings        from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<Login />}    />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/"        element={<Navigate to="/transfer" replace />} />
            <Route path="/transfer" element={<Transfer />}  />
            <Route path="/history"  element={<History />}   />
            <Route path="/history/:batchId" element={<BatchDetail />} />
            <Route path="/settings" element={<Settings />}  />
          </Route>
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}