import { useState, useEffect, useCallback } from 'react'
import { fetchReceipts, login, fetchMe } from './api'
import Layout from './components/Layout'
import Dashboard from './views/Dashboard'
import ReceiptList from './components/ReceiptList'
import ReceiptForm from './components/ReceiptForm'
import ReceiptDetail from './components/ReceiptDetail'
import AuthView from './views/AuthView'
import CatalogView from './views/CatalogView'

function App() {
    // Auth config
    const [user, setUser] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    // Theme config
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('invoice-theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })

    // Initial auth check
    useEffect(() => {
        const token = localStorage.getItem('invoice-token')
        if (!token) {
            setAuthLoading(false)
            return
        }

        fetchMe()
            .then(userData => {
                setUser(userData)
            })
            .catch(err => {
                console.error(err)
                localStorage.removeItem('invoice-token')
            })
            .finally(() => {
                setAuthLoading(false)
            })
    }, [])

    const handleAuth = async (username, password) => {
        setAuthError(null)
        try {
            const data = await login(username, password)

            localStorage.setItem('invoice-token', data.token)
            setUser(data.user)
        } catch (err) {
            setAuthError(err.message)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('invoice-token')
        setUser(null)
        setView('dashboard')
    }

    // Update body class when theme changes
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        localStorage.setItem('invoice-theme', theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme(t => t === 'dark' ? 'light' : 'dark')
    }

    const [view, setView] = useState('dashboard') // default is now dashboard
    const [selectedId, setSelectedId] = useState(null)
    const [receipts, setReceipts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const loadReceipts = useCallback(async (searchTerm = '') => {
        if (!user) return; // Don't try loading if not authenticated

        setLoading(true)
        try {
            const data = await fetchReceipts(searchTerm)
            setReceipts(data)
        } catch (err) {
            console.error('Failed to load receipts:', err)
            if (err.message === 'UNAUTHORIZED') {
                handleLogout() // Force clear if token expired
            }
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (user && view === 'list') {
            loadReceipts(search)
        }
    }, [view, search, loadReceipts, user])

    const handleSelect = (id) => {
        setSelectedId(id)
        setView('detail')
    }

    const handleAdd = () => {
        setSelectedId(null)
        setView('form')
    }

    const handleEdit = () => {
        setView('edit')
    }

    const handleSave = () => {
        loadReceipts(search)
        setView('list')
    }

    const handleDelete = () => {
        loadReceipts(search)
        setView('list')
    }

    const handleBack = () => {
        setView('list')
    }

    // Render loading state while checking token
    if (authLoading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>Loading...</div>
    }

    // Render auth view if no user
    if (!user) {
        return <AuthView onLogin={handleAuth} error={authError} />
    }

    return (
        <Layout
            currentView={view}
            onViewChange={setView}
            theme={theme}
            toggleTheme={toggleTheme}
            onLogout={handleLogout}
            user={user}
        >
            {view === 'dashboard' && <Dashboard />}
            {view === 'catalog' && <CatalogView />}

            {view === 'list' && (
                <ReceiptList
                    receipts={receipts}
                    loading={loading}
                    search={search}
                    onSearchChange={setSearch}
                    onSelect={handleSelect}
                    onAdd={handleAdd}
                />
            )}

            {view === 'form' && (
                <ReceiptForm
                    receiptId={null}
                    onSave={handleSave}
                    onCancel={handleBack}
                />
            )}

            {view === 'edit' && (
                <ReceiptForm
                    receiptId={selectedId}
                    onSave={handleSave}
                    onCancel={() => setView('detail')}
                />
            )}

            {view === 'detail' && (
                <ReceiptDetail
                    receiptId={selectedId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onBack={handleBack}
                />
            )}
        </Layout>
    )
}

export default App
