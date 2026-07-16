# honyaku (翻訳)

> LINE group translation bot powered by Anthropic Claude

honyaku is a serverless messaging bot that lives in LINE group chats and automatically translates each message to every member's preferred language. When someone sends a message, the bot translates it into each member's language and replies with personalized translations.

Named after 翻訳 (*hon'yaku*), the Japanese word for "translation."

## How It Works

```
┌──────────┐    POST /webhook    ┌──────────────┐    API call    ┌──────────┐
│  LINE    │ ──────────────────► │  API Gateway │ ─────────────► │  Lambda  │
│  User    │                     │              │                │ (Hono)   │
└──────────┘                     └──────────────┘                └─────┬────┘
                                                                        │
                                                        ┌───────────────┼───────────────┐
                                                        ▼                       ▼
                                                   ┌────────────┐       ┌──────────────┐
                                                   │   Claude   │       │  DynamoDB  │
                                                   │   API      │       │  (user lang│
                                                   │            │       │   settings) │
                                                   └────────────┘       └──────────────┘
                                                                        │
                                                        ┌───────────────┼───────────────┐
                                                        ▼                       ▼
                                                   ┌──────────┐      ┌──────────────────┐
                                                   │  LINE    │◄─────│ per-member        │
                                                   │  Reply   │      │ translations      │
                                                   └──────────┘      └──────────────────┘
```

1. A user sends a message in a LINE group
2. The bot queries DynamoDB to find all group members and their preferred translation languages
3. For each member (except the sender), the bot translates the message using Anthropic Claude
4. The bot replies to the group with individual translations for each member

## Commands

| Command | Description |
|---------|-------------|
| `/setLanguage <lang>` | Set your translation target language (e.g., `/setLanguage en`) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | TypeScript + Bun |
| **Framework** | Hono.js |
| **LLM** | Anthropic Claude (sonnet) |
| **Hosting** | AWS Lambda (container image) |
| **Database** | DynamoDB |
| **Infra** | Terraform |
| **CI** | GitHub Actions (lint + format) |

## Prerequisites

- **LINE Developer Account** — Create a messaging channel to get a channel access token
- **Anthropic API Key** — Sign up at [console.anthropic.com](https://console.anthropic.com)
- **AWS Account** — With access to Lambda, DynamoDB, ECR, API Gateway
- **Terraform** — For infrastructure provisioning
- **Bun** — For local development

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CHANNEL_ACCESS_TOKEN` | LINE Messaging API channel access token |
| `CLAUDE_API_KEY` | Anthropic API key |
| `HONYAKU_TABLE` | DynamoDB table name for user settings (default: `honyakuUsers`) |

## Development

```bash
# Install dependencies
bun install

# Start development server (with file watching)
bun run dev

# Build for production
bun run build

# Lint and format
bun run lint
bun run fix
bun run format
```

## Deployment

### Infrastructure

Terraform provisions the following AWS resources:

- **Lambda Function** — ARM64 container image (512 MB, 30s timeout)
- **ECR Repository** — Stores the container image
- **API Gateway (HTTP)** — Routes webhook POST requests to Lambda
- **DynamoDB Table** — Stores user language preferences
- **IAM Role** — Lambda execution role with DynamoDB access
- **CloudWatch Log Group** — 14-day retention

```bash
cd terra
terraform init
terraform apply
```

### Docker

Multi-stage build produces a minimal ARM64 Lambda container:

```bash
docker build -t honyaku:latest .
```

## Project Structure

```
├── src/                    # Application source
│   ├── index.ts            # Hono app entry, Lambda handler
│   ├── translator.ts       # Translation logic, LINE webhook handler
│   ├── userSettingsDB.ts   # DynamoDB user/group operations
│   └── constants.ts        # Configuration constants
├── terra/                  # Terraform infrastructure
│   ├── main.tf             # Lambda, API Gateway, DynamoDB, IAM
│   ├── providers.tf        # AWS provider config
│   └── variables.tf        # Input variables
├── Dockerfile              # Multi-stage Lambda container build
├── package.json
└── tsconfig.json
```

## License

MIT
