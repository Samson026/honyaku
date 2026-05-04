FROM --platform=linux/amd64 node:22-slim AS builder
WORKDIR /honyaku

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN npm run build

FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}

COPY package*.json pnpm-lock.yaml ./
COPY --from=builder /honyaku/dist ./dist

RUN npm install -g pnpm
RUN pnpm install --prod

CMD ["dist/index.handler"]
