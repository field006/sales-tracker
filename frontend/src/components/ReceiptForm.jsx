import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { createReceipt, updateReceipt, fetchReceipt, fetchProducts, fetchCategories, createProduct } from '../api'

const emptyItem = { name: '', category: 'Uncategorized', category_id: null, qty: 1, price: 0 }

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

    useEffect(() => {
        // Fetch Catalog
        Promise.all([fetchProducts(), fetchCategories()])
            .then(([prods, cats]) => {
                setCatalogProducts(prods)
                setCatalogCategories(cats)
            })
            .catch(err => console.error("Could not load catalog", err))

        if (isEdit) {
            setLoadingEdit(true)
            fetchReceipt(receiptId)
                .then((data) => {
                    setForm({
                        receipt_number: data.restaurant_name, // Map legacy column locally
                        date: data.date,
                        tax: data.tax || 0,
                        service_charge: data.service_charge || 0,
                        note: data.note || '',
                    })
                    setItems(
                        data.items.map((item) => ({
                            name: item.name,
                            category: item.category || 'Uncategorized',
                            category_id: null, // Legacy items don't have this mapped, we just need the text
                            qty: item.qty,
                            price: item.price,
                        }))
                    )
                })
                .catch(() => setError('Failed to load receipt'))
                .finally(() => setLoadingEdit(false))
        }
    }, [receiptId, isEdit])

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const updateItem = (index, field, value) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== index) return item
                const updated = { ...item, [field]: value }

                // If they changed the name manually, disconnect it from any strict catalog ID
                if (field === 'name') {
                    updated.is_new = true // Flag that this might need creating
                }

                return updated
            })
        )
    }

    const selectCatalogProduct = (index, product) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item
            return {
                ...item,
                name: product.name,
                category: product.category_name || 'Uncategorized',
                category_id: product.category_id,
                price: product.default_price,
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
            // Before saving the receipt, auto-create any new products they typed in
            const finalItems = []
            for (const item of validItems) {
                let finalCategory = item.category

                // If it's flagged as new, maybe we should create it
                if (item.is_new) {
                    // check if it exists exactly in catalog
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
                        // user typed an existing name but picked a new category manually, let's just grab the cat name
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
                restaurant_name: form.receipt_number, // Pass as legacy column back to DB smoothly without altering tables yet
                tax: Number(form.tax),
                service_charge: Number(form.service_charge),
                items: finalItems
            }

            if (isEdit) {
                await updateReceipt(receiptId, payload)
            } else {
                await createReceipt(payload)
            }
            onSave()
        } catch (err) {
            setError(err.message)
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
                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
                    + Add Item
                </button>
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
                                            <span className="prod-price">
                                                Rp {Number(p.default_price).toLocaleString('id-ID')}
                                            </span>
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
                            <input
                                type="number"
                                className="input item-qty"
                                placeholder="Qty"
                                min="1"
                                value={item.qty}
                                onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                            />
                            <input
                                type="number"
                                className="input item-price"
                                placeholder="Price"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            />
                        </div>

                        <div className="item-actions-group">
                            <span className="item-total">
                                Rp {(item.qty * item.price).toLocaleString('id-ID')}
                            </span>
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

            {/* Actions */}
            <div className="action-bar">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : isEdit ? 'Update Receipt' : 'Save Receipt'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    )
}
