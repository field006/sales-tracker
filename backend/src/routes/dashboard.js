import express from 'express'
import db from '../db.js'

const router = express.Router()

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
    try {
        const { startDate, endDate } = req.query

        // Let's rewrite this query to be more robust
        let queryStr = `
            SELECT 
                COUNT(DISTINCT r.id) as receipt_count,
                IFNULL(SUM(ri.qty * ri.price + r.tax + r.service_charge), 0) as total_revenue
            FROM receipts r
            LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
            WHERE r.user_id = ?
        `
        const params = [req.user.user_id]

        if (startDate) {
            queryStr += ` AND r.date >= ?`
            params.push(startDate)
        }
        if (endDate) {
            queryStr += ` AND r.date <= ?`
            params.push(endDate)
        }

        const betterStats = db.prepare(queryStr).get(...params)

        // No need for default get() line, we did it above using params dynamically

        res.json({
            receipt_count: betterStats.receipt_count,
            total_revenue: betterStats.total_revenue,
            avg_ticket: betterStats.receipt_count > 0 ? (betterStats.total_revenue / betterStats.receipt_count) : 0
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch dashboard stats' })
    }
})

// GET /api/dashboard/weekly
router.get('/weekly', (req, res) => {
    try {
        const { startDate, endDate } = req.query

        let queryStr = `
            SELECT 
                r.date,
                SUM(ri.qty * ri.price) + r.tax + r.service_charge as daily_total
            FROM receipts r
            LEFT JOIN receipt_items ri ON r.id = ri.receipt_id
            WHERE r.user_id = ? 
        `

        const params = [req.user.user_id]
        if (startDate) {
            queryStr += ` AND r.date >= ?`
            params.push(startDate)
        } else {
            queryStr += ` AND r.date >= date('now', '-7 days')`
        }

        if (endDate) {
            queryStr += ` AND r.date <= ?`
            params.push(endDate)
        }

        queryStr += ` GROUP BY r.id, r.date`

        const simpleWeekly = db.prepare(queryStr).all(...params)

        // aggregate by date
        const aggregated = simpleWeekly.reduce((acc, curr) => {
            acc[curr.date] = (acc[curr.date] || 0) + curr.daily_total
            return acc
        }, {})

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const result = Object.entries(aggregated).map(([dateString, total]) => {
            const dateObj = new Date(dateString)
            return {
                name: days[dateObj.getDay()],
                total: total
            }
        })

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch weekly stats' })
    }
})

// GET /api/dashboard/categories
router.get('/categories', (req, res) => {
    try {
        const { startDate, endDate } = req.query

        let queryStr = `
            SELECT 
                ri.category as name,
                SUM(ri.qty * ri.price) as value
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE r.user_id = ?
        `
        const params = [req.user.user_id]

        if (startDate) {
            queryStr += ` AND r.date >= ?`
            params.push(startDate)
        }
        if (endDate) {
            queryStr += ` AND r.date <= ?`
            params.push(endDate)
        }

        queryStr += ` GROUP BY ri.category ORDER BY value DESC`

        const categories = db.prepare(queryStr).all(...params)

        res.json(categories)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch category stats' })
    }
})

export default router
