FROM node:25.8.1-slim AS builder
WORKDIR /honyaku

COPY package*.json ./

RUN npm install

COPY . .
RUN npm run build

FROM node:25.8.1-slim
WORKDIR /honyaku

COPY package*.json ./
COPY --from=builder ./honyaku/dist ./dist

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "./dist/index.js"]