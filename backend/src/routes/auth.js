import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const router = express.Router()

// Ideally this should be in .env, but for a simple SQLite free deploy, a hard fallback is safer if .env isn't loaded properly
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key_for_invoice_app'

// LOGIN
router.post('/login', async (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

        if (!user) {
            return res.status(401).json({ error: 'Incorrect username or password. Please try again.' })
        }

        const isMatch = await bcrypt.compare(password, user.password_hash)
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect username or password. Please try again.' })
        }

        const token = jwt.sign({ user_id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })

        res.json({
            user: { id: user.id, username: user.username },
            token
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error during login' })
    }
})

// GET CURRENT USER (/me)
router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, JWT_SECRET)

        const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(decoded.user_id)
        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        res.json({ user })
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' })
    }
})

// CHANGE PASSWORD
router.put('/change-password', async (req, res) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const { old_password, new_password } = req.body

    if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Both old and new passwords are required' })
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.user_id)

        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        const isMatch = await bcrypt.compare(old_password, user.password_hash)
        if (!isMatch) {
            return res.status(401).json({ error: 'Incorrect old password' })
        }

        const newHash = await bcrypt.hash(new_password, 10)
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id)

        res.json({ message: 'Password changed successfully' })
    } catch (err) {
        console.error(err)
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' })
        }
        res.status(500).json({ error: 'Server error' })
    }
})

export default router
