# Stage 1: Build the React application
# Stage 1: Build the React application
FROM oven/bun:1-alpine as builder

WORKDIR /app

# Copy package.json and bun.lockb (or package-lock.json)
COPY package.json ./
# If you have a lock file, copy it too. Assuming bun.lockb based on file list, 
# but we'll use npm for standard docker build compatibility or install bun.
# Since the user has bun.lockb, it's best to use bun or just npm install if compatible.
# Let's stick to npm for broader compatibility unless bun is strictly required. 
# The package.json has no specific engine requirement.
COPY bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the build output to Nginx's html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
