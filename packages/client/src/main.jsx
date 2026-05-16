import React        from 'react';
import ReactDOM     from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster }  from 'react-hot-toast';
import App          from './App.jsx';
import './index.css';
import { AuthProvider } from './hooks/useAuth.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:              1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            fontSize:     '14px',
          },
          success: { style: { background: '#f0fdf4', color: '#166534' } },
          error:   { style: { background: '#fef2f2', color: '#991b1b' } },
        }}
      />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
