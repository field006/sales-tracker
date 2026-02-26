import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import { useState, useEffect } from 'react'
import { fetchDashboardStats, fetchDashboardWeekly, fetchDashboardCategories, fetchReceipts } from '../api'

// Array of nice colors for the pie chart
const PIE_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#a855f7']

export default function Dashboard() {
    // Default to 1st of current month up to today
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    })
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })

    const [stats, setStats] = useState({ total_revenue: 0, receipt_count: 0, avg_ticket: 0 })
    const [weeklyData, setWeeklyData] = useState([])
    const [categoryData, setCategoryData] = useState([])
    const [recentReceipts, setRecentReceipts] = useState([])
    const [fullFilteredReceipts, setFullFilteredReceipts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [st, week, cats, receipts] = await Promise.all([
                    fetchDashboardStats(startDate, endDate),
                    fetchDashboardWeekly(startDate, endDate),
                    fetchDashboardCategories(startDate, endDate),
                    fetchReceipts('', startDate, endDate)
                ])

                setStats({
                    total_revenue: st.total_revenue || 0,
                    receipt_count: st.receipt_count || 0,
                    avg_ticket: st.avg_ticket || 0
                })

                setWeeklyData(week)

                // Assign colors dynamically based on index
                setCategoryData(cats.map((c, i) => ({
                    ...c,
                    color: PIE_COLORS[i % PIE_COLORS.length]
                })))

                // Store full list for export, and top 5 recent sales locally
                if (receipts) {
                    setFullFilteredReceipts(receipts)
                    const sorted = [...receipts].sort((a, b) => new Date(b.date) - new Date(a.date))
                    setRecentReceipts(sorted.slice(0, 5))
                }

            } catch (err) {
                console.error("Dashboard failed to load", err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, []) // Initial load

    const handleApplyFilter = () => {
        loadData()
    }

    const handleExport = () => {
        if (!fullFilteredReceipts.length) {
            alert('No data to export for this date range.');
            return;
        }

        const headers = ["Receipt Number", "Date", "Items", "Subtotal (Rp)", "Tax (Rp)", "Service Charge (Rp)", "Total (Rp)", "Note"];
        const rows = fullFilteredReceipts.map(r => [
            `"${r.restaurant_name || `INV-${r.id}`}"`,
            `"${r.date}"`,
            r.item_count,
            r.subtotal,
            r.tax,
            r.service_charge,
            r.total,
            `"${(r.note || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        // Append Category Data
        const categorySection = [
            "\n\n---",
            "SALES BY CATEGORY",
            "Category,Total Sales (Rp)",
            ...categoryData.map(c => `"${c.name}",${c.value}`)
        ].join("\n");

        const finalContent = csvContent + categorySection;

        const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `sales_report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (loading) {
        return <div style={{ padding: '24px' }}>Loading analytics...</div>
    }

    return (
        <div className="dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <h2>Sales Dashboard</h2>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--surface)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>From</label>
                        <input
                            type="date"
                            className="input"
                            style={{ padding: '6px' }}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>To</label>
                        <input
                            type="date"
                            className="input"
                            style={{ padding: '6px' }}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleApplyFilter} style={{ marginRight: '8px' }}>
                        Apply
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={handleExport} style={{ border: '1px solid var(--border)' }}>
                        Download Report
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="dashboard-grid stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Spent</div>
                    <div className="stat-value">Rp {stats.total_revenue.toLocaleString('id-ID')}</div>
                    <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>All time</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Invoices</div>
                    <div className="stat-value">{stats.receipt_count}</div>
                    <div className="stat-trend" style={{ color: 'var(--text-muted)' }}>For selected period</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Avg. Ticket Size</div>
                    <div className="stat-value">Rp {stats.avg_ticket.toLocaleString('id-ID')}</div>
                </div>
            </div>

            <div className="dashboard-grid charts-grid">
                {/* Weekly Trend Bar Chart */}
                <div className="chart-container">
                    <h3>Weekly Sales</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
                                <XAxis dataKey="name" stroke="#9494a0" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9494a0" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp ${Number(val).toLocaleString('id-ID')}`} />
                                <Tooltip
                                    cursor={false}
                                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                                    itemStyle={{ color: 'var(--text)' }}
                                />
                                <Bar dataKey="total" fill="var(--primary)" activeBar={{ fill: 'var(--primary-hover)' }} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Pie Chart */}
                <div className="chart-container">
                    <h3>Sales by Category</h3>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text)' }}
                                    itemStyle={{ color: 'var(--text)' }}
                                    formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Receipts Mini List */}
            <div className="recent-receipts">
                <h3>Recent Sales</h3>
                <div className="receipt-list-mini">
                    {recentReceipts.map(r => (
                        <div key={r.id} className="receipt-item-mini">
                            <div className="ri-info">
                                <div className="ri-name">{r.restaurant_name || `Invoice #${r.id}`}</div>
                                <div className="ri-date">{r.date}</div>
                            </div>
                            <div className="ri-amount">Rp {r.total.toLocaleString('id-ID')}</div>
                        </div>
                    ))}
                    {recentReceipts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No receipts logged yet.</div>}
                </div>
            </div>
        </div>
    )
}
