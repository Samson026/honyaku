import { Hono } from "hono";
import {
	AddUserToGroup,
	CacheMessage,
	GetGroupMembers,
	GetMessageCache,
	type MessageDB,
	type User,
} from "./userSettingsDB.js";
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
	user: User | null;
	message: string;
	groupID: string;
};

const reply = new Hono();
const client = new Anthropic({
	apiKey: CLAUDE_API_KEY,
});

async function Translate(
	language: string,
	text: string,
	chatContext: MessageDB[],
) {
	const message = await client.messages.create({
		max_tokens: MAX_TOKENS,
		system: `You are a translator for a messaging app between friends.

			Translate the newest message into ${language}.

			The conversation history, if provided, is for context only. Use it to:
			- Resolve ambiguous pronouns or omitted subjects.
			- Maintain consistent names and terminology.
			- Preserve the speaker's intended tone, personality, and level of formality.
			- Choose the translation that best fits the surrounding conversation.

			If the newest message is already written in ${language}, return exactly "${TRANSLATION_NULL_SENTINEL}" and nothing else.

			Your translation should read as though it were originally written in ${language}. Preserve the original meaning, tone, casualness, emojis, punctuation, and formatting wherever possible.

			Do not explain the translation.
			Do not answer the message.
			Do not continue the conversation.
			Do not translate the conversation history.
			Do not add "" to the translation.

			Return only the translated text (or "${TRANSLATION_NULL_SENTINEL}" if no translation is needed).`,
		messages: [
			{
				role: "user",
				content: `
					Chat context:
					<${JSON.stringify([...chatContext].reverse())}>

					Newest message:

					<${text}>
				`,
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
		user: null,
		message: event.message.text,
		groupID: groupID,
	} as MessageData;

	var messages: RespItem[] = [];

	for (const user of groupMembers) {
		if (user.id === event.source.userId) {
			messageData.user = user;
		}
	}

	// get chat context
	const chatContext = await GetMessageCache(messageData.groupID);

	for (const user of groupMembers) {
		// dont translate for the user who sent the message
		if (user.id === event.source.userId) {
			continue;
		}

		const translation = await Translate(
			user.lang,
			messageData.message,
			chatContext,
		);
		
		// message in target language
		// or from the sender
		if (translation === TRANSLATION_NULL_SENTINEL || user.id === messageData.user?.id) {
			continue
		}

		// message is in target language
		const reply = `${messageData.user?.name ?? "Unknown"}:\n${translation}`;
		messages.push({ type: "text", text: reply });
	}
	await ReplyToMessage(event.replyToken, messages);

	//cache message
	await CacheMessage(messageData);
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
