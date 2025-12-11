FROM node:20-alpine

WORKDIR /app

# Copy package.json and bun.lockb (or package-lock.json)
COPY package.json ./

# Install dependencies
RUN npm install

COPY . .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]
