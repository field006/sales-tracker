import { useState } from 'react'
import { ReceiptText, Lock } from 'lucide-react'

export default function AuthView({ onLogin, error }) {
    const defaultApiUrl = localStorage.getItem('invoice-api-url') || import.meta.env.VITE_API_URL || '';
    const [apiUrl, setApiUrl] = useState(defaultApiUrl)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        onLogin(apiUrl, username, password)
    }

    return (
        <div className="auth-layout">
            {/* Left Brand Side */}
            <div className="auth-brand">
                <div className="auth-brand-content">
                    <div className="hero-icon">
                        <ReceiptText size={48} strokeWidth={1.5} />
                    </div>
                    <h1 className="hero-title">Receipt<br />Recorder.</h1>
                    <p className="hero-subtitle">
                        Editorial precision for your financial footprint. Track, analyze, and master your expenses with zero friction.
                    </p>
                </div>
                <div className="auth-brand-pattern"></div>
            </div>

            {/* Right Form Side */}
            <div className="auth-form-side">
                <div className="auth-form-container">
                    <div className="auth-form-header">
                        <h2>System Access</h2>
                        <p>Authenticate to securely enter your workspace.</p>
                    </div>

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Server URL
                            </label>
                            <input
                                type="url"
                                className="input-editorial"
                                required
                                value={apiUrl}
                                onChange={e => setApiUrl(e.target.value)}
                                placeholder="https://api.example.com"
                                style={{ marginBottom: '1rem' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Username
                            </label>
                            <input
                                type="text"
                                className="input-editorial"
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Admin"
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="password"
                                    className="input-editorial"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ paddingRight: '40px' }}
                                />
                                <Lock
                                    size={18}
                                    color="var(--text-muted)"
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-editorial">
                            Enter Workspace
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
