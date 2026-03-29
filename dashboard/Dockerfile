FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache apache2-utils
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
ENV BACKEND_URL=http://localhost:8000
ENV DASHBOARD_USER=admin
ENV DASHBOARD_PASSWORD=changeme
EXPOSE 80
# Generate htpasswd, inject backend URL, then start nginx
CMD ["/bin/sh", "-c", "htpasswd -cb /etc/nginx/.htpasswd \"$DASHBOARD_USER\" \"$DASHBOARD_PASSWORD\" && sed -i \"s|</head>|<script>window.__API_URL__='${BACKEND_URL}';</script></head>|\" /usr/share/nginx/html/index.html && nginx -g 'daemon off;'"]
