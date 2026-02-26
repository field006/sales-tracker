import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import receiptsRouter from './routes/receipts.js'
import authRouter from './routes/auth.js'
import catalogRouter from './routes/catalog.js'
import dashboardRouter from './routes/dashboard.js'
import { authMiddleware } from './routes/receipts.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRouter)
app.use('/api/receipts', receiptsRouter) // Note: authMiddleware is applied inside the router
app.use('/api/catalog', authMiddleware, catalogRouter)
app.use('/api/dashboard', authMiddleware, dashboardRouter)

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
})
