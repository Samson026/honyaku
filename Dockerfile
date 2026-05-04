FROM node:25.8.1-slim AS builder
WORKDIR /honyaku

COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN npm run build

FROM node:25.8.1-slim
WORKDIR /honyaku

COPY package*.json pnpm-lock.yaml ./
COPY --from=builder ./honyaku/dist ./dist

RUN npm install -g pnpm
RUN pnpm install --prod

EXPOSE 3000

CMD ["node", "./dist/index.js"]