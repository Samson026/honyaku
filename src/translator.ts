import { Hono } from "hono";
import { Groq } from 'groq-sdk/client.js'

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN
const GROK_API_KEY = process.env.GROK_API_KEY

const reply = new Hono()
const groq = new Groq({ apiKey: GROK_API_KEY })

async function Translate(language: string, text: string) {
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // or 'mixtral-8x7b-32768'
        messages: [{ 
            role: 'user',
            content: `You are working as a translator to translate a message from one language to another on a text app. The language you need to translate to is ${language} and the text is: ${text} \
            There is no need for anything in the response apart from the translated text. And it should appear as if the original message was written in the translated language. As this is an app between friends keep the casualness \
            of the response to match the original message`
        }]
    })

    return String(response.choices[0].message.content)
}

async function ReplyToMessage(replyToken: string, text: string) {
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

reply.post('/', async (c) => {
  const data = await c.req.json();

  console.log(CHANNEL_ACCESS_TOKEN)

  for (const event of data.events) {
    if (event.type === 'message') {
        const translation = await Translate("Japanese", event.message.text)

        const profileRes = await fetch(
            `https://api.line.me/v2/bot/group/${event.source.groupId}/member/${event.source.userId}`,
            { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } }
        )

        const user = await profileRes.json();
        const reply = `${user.displayName}:\n${translation}`
        await ReplyToMessage(event.replyToken, reply)
    }
  }
  
  return c.json({status: "ok"})
})

export default reply