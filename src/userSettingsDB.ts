import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import z from 'zod'
import { HONYAKU_TABLE } from './constants.js'

const UserSchemaDB = z.object({
  pk: z.string(),
  sk: z.string(),
  lang: z.string(),
  name: z.string()
})

export type UserDB = z.infer<typeof UserSchemaDB>

const GroupSchema = z.array(UserSchemaDB)

type GroupSchemaDB = z.infer<typeof GroupSchema>

type User = {
  id: string,
  lang: string,
  name: string
}


const client = new DynamoDBClient({ region: "ap-southeast-2"})
const db = DynamoDBDocumentClient.from(client)

export async function AddUserToGroup(userID: string, groupID: string, language: string, displayName: string) {
  await db.send(new PutCommand({
    TableName: HONYAKU_TABLE,
    Item: {
      pk: `GROUP#${groupID}`,
      sk: `USER#${userID}`,
      lang: language,
      name: displayName
    }
  }))
}

export async function GetGroupMembers(groupID: string) {
  const resp = await db.send(new QueryCommand({
    TableName: HONYAKU_TABLE,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": `GROUP#${groupID}`
    }
  }))
  const groupMembersDB = GroupSchema.parse(resp.Items)

  const groupMembers = groupMembersDB.map(user => {
    return {
      id: user.pk.split('#')[1],
      lang: user.lang,
      name: user.name
    } as User
  })

  return groupMembers
}