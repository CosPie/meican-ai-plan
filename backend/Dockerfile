FROM oven/bun:1-alpine

WORKDIR /app

# Copy package.json and bun.lockb (or package-lock.json)
COPY package.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

COPY . .

# Expose the port the app runs on
EXPOSE 8100

# Command to run the application
CMD ["bun", "src/index.ts"]
