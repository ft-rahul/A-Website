import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { App } from './App';
import './styles/index.css';

// Re-mount the app whenever the signed-in user changes, so every account
// starts from its own saved enrolments, cart and progress.
const Root = () => {
  const { user, status } = useAuth();
  // Wait for the session check so signed-in learners never see the guest view first.
  if (status === 'loading') return <div className="page-loading" role="status" aria-label="Loading" />;
  return (
    <AppProvider key={user?.id || 'guest'}>
      <App />
    </AppProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
);
