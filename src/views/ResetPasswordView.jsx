import React, { useState } from 'react';
import { Lock, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { request } from '../api/client';

export default function ResetPasswordView({ uid, token, onSuccess, onCancel }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // Warm up CSRF token
      await request('/api/csrf/');

      const res = await request('/api/auth/reset-password/', {
        method: 'POST',
        body: JSON.stringify({ uid, token, password }),
      });

      if (res.status === 'success') {
        setSuccess(res.message || 'Your password has been successfully reset.');
      } else {
        setError(res.message || 'Failed to reset password.');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.glassCard} className="animate-fade">
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <Lock size={32} color="var(--color-primary)" />
          </div>
          <h1 style={styles.title}>Reset Password</h1>
          <p style={styles.subtitle}>Enter your new password below</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={18} style={{ marginRight: '8px', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={styles.successContainer}>
            <div style={styles.successIconWrapper}>
              <CheckCircle size={48} color="var(--color-success)" />
            </div>
            <p style={styles.successText}>{success}</p>
            <button onClick={onSuccess} style={styles.backBtn}>
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>New Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type="password"
                  placeholder="At least 12 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={18} style={styles.inputIcon} />
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                ...styles.submitBtn,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader size={20} className="animate-spin" style={styles.spinner} />
              ) : (
                'Reset Password'
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              style={styles.cancelBtn}
              disabled={loading}
            >
              Cancel
            </button>
          </form>
        )}

        <div style={styles.footer}>
          <p>Dovecot IMAP • Postfix SMTP • PostgreSQL</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-secondary)',
    backgroundImage: 'radial-gradient(circle at 50% -20%, #e8f0fe, transparent 75%)',
  },
  glassCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '2.5rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logoContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-primary-soft)',
    marginBottom: '1rem',
    border: '1px solid rgba(26, 115, 232, 0.2)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--color-danger-soft)',
    color: 'var(--color-danger)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
    border: '1px solid rgba(244, 63, 94, 0.2)',
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    margin: '1rem 0',
  },
  successIconWrapper: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-success-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  successText: {
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 40px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    fontWeight: '600',
    marginTop: '0.5rem',
    boxShadow: '0 2px 4px rgba(26, 115, 232, 0.2)',
    border: 'none',
    transition: 'background-color var(--transition-fast)',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    fontWeight: '600',
    border: '1px solid var(--glass-border)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast), color var(--transition-fast)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(26, 115, 232, 0.2)',
    transition: 'background-color var(--transition-fast)',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  footer: {
    marginTop: '2rem',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--glass-border)',
    paddingTop: '1.25rem',
  },
};
