import { useState } from 'react'
import { X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { changePassword } from '../api'

export default function ChangePasswordModal({ onClose }) {
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [showOldPass, setShowOldPass] = useState(false)
    const [showNewPass, setShowNewPass] = useState(false)

    const [status, setStatus] = useState({ type: '', msg: '' }) // type: 'error' | 'success'
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (newPassword.length < 6) {
            setStatus({ type: 'error', msg: 'New password must be at least 6 characters long.' })
            return
        }

        setLoading(true)
        setStatus({ type: '', msg: '' })

        try {
            await changePassword(oldPassword, newPassword)
            setStatus({ type: 'success', msg: 'Password changed successfully! You can close this window.' })
            setOldPassword('')
            setNewPassword('')
        } catch (err) {
            setStatus({ type: 'error', msg: err.message || 'Failed to change password.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)',
                width: '100%', maxWidth: '400px',
                borderRadius: 'var(--radius)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '20px 24px', borderBottom: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <KeyRound size={20} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Change Password</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-ghost btn-icon"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {status.msg && (
                        <div style={{
                            padding: '12px 16px',
                            backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: status.type === 'error' ? 'var(--danger)' : 'var(--success)',
                            border: `1px solid ${status.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: '20px',
                            fontSize: '0.9rem'
                        }}>
                            {status.msg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Current Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showOldPass ? 'text' : 'password'}
                                    className="input"
                                    required
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    style={{ paddingRight: '40px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowOldPass(!showOldPass)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex'
                                    }}
                                >
                                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPass ? 'text' : 'password'}
                                    className="input"
                                    required
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    style={{ paddingRight: '40px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPass(!showNewPass)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex'
                                    }}
                                >
                                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
                            disabled={loading || status.type === 'success'}
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
