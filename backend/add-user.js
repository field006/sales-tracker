import db from './src/db.js'
import bcrypt from 'bcryptjs'

// Get arguments from command line
const [, , username, password] = process.argv

if (!username || !password) {
    console.log('Usage: npm run add-user <username> <password>')
    console.log('Example: npm run add-user john mypassword123')
    process.exit(1)
}

try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
        console.error(`❌ Error: User '${username}' already exists!`)
        process.exit(1)
    }

    // Hash the password securely
    const hashedPass = bcrypt.hashSync(password, 10)

    // Insert into database
    const insert = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    const info = insert.run(username, hashedPass)

    console.log(`✅ Success! User '${username}' created with ID: ${info.lastInsertRowid}`)
} catch (error) {
    console.error('❌ Failed to add user:', error.message)
    process.exit(1)
}
