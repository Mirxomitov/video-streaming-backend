# ---- build stage: compile TypeScript -> dist ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: node + ffmpeg, prod deps only ----
FROM node:22-alpine AS runtime
WORKDIR /app
# ffmpeg: the transcode worker shells out to it
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# scratch space for ffmpeg (download source -> transcode -> upload HLS)
RUN mkdir -p /tmp/transcode
EXPOSE 3000
CMD ["node", "dist/main"]
