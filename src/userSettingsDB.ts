import { createClient } from '@libsql/client'
import z from 'zod'

const UserSchema = z.object({
  userId: z.string(),
  language: z.string()
})

type User = z.infer<typeof UserSchema>

const db = createClient({ url: 'file:mydb.db' })

await db.execute(`
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    language TEXT
  )
`)

export async function SetUserLanguage(userID: string, language: string) {
  await db.execute({ 
    sql: 'INSERT OR REPLACE INTO users (userId, language) VALUES (?, ?)', 
    args: [userID, language] 
  })
}

export async function ReadUserLanguage(userID: string) {
  const result = await db.execute({ 
    sql: 'SELECT * FROM users WHERE userId = ?', 
    args: [userID] 
  })
  const user = UserSchema.parse(result.rows[0])
  return user.language
}