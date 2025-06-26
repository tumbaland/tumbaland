FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build
EXPOSE 5001
CMD ["node", "dist/index.js"]
