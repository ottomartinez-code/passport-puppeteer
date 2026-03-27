FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Railway injects PORT env var
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
