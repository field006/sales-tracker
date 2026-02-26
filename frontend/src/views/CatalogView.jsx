import { useState, useEffect } from 'react'
import { Plus, Trash2, Tag, Box } from 'lucide-react'
import {
    fetchCategories, createCategory, deleteCategory,
    fetchProducts, createProduct, updateProduct, deleteProduct
} from '../api'

export default function CatalogView() {
    const [activeTab, setActiveTab] = useState('products')

    // Categories
    const [categories, setCategories] = useState([])
    const [newCatName, setNewCatName] = useState('')
    const [catLoading, setCatLoading] = useState(true)

    // Products
    const [products, setProducts] = useState([])
    const [prodLoading, setProdLoading] = useState(true)
    const [prodForm, setProdForm] = useState({ name: '', category_id: '', default_price: '' })

    // Pagination State
    const ITEMS_PER_PAGE = 10
    const [catPage, setCatPage] = useState(1)
    const [prodPage, setProdPage] = useState(1)

    // Errors
    const [error, setError] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setError(null)
            const [cats, prods] = await Promise.all([
                fetchCategories(),
                fetchProducts()
            ])
            setCategories(cats)
            setProducts(prods)
        } catch (err) {
            setError('Failed to load catalog data')
        } finally {
            setCatLoading(false)
            setProdLoading(false)
        }
    }

    // ==== Category Actions ====
    const handleCreateCategory = async (e) => {
        e.preventDefault()
        try {
            setError(null)
            const newCat = await createCategory(newCatName)
            setCategories([...categories, newCat])
            setNewCatName('')
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDeleteCategory = async (id) => {
        if (!confirm('Are you sure? Products in this category will become Uncategorized.')) return
        try {
            setError(null)
            await deleteCategory(id)
            setCategories(categories.filter(c => c.id !== id))
            // Refresh products as their categories might have become null
            const prods = await fetchProducts()
            setProducts(prods)
        } catch (err) {
            setError(err.message)
        }
    }

    // ==== Product Actions ====
    const handleCreateProduct = async (e) => {
        e.preventDefault()
        try {
            setError(null)
            const newProd = await createProduct({
                name: prodForm.name,
                category_id: prodForm.category_id || null, // convert empty to null
                default_price: parseFloat(prodForm.default_price) || 0
            })
            setProducts([...products, newProd])
            setProdForm({ name: '', category_id: '', default_price: '' })
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDeleteProduct = async (id) => {
        if (!confirm('Delete this product? Past receipts will keep the text name.')) return
        try {
            setError(null)
            await deleteProduct(id)
            setProducts(products.filter(p => p.id !== id))
            // Reset to page 1 if we deleted the last item on the page
            if (currentProds.length === 1 && prodPage > 1) {
                setProdPage(prodPage - 1)
            }
        } catch (err) {
            setError(err.message)
        }
    }

    // ==== Derived States (Pagination) ====
    const totalCatPages = Math.ceil(categories.length / ITEMS_PER_PAGE)
    const currentCats = categories.slice((catPage - 1) * ITEMS_PER_PAGE, catPage * ITEMS_PER_PAGE)

    const totalProdPages = Math.ceil(products.length / ITEMS_PER_PAGE)
    const currentProds = products.slice((prodPage - 1) * ITEMS_PER_PAGE, prodPage * ITEMS_PER_PAGE)

    return (
        <div className="content-container">
            <div className="header">
                <h1>Catalog Manager</h1>
                <p style={{ color: 'var(--text-muted)' }}>Configure strict product names and categories to standardize receipt entry.</p>
            </div>

            {error && (
                <div style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                <button
                    className={`btn ${activeTab === 'products' ? '' : 'btn-ghost'}`}
                    style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'products' ? '2px solid var(--primary)' : 'none' }}
                    onClick={() => setActiveTab('products')}
                >
                    <Box size={16} /> Products
                </button>
                <button
                    className={`btn ${activeTab === 'categories' ? '' : 'btn-ghost'}`}
                    style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'categories' ? '2px solid var(--primary)' : 'none' }}
                    onClick={() => setActiveTab('categories')}
                >
                    <Tag size={16} /> Categories
                </button>
            </div>

            {activeTab === 'categories' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Manage Categories</h2>

                    <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="New Category Name (e.g., Food, Drink)"
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                            <Plus size={16} /> Add
                        </button>
                    </form>

                    {catLoading ? <p>Loading...</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {categories.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No categories yet.</p> : currentCats.map(cat => (
                                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => handleDeleteCategory(cat.id)}
                                        style={{ color: 'var(--danger)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Pagination Controls */}
                            {totalCatPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setCatPage(p => Math.max(1, p - 1))}
                                        disabled={catPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {catPage} of {totalCatPages}</span>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setCatPage(p => Math.min(totalCatPages, p + 1))}
                                        disabled={catPage === totalCatPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'products' && (
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Manage Products</h2>

                    <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                                <label>Product Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    required
                                    placeholder="e.g. Latte"
                                    value={prodForm.name}
                                    onChange={e => setProdForm({ ...prodForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    className="select"
                                    value={prodForm.category_id}
                                    onChange={e => setProdForm({ ...prodForm, category_id: e.target.value })}
                                >
                                    <option value="">Uncategorized</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Default Price (Rp)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    required
                                    placeholder="0"
                                    value={prodForm.default_price}
                                    onChange={e => setProdForm({ ...prodForm, default_price: e.target.value })}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                            <Plus size={16} /> Add Product
                        </button>
                    </form>

                    {prodLoading ? <p>Loading...</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {products.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No products yet.</p> : currentProds.map(prod => (
                                <div key={prod.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', gap: '16px' }}>
                                    <span style={{ fontWeight: 600 }}>{prod.name}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        {prod.category_name || <span style={{ fontStyle: 'italic' }}>Uncategorized</span>}
                                    </span>
                                    <span style={{ fontWeight: 500, color: 'var(--primary)' }}>Rp {Number(prod.default_price || 0).toLocaleString('id-ID')}</span>

                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => handleDeleteProduct(prod.id)}
                                        style={{ color: 'var(--danger)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Pagination Controls */}
                            {totalProdPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setProdPage(p => Math.max(1, p - 1))}
                                        disabled={prodPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {prodPage} of {totalProdPages}</span>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setProdPage(p => Math.min(totalProdPages, p + 1))}
                                        disabled={prodPage === totalProdPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
