import { Hono } from "hono";
import { AddUserToGroup, GetGroupMembers } from "./userSettingsDB.js";
import Anthropic from "@anthropic-ai/sdk";
import {
	ANTHROPIC_MODEL,
	LINE_API_BASE,
	MAX_TOKENS,
	SET_LANGUAGE_COMMAND,
	TRANSLATION_NULL_SENTINEL,
} from "./constants.js";

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

type RespItem = {
	type: "text";
	text: string;
};

type LineSource = {
	type: "user" | "group" | "room";
	userId: string;
	groupId: string;
};

type LineMessageEvent = {
	type: "message";
	replyToken: string;
	source: LineSource;
	message: { type: "text"; text: string };
};

export type MessageData = {
	user: string;
	message: string;
	groupID: string;
};

const reply = new Hono();
const client = new Anthropic({
	apiKey: CLAUDE_API_KEY,
});



async function Translate(language: string, text: string) {
	const message = await client.messages.create({
		max_tokens: MAX_TOKENS,
		messages: [
			{
				role: "user",
				content: `You are working as a translator to translate a message from one language to another on a text app. The language you need to translate to is ${language} and the text is: ${text} \
            If the language of the current message is already in the target language, return "${TRANSLATION_NULL_SENTINEL}"
            There is no need for anything in the response apart from the translated text. And it should appear as if the original message was written in the translated language. As this is an app between friends keep the casualness \
            of the response to match the original message`,
			},
		],
		model: ANTHROPIC_MODEL,
	});

	for (const block of message.content) {
		if (block.type === "text") {
			return block.text;
		}
	}
	throw new Error("no text block in Anthropic response");
}

async function ReplyToMessage(replyToken: string, resp: RespItem[]) {
	if (resp.length === 0) {
		return;
	}

	await fetch(`${LINE_API_BASE}/message/reply`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			replyToken,
			messages: resp,
		}),
	});
}

async function group_translate(event: LineMessageEvent) {
	const groupID = event.source.groupId;
	const groupMembers = await GetGroupMembers(groupID);
	var messageData = {
		user: "None",
		message: event.message.text,
		groupID: groupID
	} as MessageData;

	var messages: RespItem[] = [];

	for (const user of groupMembers) {
		if (user.id === event.source.userId) {
			messageData.user = user.name;
		}
	}

	// cache message


	for (const user of groupMembers) {
		// dont translate for the user who sent the message
		if (user.id === event.source.userId) {
			continue;
		}

		const translation = await Translate(user.lang, event.message.text);
		if (translation !== TRANSLATION_NULL_SENTINEL) {
			// message is not in target language
			const reply = `${messageData.user}:\n${translation}`;
			messages.push({ type: "text", text: reply });
		}
	}
	await ReplyToMessage(event.replyToken, messages);
}

async function set_language_reply(event: LineMessageEvent) {
	const language = event.message.text.split(" ")[1];
	const userID = event.source.userId;
	const groupID = event.source.groupId;
	const profileRes = await fetch(
		`${LINE_API_BASE}/group/${groupID}/member/${userID}`,
		{ headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` } },
	);
	const user = await profileRes.json();

	await AddUserToGroup(userID, groupID, language, user.displayName);

	const reply = `set user: ${user.displayName}'s translation language to ${language}`;
	await ReplyToMessage(event.replyToken, [{ type: "text", text: reply }]);
}

reply.post("/", async (c) => {
	const data = await c.req.json();

	for (const event of data.events) {
		if (event.type === "message") {
			if (event.message.text.includes(SET_LANGUAGE_COMMAND)) {
				await set_language_reply(event);
			} else {
				await group_translate(event);
			}
		}
	}

	return c.json({ status: "ok" });
});

export default reply;
