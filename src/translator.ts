import { Hono } from "hono";
import { AddUserToGroup, GetGroupMembers } from "./userSettingsDB.js";
import Anthropic from "@anthropic-ai/sdk";

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY

type RespItem = {
  type: "text",
  text: string
} 

const reply = new Hono()
const client = new Anthropic({
  apiKey: CLAUDE_API_KEY
})

async function Translate(language: string, text: string) {
  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ 
      role: "user",
      content: `You are working as a translator to translate a message from one language to another on a text app. The language you need to translate to is ${language} and the text is: ${text} \
            If the language of the current message is already in the target language, return "null"
            There is no need for anything in the response apart from the translated text. And it should appear as if the original message was written in the translated language. As this is an app between friends keep the casualness \
            of the response to match the original message` 
    }],
    model: "claude-sonnet-4-6"
  });

  for (const block of message.content) {
    if (block.type === "text") {
      return block.text
    }
  }
  throw new Error("no text block in Anthropic response")
}

async function ReplyToMessage(replyToken: string, resp: RespItem[]) {
  if (resp.length === 0) {
    return
  }

  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      replyToken,
      messages: resp
    })
  })
}

async function group_translate(event: any) {
  const groupID = event.source.groupId
  const groupMembers = await GetGroupMembers(groupID)
  var senderName = 'None';
  var messages: RespItem[] = []

  for (const user of groupMembers) {
    if (user.id === event.source.userId) {
      senderName = user.name;
      console.log(senderName)
    }
  }

  for (const user of groupMembers) {
    // dont translate for the user who sent the message
    if (user.id === event.source.userId) {
      continue
    }
    console.log(senderName)
    const translation = await Translate(user.lang, event.message.text)
    if (translation !== "null") {
      // message is not in target language
      const reply = `${senderName}:\n${translation}`
      messages.push({type: "text", text: reply})
    }
  }
  await ReplyToMessage(event.replyToken, messages)
}

async function set_language_reply(event: any) {
    const language = event.message.text.split(' ')[1]
    const userID = event.source.userId;
    const groupID = event.source.groupId
    const profileRes = await fetch(
      `https://api.line.me/v2/bot/group/${groupID}/member/${userID}`,
      { headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` } }
    )
    const user = await profileRes.json();

    await AddUserToGroup(userID, groupID, language, user.displayName)

    const reply = `set user: ${user.displayName}'s translation language to ${language}`
    await ReplyToMessage(event.replyToken, [{type: "text", text: reply}])
}

reply.post('/', async (c) => {
  const data = await c.req.json();

  for (const event of data.events) {
    if (event.type === 'message') {
        if (event.message.text.includes('/setLanguage')) {
            await set_language_reply(event)
        }
        else {
            await group_translate(event)
        }
    }
  }
  
  return c.json({status: "ok"})
})

export default reply