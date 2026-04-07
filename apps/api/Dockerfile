FROM python:3.12-slim

WORKDIR /app

# Install system deps for FastF1 / numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create cache dir for FastF1
RUN mkdir -p /app/cache

EXPOSE ${PORT:-8000}

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
