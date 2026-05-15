import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SenderVerify  from './pages/SenderVerify.jsx';
import Recipients    from './pages/Recipients.jsx';
import NameVerify    from './pages/NameVerify.jsx';
import Confirm       from './pages/Confirm.jsx';
import Processing    from './pages/Processing.jsx';
import History       from './pages/History.jsx';
import BatchDetail   from './pages/BatchDetail.jsx';
import Settings      from './pages/Settings.jsx';
import Layout        from './components/Layout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/sender" replace />} />

        {/* Main flow */}
        <Route element={<Layout />}>
          <Route path="/sender"     element={<SenderVerify />} />
          <Route path="/recipients" element={<Recipients />}   />
          <Route path="/verify"     element={<NameVerify />}   />
          <Route path="/confirm"    element={<Confirm />}      />
          <Route path="/processing" element={<Processing />}   />

          {/* History */}
          <Route path="/history"           element={<History />}      />
          <Route path="/history/:batchId"  element={<BatchDetail />}  />

          {/* Settings */}
          <Route path="/settings"   element={<Settings />}    />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/sender" replace />} />
      </Routes>
    </BrowserRouter>
  );
}