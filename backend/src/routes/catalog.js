import express from 'express'
import db from '../db.js'

const router = express.Router()

// ===== CATEGORIES =====

// GET all categories
router.get('/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC').all(req.user.user_id)
        res.json(categories)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch categories' })
    }
})

// POST new category
router.post('/categories', (req, res) => {
    const { name } = req.body

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' })
    }

    try {
        const insert = db.prepare('INSERT INTO categories (user_id, name) VALUES (?, ?)')
        const result = insert.run(req.user.user_id, name.trim())

        const newCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid)
        res.status(201).json(newCategory)
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Category already exists' })
        }
        console.error(err)
        res.status(500).json({ error: 'Failed to create category' })
    }
})

// ===== PRODUCTS =====

// GET all products (join with category name)
router.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.user_id = ? 
            ORDER BY p.name ASC
        `).all(req.user.user_id)
        res.json(products)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch products' })
    }
})

// POST new product
router.post('/products', (req, res) => {
    const { name, category_id, default_price } = req.body

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Product name is required' })
    }

    try {
        // Validate category belongs to user if provided
        if (category_id) {
            const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.user_id)
            if (!cat) return res.status(400).json({ error: 'Invalid category' })
        }

        const insert = db.prepare(`
            INSERT INTO products (user_id, category_id, name, default_price) 
            VALUES (?, ?, ?, ?)
        `)
        const result = insert.run(
            req.user.user_id,
            category_id || null,
            name.trim(),
            default_price || 0
        )

        const newProduct = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `).get(result.lastInsertRowid)

        res.status(201).json(newProduct)
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Product already exists' })
        }
        console.error(err)
        res.status(500).json({ error: 'Failed to create product' })
    }
})

// PUT update product
router.put('/products/:id', (req, res) => {
    const { name, category_id, default_price } = req.body

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Product name is required' })
    }

    try {
        // Enforce ownership
        const existing = db.prepare('SELECT id FROM products WHERE id = ? AND user_id = ?').get(req.params.id, req.user.user_id)
        if (!existing) return res.status(404).json({ error: 'Product not found' })

        // Validate category belongs to user if provided
        if (category_id) {
            const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.user_id)
            if (!cat) return res.status(400).json({ error: 'Invalid category' })
        }

        const update = db.prepare(`
            UPDATE products 
            SET category_id = ?, name = ?, default_price = ? 
            WHERE id = ? AND user_id = ?
        `)
        update.run(
            category_id || null,
            name.trim(),
            default_price || 0,
            req.params.id,
            req.user.user_id
        )

        const updatedProduct = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `).get(req.params.id)

        res.json(updatedProduct)
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Product name already exists' })
        }
        console.error(err)
        res.status(500).json({ error: 'Failed to update product' })
    }
})

// DELETE product
router.delete('/products/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.user.user_id)
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found' })
        }
        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete product' })
    }
})

// DELETE category 
router.delete('/categories/:id', (req, res) => {
    try {
        // Note: Because products have ON DELETE SET NULL for category_id, 
        // deleting a category will safely un-categorize its products.
        const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(req.params.id, req.user.user_id)
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Category not found' })
        }
        res.json({ success: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete category' })
    }
})

export default router
