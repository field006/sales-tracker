import { Router } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key_for_invoice_app'

// Authentication Middleware
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }
}

// Apply middleware to all receipt routes
router.use(authMiddleware)

// GET /api/receipts — List all receipts for user
router.get('/', (req, res) => {
    try {
        const { search, sort, startDate, endDate } = req.query
        const userId = req.user.user_id

        let query = `
      SELECT
        r.*,
        COALESCE(SUM(ri.qty * ri.price), 0) AS subtotal,
        COUNT(ri.id) AS item_count
      FROM receipts r
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE r.user_id = ?
    `
        const params = [userId]

        if (search) {
            query += ` AND r.restaurant_name LIKE ?`
            params.push(`%${search}%`)
        }

        if (startDate) {
            query += ` AND r.date >= ?`
            params.push(startDate)
        }
        if (endDate) {
            query += ` AND r.date <= ?`
            params.push(endDate)
        }

        query += ` GROUP BY r.id`

        // Sorting
        switch (sort) {
            case 'date_asc':
                query += ` ORDER BY r.date ASC`
                break
            case 'name_asc':
                query += ` ORDER BY r.restaurant_name ASC`
                break
            case 'name_desc':
                query += ` ORDER BY r.restaurant_name DESC`
                break
            default:
                query += ` ORDER BY r.date DESC`
        }

        const receipts = db.prepare(query).all(...params)

        // Calculate totals
        const result = receipts.map((r) => ({
            ...r,
            total: r.subtotal + r.subtotal * (r.tax / 100) + r.subtotal * (r.service_charge / 100),
        }))

        res.json(result)
    } catch (err) {
        console.error('Error listing receipts:', err)
        res.status(500).json({ error: 'Failed to fetch receipts' })
    }
})

// GET /api/receipts/next-number — Get next receipt number for a given date
router.get('/next-number', (req, res) => {
    try {
        const userId = req.user.user_id
        const { date } = req.query
        if (!date) return res.status(400).json({ error: 'date is required' })

        const row = db.prepare(
            `SELECT MAX(CAST(restaurant_name AS INTEGER)) as max_num
             FROM receipts
             WHERE user_id = ? AND date = ? AND restaurant_name GLOB '[0-9]*'`
        ).get(userId, date)

        const maxNum = row?.max_num
        res.json({ next_number: maxNum != null ? maxNum + 1 : null })
    } catch (err) {
        console.error('Error fetching next receipt number:', err)
        res.status(500).json({ error: 'Failed to fetch next receipt number' })
    }
})

// GET /api/receipts/:id — Get receipt with items for user
router.get('/:id', (req, res) => {
    try {
        const userId = req.user.user_id
        const receipt = db.prepare('SELECT * FROM receipts WHERE id = ? AND user_id = ?').get(req.params.id, userId)

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' })
        }

        const items = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(req.params.id)

        res.json({ ...receipt, items })
    } catch (err) {
        console.error('Error fetching receipt:', err)
        res.status(500).json({ error: 'Failed to fetch receipt' })
    }
})

// POST /api/receipts — Create receipt with items
router.post('/', (req, res) => {
    try {
        const userId = req.user.user_id
        const { restaurant_name, date, tax = 0, service_charge = 0, note = '', items } = req.body

        // Validation
        if (!restaurant_name || !restaurant_name.trim()) {
            return res.status(400).json({ error: 'Restaurant name is required' })
        }
        if (!date) {
            return res.status(400).json({ error: 'Date is required' })
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one item is required' })
        }

        for (const item of items) {
            if (!item.name || !item.name.trim()) {
                return res.status(400).json({ error: 'Each item must have a name' })
            }
            if (typeof item.qty !== 'number' || item.qty < 1) {
                return res.status(400).json({ error: 'Each item must have qty >= 1' })
            }
            if (typeof item.price !== 'number' || item.price < 0) {
                return res.status(400).json({ error: 'Each item must have price >= 0' })
            }
        }

        // Insert in transaction
        const insertReceipt = db.prepare(`
      INSERT INTO receipts (user_id, restaurant_name, date, tax, service_charge, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

        const insertItem = db.prepare(`
      INSERT INTO receipt_items (receipt_id, category, name, qty, price)
      VALUES (?, ?, ?, ?, ?)
    `)

        const createTransaction = db.transaction((data) => {
            const result = insertReceipt.run(
                data.userId,
                data.restaurant_name.trim(),
                data.date,
                Number(data.tax),
                Number(data.service_charge),
                data.note || ''
            )
            const receiptId = result.lastInsertRowid

            for (const item of data.items) {
                insertItem.run(receiptId, item.category || 'Uncategorized', item.name.trim(), item.qty, item.price)
            }

            return receiptId
        })

        const receiptId = createTransaction({ userId, restaurant_name, date, tax, service_charge, note, items })

        // Return created receipt
        const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId)
        const savedItems = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(receiptId)

        res.status(201).json({ ...receipt, items: savedItems })
    } catch (err) {
        console.error('Error creating receipt:', err)
        res.status(500).json({ error: 'Failed to create receipt' })
    }
})

// PUT /api/receipts/:id — Update receipt
router.put('/:id', (req, res) => {
    try {
        const userId = req.user.user_id
        const existing = db.prepare('SELECT * FROM receipts WHERE id = ? AND user_id = ?').get(req.params.id, userId)

        if (!existing) {
            return res.status(404).json({ error: 'Receipt not found' })
        }

        const { restaurant_name, date, tax = 0, service_charge = 0, note = '', items } = req.body

        // Validation
        if (!restaurant_name || !restaurant_name.trim()) {
            return res.status(400).json({ error: 'Restaurant name is required' })
        }
        if (!date) {
            return res.status(400).json({ error: 'Date is required' })
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'At least one item is required' })
        }

        const updateReceipt = db.prepare(`
      UPDATE receipts SET
        restaurant_name = ?,
        date = ?,
        tax = ?,
        service_charge = ?,
        note = ?,
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `)

        const deleteItems = db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?')

        const insertItem = db.prepare(`
      INSERT INTO receipt_items (receipt_id, category, name, qty, price)
      VALUES (?, ?, ?, ?, ?)
    `)

        const updateTransaction = db.transaction(() => {
            updateReceipt.run(
                restaurant_name.trim(),
                date,
                Number(tax),
                Number(service_charge),
                note || '',
                req.params.id,
                userId
            )
            deleteItems.run(req.params.id)
            for (const item of items) {
                insertItem.run(req.params.id, item.category || 'Uncategorized', item.name.trim(), item.qty, item.price)
            }
        })

        updateTransaction()

        const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id)
        const savedItems = db.prepare('SELECT * FROM receipt_items WHERE receipt_id = ?').all(req.params.id)

        res.json({ ...receipt, items: savedItems })
    } catch (err) {
        console.error('Error updating receipt:', err)
        res.status(500).json({ error: 'Failed to update receipt' })
    }
})

// DELETE /api/receipts/:id — Delete receipt
router.delete('/:id', (req, res) => {
    try {
        const userId = req.user.user_id
        const existing = db.prepare('SELECT * FROM receipts WHERE id = ? AND user_id = ?').get(req.params.id, userId)

        if (!existing) {
            return res.status(404).json({ error: 'Receipt not found' })
        }

        db.prepare('DELETE FROM receipts WHERE id = ? AND user_id = ?').run(req.params.id, userId)
        res.json({ message: 'Receipt deleted' })
    } catch (err) {
        console.error('Error deleting receipt:', err)
        res.status(500).json({ error: 'Failed to delete receipt' })
    }
})

export default router
