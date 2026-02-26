import { useState, useEffect } from 'react'
import { Home, ReceiptText, Menu, X, Sun, Moon, LogOut, PackageSearch, TrendingUp } from 'lucide-react'

export default function Layout({ children, currentView, onViewChange, theme, toggleTheme, onLogout, user }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Close mobile menu when screen resizes to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 768) {
                setIsMobileMenuOpen(false)
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Close menu when navigating
    const handleNav = (view) => {
        onViewChange(view)
        setIsMobileMenuOpen(false)
    }

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'list', label: 'Sales History', icon: ReceiptText },
        { id: 'catalog', label: 'Catalog', icon: PackageSearch },
    ]

    return (
        <div className="layout">
            {/* Mobile Topbar */}
            <div className="mobile-topbar">
                <div className="logo-container">
                    <TrendingUp size={24} className="logo-icon-svg" strokeWidth={2.5} />
                    <span className="logo-text">Sales Tracker</span>
                </div>
                <button
                    className="menu-toggle"
                    onClick={() => setIsMobileMenuOpen(true)}
                    aria-label="Open menu"
                >
                    <Menu size={24} />
                </button>
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isMobileMenuOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-container">
                        <TrendingUp size={24} className="logo-icon-svg" strokeWidth={2.5} />
                        <span className="logo-text">Sales Tracker</span>
                    </div>
                    <button
                        className="menu-close"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = currentView === item.id ||
                            (item.id === 'list' && ['form', 'detail', 'edit'].includes(currentView))

                        return (
                            <button
                                key={item.id}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => handleNav(item.id)}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                            </button>
                        )
                    })}
                </nav>

                {/* Bottom Actions */}
                <div style={{ marginTop: 'auto', padding: '24px 16px', borderTop: '1px solid var(--border)' }}>
                    {user && (
                        <div style={{ padding: '0 16px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Logged in as <b style={{ color: 'var(--text)' }}>{user.username}</b>
                        </div>
                    )}
                    <button className="nav-item" onClick={toggleTheme} style={{ width: '100%' }}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    {onLogout && (
                        <button className="nav-item" onClick={onLogout} style={{ width: '100%', marginTop: '4px', color: 'var(--danger)' }}>
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <div className="content-container">
                    {children}
                </div>
            </main>
        </div>
    )
}
