# Build the static site, then serve it with nginx.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The Census API key is compiled into the client bundle (Census keys are rate-limit
# only, not secret). Pass it at build time: --build-arg VITE_CENSUS_KEY=...
ARG VITE_CENSUS_KEY
ENV VITE_CENSUS_KEY=$VITE_CENSUS_KEY
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
