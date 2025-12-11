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
# Stage 2: Serve with Nginx
FROM alpine:latest

# Install Nginx and Zstd module
RUN apk add --no-cache nginx nginx-mod-http-zstd && \
    mkdir -p /run/nginx

# Copy the build output to Nginx's html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
