import { useState, useEffect } from 'react'
import { fetchReceipt, deleteReceipt } from '../api'

export default function ReceiptDetail({ receiptId, onEdit, onDelete, onBack }) {
    const [receipt, setReceipt] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        setLoading(true)
        fetchReceipt(receiptId)
            .then(setReceipt)
            .catch(() => setError('Failed to load receipt'))
            .finally(() => setLoading(false))
    }, [receiptId])

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this receipt?')) return
        try {
            await deleteReceipt(receiptId)
            onDelete()
        } catch (err) {
            setError(err.message)
        }
    }

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div>
                <div className="error-msg">{error}</div>
                <button className="btn btn-ghost" onClick={onBack}>← Back</button>
            </div>
        )
    }

    if (!receipt) return null

    const subtotal = receipt.items.reduce((sum, item) => sum + item.qty * item.price, 0)
    const taxAmount = subtotal * ((receipt.tax || 0) / 100)
    const serviceAmount = subtotal * ((receipt.service_charge || 0) / 100)
    const grandTotal = subtotal + taxAmount + serviceAmount

    return (
        <div>
            <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
                ← Back
            </button>

            <div className="card">
                <div className="detail-header">
                    <div className="restaurant-name">{receipt.restaurant_name}</div>
                    <div className="receipt-date">
                        {new Date(receipt.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </div>
                </div>

                <table className="items-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receipt.items.map((item) => (
                            <tr key={item.id}>
                                <td>{item.name}</td>
                                <td className="text-right">{item.qty}</td>
                                <td className="text-right">Rp {Number(item.price).toLocaleString('id-ID')}</td>
                                <td className="text-right">Rp {(item.qty * item.price).toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="summary">
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {receipt.tax > 0 && (
                        <div className="summary-row">
                            <span>Tax ({receipt.tax}%)</span>
                            <span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                        </div>
                    )}
                    {receipt.service_charge > 0 && (
                        <div className="summary-row">
                            <span>Service Charge ({receipt.service_charge}%)</span>
                            <span>Rp {serviceAmount.toLocaleString('id-ID')}</span>
                        </div>
                    )}
                    <div className="summary-row total">
                        <span>Total</span>
                        <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                </div>

                {receipt.note && (
                    <div className="note-section">
                        <strong>Note:</strong> {receipt.note}
                    </div>
                )}
            </div>

            <div className="action-bar-between">
                <button className="btn btn-primary" onClick={onEdit}>
                    ✏️ Edit
                </button>
                <button className="btn btn-danger" onClick={handleDelete}>
                    🗑 Delete
                </button>
            </div>
        </div>
    )
}
