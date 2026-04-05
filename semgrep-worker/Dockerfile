FROM returntocorp/semgrep:latest

RUN apk add --no-cache nodejs npm git

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 4000

CMD ["node", "server.js"]
