FROM python:3.11-slim

# System deps needed by some financial data packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway sets PORT; default to 8000 for local dev
ENV PORT=8000

EXPOSE $PORT

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
