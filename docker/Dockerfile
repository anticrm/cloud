FROM node:alpine

WORKDIR /usr/src/server

# COPY package.json yarn.lock ./
# COPY packages/platform ./packages/platform
# COPY packages/platform-core ./packages/platform-core
COPY packages/server ./

RUN yarn

EXPOSE 18080

ARG mongodbUri='mongodb://localhost:27017'
ENV MONGODB_URI=$mongodbUri

CMD ["node", "lib/index.js"]
