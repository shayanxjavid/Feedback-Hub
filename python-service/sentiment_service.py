"""
Feedback Hub - Python Sentiment Analysis Microservice

FastAPI service that performs sentiment analysis on text using VADER.
VADER (Valence Aware Dictionary and sEntiment Reasoner) is specifically
attuned to sentiments expressed in social media and works well for
general text analysis.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from datetime import datetime
from typing import Literal
import uvicorn

# =============================================================================
# FastAPI App Setup
# =============================================================================

app = FastAPI(
    title="Sentiment Analysis Service",
    description="Microservice for analyzing text sentiment using VADER",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for cross-origin requests from Node.js API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize VADER sentiment analyzer
analyzer = SentimentIntensityAnalyzer()

# =============================================================================
# Pydantic Models (Request/Response Schemas)
# =============================================================================

class TextInput(BaseModel):
    """Input model for text to analyze"""
    text: str = Field(
        ..., 
        min_length=1, 
        max_length=10000,
        description="The text to analyze for sentiment",
        examples=["I love this product! It's amazing!"]
    )


class SentimentResult(BaseModel):
    """Output model for sentiment analysis results"""
    label: Literal["positive", "neutral", "negative"] = Field(
        ...,
        description="Sentiment classification"
    )
    score: float = Field(
        ..., 
        ge=0, 
        le=1,
        description="Confidence score from 0 to 1"
    )
    details: dict = Field(
        default_factory=dict,
        description="Detailed VADER scores (optional)"
    )


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    service: str
    timestamp: str


# =============================================================================
# Helper Functions
# =============================================================================

def analyze_text(text: str) -> SentimentResult:
    """
    Analyze sentiment of text using VADER.
    
    VADER returns a compound score between -1 (most negative) and +1 (most positive).
    We convert this to a label and normalized score:
    
    - compound >= 0.05  → positive
    - compound <= -0.05 → negative  
    - otherwise         → neutral
    
    The score is normalized to 0-1 range representing confidence/intensity.
    
    Args:
        text: The text to analyze
        
    Returns:
        SentimentResult with label, score, and detailed breakdown
    """
    # Get VADER scores
    scores = analyzer.polarity_scores(text)
    compound = scores["compound"]
    
    # Determine label based on compound score
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    
    # Convert compound score (-1 to 1) to confidence (0 to 1)
    # Higher absolute value = higher confidence
    # We map: -1 → 0, 0 → 0.5, 1 → 1
    normalized_score = round((compound + 1) / 2, 2)
    
    return SentimentResult(
        label=label,
        score=normalized_score,
        details={
            "compound": round(compound, 4),
            "positive": round(scores["pos"], 4),
            "negative": round(scores["neg"], 4),
            "neutral": round(scores["neu"], 4)
        }
    )


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Sentiment Analysis Microservice",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "analyze": "POST /analyze"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    
    Returns service status for monitoring and load balancer health checks.
    """
    return HealthResponse(
        status="healthy",
        service="sentiment-analyzer",
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


@app.post("/analyze", response_model=SentimentResult, tags=["Analysis"])
async def analyze_sentiment(input_data: TextInput):
    """
    Analyze the sentiment of provided text.
    
    Uses VADER (Valence Aware Dictionary and sEntiment Reasoner) to classify
    text as positive, neutral, or negative with a confidence score.
    
    **Request Body:**
    - `text`: The text to analyze (1-10000 characters)
    
    **Response:**
    - `label`: "positive", "neutral", or "negative"
    - `score`: Confidence score from 0 to 1
    - `details`: Detailed VADER breakdown (compound, pos, neg, neu)
    
    **Example:**
    ```json
    {"text": "I love this product!"}
    ```
    
    **Returns:**
    ```json
    {"label": "positive", "score": 0.87, "details": {...}}
    ```
    """
    try:
        result = analyze_text(input_data.text)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sentiment analysis failed: {str(e)}"
        )


@app.post("/analyze/batch", tags=["Analysis"])
async def analyze_batch(texts: list[TextInput]):
    """
    Analyze sentiment for multiple texts at once.
    
    Accepts an array of text objects and returns an array of sentiment results.
    Useful for bulk processing.
    
    **Request Body:**
    ```json
    [{"text": "Great product!"}, {"text": "Terrible experience."}]
    ```
    """
    if len(texts) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 texts allowed per batch request"
        )
    
    results = []
    for item in texts:
        try:
            result = analyze_text(item.text)
            results.append(result)
        except Exception as e:
            results.append({
                "error": str(e),
                "text": item.text[:50] + "..."
            })
    
    return {"results": results}


# =============================================================================
# Run Server
# =============================================================================

if __name__ == "__main__":
    print("=" * 50)
    print("Sentiment Analysis Microservice")
    print("=" * 50)
    print("Running at: http://localhost:8000")
    print("API Docs:   http://localhost:8000/docs")
    print("=" * 50)
    
    uvicorn.run(
        "sentiment_service:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
