# Feedback Hub

A microservices-based feedback platform with **real-time sentiment analysis** and **MongoDB storage**.

It provides RESTful APIs using **Node.js + Express**, communicates with a **Python FastAPI sentiment service**, and persists data in **MongoDB**.

## Architecture Overview

```
Client Apps (Web, Mobile, Postman)
        │
        ▼
Node.js API (Port 3000)
  - CRUD endpoints for feedback
  - Calls Python sentiment service
        │
        ├── POST /analyze → Python FastAPI (Port 8000)
        └── MongoDB (Port 27017)
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/feedback` | List all feedback |
| GET | `/api/feedback/:id` | Get feedback by ID |
| POST | `/api/feedback` | Create feedback + sentiment |
| PUT | `/api/feedback/:id` | Update feedback |
| DELETE | `/api/feedback/:id` | Delete feedback |
| GET | `/api/stats` | Sentiment statistics |

### Sentiment Service

- FastAPI service at **Port 8000**
- Endpoint: `POST /analyze`
- Uses **VADER**
- Returns:

```json
{ "label": "positive", "score": 0.85 }
```

## How It Works

1. Client sends feedback: `{ text, user }`
2. Node API calls Python `/analyze`
3. Python computes sentiment using VADER
4. Node stores `{ message, user, sentiment }` in MongoDB
5. Client receives full object with sentiment included

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Option 2: Manual Setup

#### Run Python Service

```bash
cd python-service
pip install -r requirements.txt
uvicorn sentiment_service:app --port 8000
```

#### Run Node API

```bash
cd node-api
npm install
npm start
```

## Example Usage

### Create Feedback

```bash
curl -X POST http://localhost:3000/api/feedback   -H "Content-Type: application/json"   -d '{"text": "Great product!", "user": "Shayan"}'
```

### Get All Feedback

```bash
curl http://localhost:3000/api/feedback
```

### Get Statistics

```bash
curl http://localhost:3000/api/stats
```

## MongoDB Schema

```js
{
  user: String,
  message: String,
  sentiment: {
    label: String,
    score: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Project Structure

```
feedback-hub/
├── node-api/            # Express server
├── python-service/      # FastAPI sentiment service
├── docker-compose.yml   # Multi-service orchestration
└── README.md
```

## Technologies

- **Node.js + Express**
- **FastAPI (Python)**
- **MongoDB + Mongoose**
- **VADER Sentiment**
- **Docker**

## License

MIT License — free to use, modify, deploy.
