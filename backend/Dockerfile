FROM node:22-slim

WORKDIR /app

# Dependencies are pre-installed locally; copy everything in one step
COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
