FROM --platform=linux/amd64 oven/bun:1 AS builder
WORKDIR /honyaku

COPY package*.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .
RUN bun build src/index.ts --outdir dist --target node --format cjs

FROM --platform=linux/arm64 public.ecr.aws/lambda/nodejs:22
WORKDIR ${LAMBDA_TASK_ROOT}

COPY --from=builder /honyaku/dist ./dist

CMD ["dist/index.handler"]
