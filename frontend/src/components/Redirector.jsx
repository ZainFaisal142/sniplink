import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { recordClickAndGetUrl } from '../services/apiService';

export default function Redirector() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Redirecting...');

  useEffect(() => {
    if (!code) {
      navigate('/404', { replace: true });
      return;
    }

    const destination = recordClickAndGetUrl(code);
    if (destination) {
      setStatus(`Redirecting you to ${destination}...`);
      window.location.replace(destination);
    } else {
      navigate('/404', { replace: true });
    }
  }, [code, navigate]);

  return (
    <div className="notfound-page fade-in">
      <div className="loader-spinner" style={{ marginBottom: '24px' }}></div>
      <h2>{status}</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Hold tight, we're securely taking you to your destination.
      </p>
    </div>
  );
}
