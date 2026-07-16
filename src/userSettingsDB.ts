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
	USER_PREFIX,
} from "./constants.js";

const UserSchemaDB = z.object({
	pk: z.string(),
	sk: z.string(),
	lang: z.string(),
	name: z.string(),
});

export type UserDB = z.infer<typeof UserSchemaDB>;

const GroupSchema = z.array(UserSchemaDB);

type User = {
	id: string;
	lang: string;
	name: string;
};

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
