FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copying all files for good measure, though they will be overridden by the volume mount in dev
COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
