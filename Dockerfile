# Stage 1: build the React/Vite frontend into static files
FROM node:22-slim AS frontend
WORKDIR /app/cinemalit-studio
COPY cinemalit-studio/package.json cinemalit-studio/package-lock.json ./
RUN npm ci
COPY cinemalit-studio/ ./
RUN npm run build

# Stage 2: Python app (serves API + the built frontend + in-process ADK agent)
FROM python:3.13-slim
WORKDIR /app

COPY . .
COPY --from=frontend /app/cinemalit-studio/dist ./cinemalit-studio/dist

RUN pip install --no-cache-dir python-dotenv google-genai google-auth requests PyJWT \
    && pip install --no-cache-dir -r cinemalit_agent/requirements.txt

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "-m", "web.server"]
