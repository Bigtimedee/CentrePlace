FROM python:3.11-slim

# System deps needed by some financial data packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clone ai-hedge-fund and copy its src/ package into the container
# so we can import from hedge_fund_src.*
RUN git clone --depth 1 https://github.com/virattt/ai-hedge-fund.git /tmp/ai-hedge-fund \
    && cp -r /tmp/ai-hedge-fund/src /app/hedge_fund_src \
    && rm -rf /tmp/ai-hedge-fund

COPY . .

# Railway sets PORT; default to 8000 for local dev
ENV PORT=8000

EXPOSE $PORT

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
