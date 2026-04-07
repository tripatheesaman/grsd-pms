FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
COPY next.config.ts ./next.config.ts
COPY postcss.config.mjs ./postcss.config.mjs
COPY eslint.config.mjs ./eslint.config.mjs
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

