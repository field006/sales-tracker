import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { createReceipt, updateReceipt, fetchReceipt, fetchProducts, fetchCategories, createProduct, updateProduct, fetchNextReceiptNumber } from '../api'

const emptyItem = { name: '', category: 'Uncategorized', category_id: null, qty: 1, price: '', subtotal: '', catalog_product_id: null, default_price: null, recent_price: null }

export default function ReceiptForm({ receiptId, onSave, onCancel }) {
    const isEdit = receiptId !== null

    const [form, setForm] = useState({
        receipt_number: '',
        date: new Date().toISOString().split('T')[0],
        tax: 0,
        service_charge: 0,
        note: '',
    })
    const [items, setItems] = useState([{ ...emptyItem }])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [toast, setToast] = useState(null) // { message, type: 'success'|'error' }

    // Catalog State
    const [catalogProducts, setCatalogProducts] = useState([])
    const [catalogCategories, setCatalogCategories] = useState([])
    const [activeDropdownRow, setActiveDropdownRow] = useState(null)
    const formRef = useRef(null)

    // Handle click away for autocomplete
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (formRef.current && !formRef.current.contains(event.target)) {
                setActiveDropdownRow(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch catalog on mount
    useEffect(() => {
        Promise.all([fetchProducts(), fetchCategories()])
            .then(([prods, cats]) => {
                setCatalogProducts(prods)
                setCatalogCategories(cats)
            })
            .catch(err => console.error("Could not load catalog", err))
    }, [])

    // Auto-fetch next receipt number whenever date changes (new mode only)
    useEffect(() => {
        if (isEdit || !form.date) return
        fetchNextReceiptNumber(form.date)
            .then(data => {
                setForm(prev => ({
                    ...prev,
                    receipt_number: data.next_number != null ? String(data.next_number) : ''
                }))
            })
            .catch(() => { }) // Silently ignore — user can type manually
    }, [form.date, isEdit])

    // Load receipt data in edit mode
    useEffect(() => {
        if (!isEdit) return
        setLoadingEdit(true)
        fetchReceipt(receiptId)
            .then((data) => {
                setForm({
                    receipt_number: data.restaurant_name,
                    date: data.date,
                    tax: data.tax || 0,
                    service_charge: data.service_charge || 0,
                    note: data.note || '',
                })
                setItems(
                    data.items.map((item) => ({
                        name: item.name,
                        category: item.category || 'Uncategorized',
                        category_id: null,
                        qty: item.qty,
                        price: item.price,
                        subtotal: Math.round(item.qty * item.price * 100) / 100,
                        catalog_product_id: null,
                        default_price: null,
                        recent_price: null,
                    }))
                )
            })
            .catch(() => setError('Failed to load receipt'))
            .finally(() => setLoadingEdit(false))
    }, [receiptId, isEdit])

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const updateItem = (index, field, value) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                const updated = { ...item, [field]: value }

                if (field === 'name') updated.is_new = true

                // Keep subtotal ↔ price in sync bidirectionally
                if (field === 'qty') {
                    const priceVal = Number(item.price) || 0;
                    updated.subtotal = value === '' ? '' : Math.round(Number(value) * priceVal * 100) / 100
                } else if (field === 'price') {
                    const qtyVal = Number(item.qty) || 0;
                    updated.subtotal = value === '' ? '' : Math.round(qtyVal * Number(value) * 100) / 100
                } else if (field === 'subtotal') {
                    // Back-calculate unit price from subtotal ÷ qty, rounded to 2dp
                    const qtyVal = Number(item.qty) || 1;
                    updated.price = value === '' ? '' : Math.round((Number(value) / qtyVal) * 100) / 100
                }

                return updated
            })
        )
    }

    const selectCatalogProduct = (index, product) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item
            const preferPrice = product.recent_price > 0 ? product.recent_price : product.default_price;
            return {
                ...item,
                name: product.name,
                category: product.category_name || 'Uncategorized',
                category_id: product.category_id,
                price: preferPrice,
                subtotal: Math.round(item.qty * preferPrice * 100) / 100,
                catalog_product_id: product.id,
                default_price: product.default_price,
                recent_price: product.recent_price,
                is_new: false
            }
        }))
        setActiveDropdownRow(null)
    }

    const addItem = () => {
        setItems((prev) => [...prev, { ...emptyItem }])
    }

    const removeItem = (index) => {
        if (items.length <= 1) return
        setItems((prev) => prev.filter((_, i) => i !== index))
    }

    const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0)
    const taxAmount = subtotal * (form.tax / 100)
    const serviceAmount = subtotal * (form.service_charge / 100)
    const grandTotal = subtotal + taxAmount + serviceAmount

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!form.receipt_number.trim()) {
            setError('Receipt number is required')
            return
        }
        if (!form.date) {
            setError('Date is required')
            return
        }
        if (items.length === 0 || items.every((i) => !i.name.trim())) {
            setError('At least one item is required')
            return
        }

        const validItems = items.filter((i) => i.name.trim())
        if (validItems.length === 0) {
            setError('At least one item with a name is required')
            return
        }

        setSaving(true)
        try {
            const finalItems = []
            for (const item of validItems) {
                let finalCategory = item.category

                if (item.is_new) {
                    const exists = catalogProducts.find(p => p.name.toLowerCase() === item.name.toLowerCase())
                    if (!exists && item.category_id) {
                        try {
                            const newProd = await createProduct({
                                name: item.name,
                                category_id: item.category_id,
                                default_price: item.price
                            })
                            finalCategory = newProd.category_name
                        } catch (e) {
                            console.error("Silently failed to auto-create product catalog entry", e)
                        }
                    } else if (item.category_id) {
                        const cat = catalogCategories.find(c => c.id === Number(item.category_id))
                        if (cat) finalCategory = cat.name
                    }
                }

                finalItems.push({
                    name: item.name.trim(),
                    category: finalCategory,
                    qty: Number(item.qty) || 1,
                    price: Number(item.price) || 0,
                })
            }

            const payload = {
                ...form,
                restaurant_name: form.receipt_number,
                tax: Number(form.tax),
                service_charge: Number(form.service_charge),
                items: finalItems
            }

            if (isEdit) {
                // Edit mode: save and close (existing behaviour)
                await updateReceipt(receiptId, payload)
                onSave()
            } else {
                // New mode: save, then keep form open
                await createReceipt(payload)

                // Feature 2: Sync catalog price for any product whose price was changed
                for (const item of validItems) {
                    if (
                        item.catalog_product_id &&
                        item.recent_price !== undefined &&
                        Number(item.price) !== Number(item.recent_price)
                    ) {
                        try {
                            await updateProduct(item.catalog_product_id, {
                                name: item.name,
                                category_id: item.category_id,
                                recent_price: Number(item.price)
                            })
                        } catch (e) {
                            console.error('Failed to sync product price', e)
                        }
                    }
                }

                // Refresh in-memory catalog so next autocomplete shows updated prices
                fetchProducts().then(prods => setCatalogProducts(prods)).catch(() => { })

                // Feature 1: Keep form open — reset items, auto-increment receipt number
                setItems([{ ...emptyItem }])
                const numData = await fetchNextReceiptNumber(form.date)
                setForm(prev => ({
                    ...prev,
                    receipt_number: numData.next_number != null ? String(numData.next_number) : prev.receipt_number
                }))
                showToast('Receipt saved! ✨')
            }
        } catch (err) {
            setError(err.message)
            showToast(err.message || 'Failed to save receipt', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loadingEdit) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} ref={formRef}>
            <h2 style={{ marginBottom: 20 }}>{isEdit ? 'Edit Sale' : 'New Sale'}</h2>

            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
                <label>Receipt Number *</label>
                <input
                    type="text"
                    className="input"
                    placeholder="e.g. INV-0001"
                    value={form.receipt_number}
                    onChange={(e) => updateForm('receipt_number', e.target.value)}
                    autoFocus
                />
            </div>

            <div className="form-row-2">
                <div className="form-group">
                    <label>Date *</label>
                    <input
                        type="date"
                        className="input"
                        value={form.date}
                        onChange={(e) => updateForm('date', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label>Note</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="Optional note"
                        value={form.note}
                        onChange={(e) => updateForm('note', e.target.value)}
                    />
                </div>
            </div>

            <div className="form-row-2">
                <div className="form-group">
                    <label>Tax (%)</label>
                    <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.1"
                        value={form.tax}
                        onChange={(e) => updateForm('tax', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label>Service Charge (%)</label>
                    <input
                        type="number"
                        className="input"
                        min="0"
                        step="0.1"
                        value={form.service_charge}
                        onChange={(e) => updateForm('service_charge', e.target.value)}
                    />
                </div>
            </div>

            {/* Items */}
            <div className="items-header">
                <h3>Items</h3>
            </div>

            {items.map((item, index) => {
                // Filter catalog items that match the current typed name
                const searchStr = (item.name || '').toLowerCase()
                let filteredProducts = []
                if (activeDropdownRow === index && searchStr.length > 0) {
                    filteredProducts = catalogProducts.filter(p => p.name.toLowerCase().includes(searchStr))
                }
                const showNewProductFields = activeDropdownRow === index && item.is_new && searchStr.length > 0

                return (
                    <div key={index} className="item-row">
                        <div className="item-name-group">
                            <input
                                type="text"
                                className="input item-name"
                                placeholder="Search or type product name"
                                value={item.name}
                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                onFocus={() => setActiveDropdownRow(index)}
                            />

                            {/* Autocomplete Dropdown */}
                            {activeDropdownRow === index && filteredProducts.length > 0 && (
                                <div className="autocomplete-dropdown">
                                    {filteredProducts.map(p => (
                                        <div
                                            key={p.id}
                                            className="autocomplete-item"
                                            onClick={() => selectCatalogProduct(index, p)}
                                        >
                                            <div className="prod-info">
                                                <span className="prod-name">{p.name}</span>
                                                <span className="prod-meta">{p.category_name || 'Uncategorized'}</span>
                                            </div>
                                            <div className="prod-prices">
                                                {p.recent_price > 0 && p.recent_price !== p.default_price ? (
                                                    <>
                                                        <span className="prod-price recent">Recent: Rp {Number(p.recent_price).toLocaleString('id-ID')}</span>
                                                        <span className="prod-price default-muted">Default: Rp {Number(p.default_price).toLocaleString('id-ID')}</span>
                                                    </>
                                                ) : (
                                                    <span className="prod-price">
                                                        Rp {Number(p.default_price).toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Inline New Category Picker if product doesn't exist */}
                            {showNewProductFields && filteredProducts.length === 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>New Product!</span>
                                    <select
                                        className="select"
                                        style={{ padding: '4px 8px', fontSize: '16px' }}
                                        value={item.category_id || ''}
                                        onChange={e => updateItem(index, 'category_id', e.target.value)}
                                    >
                                        <option value="">Assign a Category (Optional)</option>
                                        {catalogCategories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="item-details-group">
                            <div className="input-stepper item-qty">
                                <button type="button" className="stepper-btn" onClick={() => updateItem(index, 'qty', Math.max(1, (Number(item.qty) || 0) - 1))}>−</button>
                                <input
                                    type="number"
                                    className="stepper-input hide-arrows"
                                    placeholder="Qty"
                                    min="1"
                                    value={item.qty === '' ? '' : item.qty}
                                    onChange={(e) => updateItem(index, 'qty', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <button type="button" className="stepper-btn" onClick={() => updateItem(index, 'qty', (Number(item.qty) || 0) + 1)}>+</button>
                            </div>
                            <div className="item-price-wrapper">
                                <div className="input-stepper">
                                    <button type="button" className="stepper-btn text-xs" onClick={() => updateItem(index, 'price', Math.max(0, (Number(item.price) || 0) - 1000))}>-1k</button>
                                    <input
                                        type="number"
                                        className="stepper-input hide-arrows"
                                        placeholder="Price"
                                        min="0"
                                        step="0.01"
                                        value={item.price === '' ? '' : item.price}
                                        onChange={(e) => updateItem(index, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                    <button type="button" className="stepper-btn text-xs" onClick={() => updateItem(index, 'price', (Number(item.price) || 0) + 1000)}>+1k</button>
                                </div>

                                {/* Price Toggle Pills */}
                                {item.default_price > 0 && item.recent_price > 0 && item.default_price !== item.recent_price && (
                                    <div className="price-pills">
                                        <button
                                            type="button"
                                            className={`price-pill ${Number(item.price) === Number(item.default_price) ? 'active' : ''}`}
                                            onClick={() => updateItem(index, 'price', item.default_price)}
                                            title="Use Default Price"
                                        >
                                            Def: Rp {Number(item.default_price).toLocaleString('id-ID')}
                                        </button>
                                        <button
                                            type="button"
                                            className={`price-pill ${Number(item.price) === Number(item.recent_price) ? 'active' : ''}`}
                                            onClick={() => updateItem(index, 'price', item.recent_price)}
                                            title="Use Recent Price"
                                        >
                                            Rec: Rp {Number(item.recent_price).toLocaleString('id-ID')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="item-actions-group">
                            <input
                                type="number"
                                className="input item-total-input hide-arrows"
                                placeholder="Subtotal"
                                min="0"
                                step="0.01"
                                value={item.subtotal === '' ? '' : item.subtotal}
                                onChange={(e) => updateItem(index, 'subtotal', e.target.value === '' ? '' : Number(e.target.value))}
                                title="Edit subtotal to auto-calculate unit price"
                            />
                            <button
                                type="button"
                                className="btn btn-icon btn-ghost btn-danger-hover"
                                onClick={() => removeItem(index)}
                                disabled={items.length <= 1}
                                title="Remove item"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                )
            })}


            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                    + Add Item
                </button>
            </div>

            {/* Summary */}
            <div className="summary">
                <div className="summary-row">
                    <span>Subtotal</span>
                    <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>
                {form.tax > 0 && (
                    <div className="summary-row">
                        <span>Tax ({form.tax}%)</span>
                        <span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                    </div>
                )}
                {form.service_charge > 0 && (
                    <div className="summary-row">
                        <span>Service ({form.service_charge}%)</span>
                        <span>Rp {serviceAmount.toLocaleString('id-ID')}</span>
                    </div>
                )}
                <div className="summary-row total">
                    <span>Grand Total</span>
                    <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
            </div>

            {/* Actions — Save/Cancel on right */}
            <div className="action-bar" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : isEdit ? 'Update Receipt' : 'Save Receipt'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onCancel}>
                    Cancel
                </button>
            </div>

            {/* Toast notification */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.message}
                </div>
            )}
        </form>
    )
}
