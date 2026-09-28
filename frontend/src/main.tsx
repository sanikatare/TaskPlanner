import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#FFFBFD',
            color: '#2A122B',
            border: '1px solid #EEDAE9',
            borderRadius: '14px',
            boxShadow: '0 6px 20px rgba(186, 45, 139, 0.12)',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 400,
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#BA2D8B', secondary: '#FFFBFD' } },
          error:   { iconTheme: { primary: '#e11d48', secondary: '#FFFBFD' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
