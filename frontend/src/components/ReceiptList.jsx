import { useState, useEffect } from 'react'

export default function ReceiptList({ receipts, loading, search, onSearchChange, onSelect, onAdd }) {
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 10

    // Reset pagination to page 1 whenever search query changes
    useEffect(() => {
        setPage(1)
    }, [search])
    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        )
    }

    const totalPages = Math.ceil(receipts.length / ITEMS_PER_PAGE)
    const currentReceipts = receipts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

    return (
        <>
            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="input"
                    placeholder="Search invoices..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {receipts.length === 0 ? (
                <div className="empty-state">
                    <div className="emoji">🧾</div>
                    <p>No sales yet</p>
                    <p className="hint">Tap the + button to add your first sale</p>
                </div>
            ) : (
                <div className="receipt-grid">
                    {currentReceipts.map((receipt) => (
                        <div
                            key={receipt.id}
                            className="card receipt-card"
                            onClick={() => onSelect(receipt.id)}
                        >
                            <div className="restaurant-name">{receipt.restaurant_name || `INV-${receipt.id}`}</div>
                            <div className="receipt-date">
                                {new Date(receipt.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </div>
                            <div className="receipt-meta">
                                <span className="receipt-total">
                                    Rp {Number(receipt.total).toLocaleString('id-ID')}
                                </span>
                                <span className="receipt-items-count">
                                    {receipt.item_count} item{receipt.item_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingBottom: '24px' }}>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next
                    </button>
                </div>
            )}

            <button className="fab" onClick={onAdd} title="Add invoice">
                +
            </button>
        </>
    )
}
