import React, { useState, useCallback } from 'react';
import { useApiKey } from '../context/ApiKeyContext';

const ApiKeySetup: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const { saveKey } = useApiKey();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      saveKey(inputValue.trim());
    }
  }, [inputValue, saveKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '60px 40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '-1.5px', color: '#111' }}>
          JUMPSHOT AI
        </h1>
        <p style={{ fontSize: '15px', marginBottom: '48px', color: '#6b7280', fontWeight: '500' }}>
          Enter your API key to access site.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <input
            type="password"
            placeholder="API Key"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary-gradient"
            style={{ padding: '16px', fontSize: '14px', borderRadius: '14px' }}
            disabled={!inputValue.trim()}
          >
            ACCESS SITE
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApiKeySetup;