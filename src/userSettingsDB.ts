import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import z from "zod";
import {
	AWS_REGION,
	GROUP_PREFIX,
	HONYAKU_TABLE,
	MESSAGE_PREFIX,
	USER_PREFIX,
} from "./constants.js";
import type { MessageData } from "./translator.js";
import { ulid } from "ulid";
import { HTTPException } from "hono/http-exception";

const UserSchemaDB = z.object({
	pk: z.string(),
	sk: z.string(),
	lang: z.string(),
	user: z.string(),
});

export type UserDB = z.infer<typeof UserSchemaDB>;

const GroupSchema = z.array(UserSchemaDB);

export type User = {
	id: string;
	lang: string;
	name: string;
};

const MessageSchemaDb = z.object({
	user: z.string(),
	name: z.string(),
	message: z.string(),
})

export type MessageDB = z.infer<typeof MessageSchemaDb>

const client = new DynamoDBClient({ region: AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

export async function AddUserToGroup(
	userID: string,
	groupID: string,
	language: string,
	displayName: string,
) {
	await db.send(
		new PutCommand({
			TableName: HONYAKU_TABLE,
			Item: {
				pk: `${GROUP_PREFIX}${groupID}`,
				sk: `${USER_PREFIX}${userID}`,
				lang: language,
				name: displayName,
			},
		}),
	);
}

export async function GetGroupMembers(groupID: string) {
	const resp = await db.send(
		new QueryCommand({
			TableName: HONYAKU_TABLE,
			KeyConditionExpression: "pk = :pk",
			ExpressionAttributeValues: {
				":pk": `${GROUP_PREFIX}${groupID}`,
			},
		}),
	);
	const groupMembersDB = GroupSchema.parse(resp.Items);

	const groupMembers = groupMembersDB.map((user) => {
		return {
			id: user.sk.split("#")[1],
			lang: user.lang,
			name: user.name,
		} as User;
	});

	return groupMembers;
}

export async function CacheMessage(message: MessageData) {
	const messageUlid = ulid();

	await db.send(
		new PutCommand({
			TableName: HONYAKU_TABLE,
			Item: {
				pk: `${GROUP_PREFIX}#${message.groupID}`,
				sk: `${MESSAGE_PREFIX}#${messageUlid}`,
				user: message.user?.name,
				message: message.message
			}
		})
	)
}

export async function GetMessageCache(groupID: string) {
	const resp = await db.send(
		new QueryCommand({
			TableName: HONYAKU_TABLE,
			KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
			ExpressionAttributeValues: {
				":pk": `${GROUP_PREFIX}#${groupID}`,
				":prefix": `${MESSAGE_PREFIX}`
			},
			ScanIndexForward: false,
			Limit: 10
		})
	)

	if (!resp.Items || resp.Items.length === 0) {
		throw new HTTPException(404)
	}

	const messageCache = resp.Items.map((message) => MessageSchemaDb.parse(message))

	return messageCache
}
