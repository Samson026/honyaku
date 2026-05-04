import { Hono } from "hono";
import { Groq } from 'groq-sdk/client.js'
import { ReadUserLanguage, SetUserLanguage } from "./userSettingsDB.js";

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN
const GROQ_API_KEY = process.env.GROQ_API_KEY

const reply = new Hono()
const groq = new Groq({ apiKey: GROQ_API_KEY })

async function Translate(language: string, text: string) {
    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
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

async function translate_reply(event: any) {
    const language = await ReadUserLanguage(event.source.userId)
    const translation = await Translate(language, event.message.text)

    const profileRes = await fetch(
        `https://api.line.me/v2/bot/group/${event.source.groupId}/member/${event.source.userId}`,
        { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } }
    )

    const user = await profileRes.json();
    const reply = `${user.displayName}:\n${translation}`
    await ReplyToMessage(event.replyToken, reply)
}

async function set_language_reply(event: any) {
    const language = event.message.text.split(' ')[1]
    const userID = event.source.userId;
    await SetUserLanguage(userID, language)

    const profileRes = await fetch(
        `https://api.line.me/v2/bot/group/${event.source.groupId}/member/${event.source.userId}`,
        { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } }
    )
    const user = await profileRes.json();
    const reply = `set user: ${user.displayName}'s translation language to ${language}`
    await ReplyToMessage(event.replyToken, reply)
}

reply.post('/', async (c) => {
  const data = await c.req.json();

  for (const event of data.events) {
    if (event.type === 'message') {
        if (event.message.text.includes('setLanguage')) {
            await set_language_reply(event)
        }
        else {
            await translate_reply(event)
        }
    }
  }
  
  return c.json({status: "ok"})
})

export default reply