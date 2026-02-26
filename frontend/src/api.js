const getApiUrl = () => localStorage.getItem('invoice-api-url') || import.meta.env.VITE_API_URL || '';

async function customFetch(endpoint, options = {}) {
    try {
        const url = `${getApiUrl()}${endpoint}`;
        // Add ngrok-skip-browser-warning header to bypass ngrok's interstitial page
        const headers = {
            ...options.headers,
            'ngrok-skip-browser-warning': 'true',
        };
        return await fetch(url, { ...options, headers });
    } catch (err) {
        // TypeError: Failed to fetch usually means network error/CORS
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            throw new Error('NETWORK_ERROR');
        }
        throw err;
    }
}

function getAuthHeaders(headers = {}) {
    const token = localStorage.getItem('invoice-token')
    return {
        ...headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
}

export async function login(username, password) {
    const res = await customFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    return data
}

export async function fetchMe() {
    const res = await customFetch('/api/auth/me', {
        headers: getAuthHeaders()
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Not authenticated')
    return data.user
}

export async function fetchReceipts(search = '', startDate = '', endDate = '') {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await customFetch(`/api/receipts${qs}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        if (res.status === 401) throw new Error('UNAUTHORIZED')
        throw new Error('Failed to fetch receipts');
    }
    return res.json();
}

export async function fetchReceipt(id) {
    const res = await customFetch(`/api/receipts/${id}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch receipt');
    return res.json();
}

export async function createReceipt(data) {
    const res = await customFetch('/api/receipts', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create receipt');
    }
    return res.json();
}

export async function updateReceipt(id, data) {
    const res = await customFetch(`/api/receipts/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update receipt');
    }
    return res.json();
}

export async function deleteReceipt(id) {
    const res = await customFetch(`/api/receipts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete receipt');
    return res.json();
}

// ===== CATALOG =====
export async function fetchCategories() {
    const res = await customFetch('/api/catalog/categories', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
}

export async function createCategory(name) {
    const res = await customFetch('/api/catalog/categories', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create category');
    }
    return res.json();
}

export async function deleteCategory(id) {
    const res = await customFetch(`/api/catalog/categories/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete category');
    return res.json();
}

export async function fetchProducts() {
    const res = await customFetch('/api/catalog/products', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
}

export async function createProduct(data) {
    const res = await customFetch('/api/catalog/products', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
    }
    return res.json();
}

export async function updateProduct(id, data) {
    const res = await customFetch(`/api/catalog/products/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update product');
    }
    return res.json();
}

export async function deleteProduct(id) {
    const res = await customFetch(`/api/catalog/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
}

// ===== DASHBOARD =====
export async function fetchDashboardStats(startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await customFetch(`/api/dashboard/stats${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
}

export async function fetchDashboardWeekly(startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await customFetch(`/api/dashboard/weekly${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch weekly trend');
    return res.json();
}

export async function fetchDashboardCategories(startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await customFetch(`/api/dashboard/categories${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch category stats');
    return res.json();
}
