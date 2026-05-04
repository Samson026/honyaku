import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import z from 'zod'

const UserSchema = z.object({
  lang: z.string()
})

type User = z.infer<typeof UserSchema>

const client = new DynamoDBClient({ region: "ap-southeast-2"})
const db = DynamoDBDocumentClient.from(client)


export async function SetUserLanguage(userID: string, language: string) {
  await db.send(new PutCommand({
    TableName: "honyakuUsers",
    Item: {
      pk: `USER#${userID}`,
      sk: "SETTINGS#",
      lang: language
    }
  }))
}

export async function ReadUserLanguage(userID: string) {
  const resp = await db.send(new GetCommand({
    TableName: "honyakuUsers",
    Key: {
      pk: `USER#${userID}`,
      sk: "SETTINGS#"
    }
  }))

  const user = UserSchema.parse(resp.Item)
  return user.lang
}