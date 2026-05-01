import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN

async function reply(replyToken: String, text: String) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: 'text',
          text
        }
      ]
    })
  })
}

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/webhook', async (c) => {
  const data = await c.req.json();

  console.log(CHANNEL_ACCESS_TOKEN)

  for (const event of data.events) {
    if (event.type === 'message') {
      console.log(event.message.text)
      await reply(event.replyToken, event.message.text)
    }
  }
  
  return c.json({status: "ok"})
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
