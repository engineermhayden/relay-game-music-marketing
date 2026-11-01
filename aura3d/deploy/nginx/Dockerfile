FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
COPY shared/ /shared/
RUN npm run build
FROM nginx:1.28-alpine
COPY deploy/nginx/default.conf /etc/nginx/templates/default.conf.template
COPY deploy/nginx/19-admin-url.envsh /docker-entrypoint.d/19-admin-url.envsh
RUN sed -i 's/\r$//' /docker-entrypoint.d/19-admin-url.envsh && chmod +x /docker-entrypoint.d/19-admin-url.envsh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
