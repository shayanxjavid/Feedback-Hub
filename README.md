# Feedback Hub

Microservices-based feedback platform with **real-time sentiment analysis** and **MongoDB storage**.

Provides RESTful APIs using **Node.js + Express**, communicates with a **Python FastAPI sentiment service**, and persists data in **MongoDB**.

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

## What it does

1. Client sends feedback: `{ text, user }`
2. Node API calls Python `/analyze`
3. Python computes sentiment using VADER
4. Node stores `{ message, user, sentiment }` in MongoDB
5. Client receives full object with sentiment included

## Quick Start

Docker

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
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

## Technologies

- **Node.js + Express**
- **FastAPI (Python)**
- **MongoDB + Mongoose**
- **VADER Sentiment**
- **Docker**
