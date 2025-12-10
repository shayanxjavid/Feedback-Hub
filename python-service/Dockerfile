FROM python:3.11-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY sentiment_service.py ./

# Expose port
EXPOSE 8000

# Start the server
CMD ["uvicorn", "sentiment_service:app", "--host", "0.0.0.0", "--port", "8000"]
