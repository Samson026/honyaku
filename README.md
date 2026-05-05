# Honyaku

A LINE bot that translates messages to each user's preferred language using the Groq LLM API. User preferences are stored in DynamoDB.

## Setup

Set the following environment variables:

- `CHANNEL_ACCESS_TOKEN` — LINE bot channel access token
- `GROQ_API_KEY` — Groq API key

```bash
pnpm install
pnpm dev    # http://localhost:3000
```

## Deployment

Build and deploy the Docker image to AWS Lambda, then set the LINE webhook URL to the Lambda function URL.

## Usage

In a LINE group chat, use `/setLanguage <language>` to set your preferred translation language. The bot will automatically translate messages for you.
