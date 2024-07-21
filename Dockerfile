FROM node:22.5.1

# install node.js application
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY ./index.js ./

ENTRYPOINT ["node", "index.js"]
