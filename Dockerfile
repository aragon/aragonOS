FROM node:boron

#RUN apt-get update && apt-get install -y build-essential python-software-properties software-properties-common
RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

#RUN curl --silent https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
#RUN add-apt-repository -y -r ppa:chris-lea/node.js
#RUN echo "deb http://deb.nodesource.com/node_6.x jessie main" | tee /etc/apt/sources.list.d/nodesource.list

#RUN apt-get update && apt-get install -y nodejs build-essential
#RUN npm install -g npm

COPY package.json /usr/src/app

RUN npm install -g truffle
RUN npm install truffle@beta
RUN npm i

COPY . /usr/src/app

RUN rm -rf contracts/zeppelin


ENTRYPOINT ["bash", "./entrypoint.sh"]
CMD ["bash"]
