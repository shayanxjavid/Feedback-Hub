#!/bin/bash
# =============================================================================
# Feedback Hub - Integration Test Script (MongoDB Edition)
# =============================================================================
# This script tests both services and demonstrates the full workflow.
# Run this after starting all services (MongoDB, Python, Node.js).

BASE_URL="http://localhost:3000"
SENTIMENT_URL="http://localhost:8000"

echo "═══════════════════════════════════════════════════════════"
echo "  🧪 Feedback Hub Integration Tests (MongoDB Edition)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Health checks
echo "1️⃣  Testing Health Endpoints"
echo "────────────────────────────────────────────────────────────"
echo "Python Service:"
curl -s "$SENTIMENT_URL/health" | python3 -m json.tool 2>/dev/null || echo "   Python service not responding"
echo ""
echo "Node.js API (with DB status):"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || echo "   Node.js API not responding"
echo ""

# Test 2: Direct sentiment analysis
echo "2️⃣  Testing Direct Sentiment Analysis"
echo "────────────────────────────────────────────────────────────"
curl -s -X POST "$SENTIMENT_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this!"}' | python3 -m json.tool
echo ""

# Test 3: Create feedback entries
echo "3️⃣  Creating Feedback Entries"
echo "────────────────────────────────────────────────────────────"

echo "→ Positive feedback:"
POSITIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this product! It exceeded all my expectations!", "user": "Shayan"}')
echo "$POSITIVE_RESPONSE" | python3 -m json.tool
FEEDBACK_ID=$(echo "$POSITIVE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
echo ""

echo "→ Negative feedback:"
curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"text": "Terrible experience. The product broke after one day.", "user": "Alex"}' | python3 -m json.tool
echo ""

echo "→ Neutral feedback:"
curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"text": "The package arrived on Thursday.", "user": "Jordan"}' | python3 -m json.tool
echo ""

echo "→ Another positive:"
curl -s -X POST "$BASE_URL/api/feedback" \
  -H "Content-Type: application/json" \
  -d '{"text": "Fantastic customer service! Will buy again!", "user": "Shayan"}' | python3 -m json.tool
echo ""

# Test 4: Retrieve all feedback
echo "4️⃣  Retrieving All Feedback"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/feedback" | python3 -m json.tool
echo ""

# Test 5: Get single feedback by ID
if [ -n "$FEEDBACK_ID" ]; then
  echo "5️⃣  Getting Feedback by ID ($FEEDBACK_ID)"
  echo "────────────────────────────────────────────────────────────"
  curl -s "$BASE_URL/api/feedback/$FEEDBACK_ID" | python3 -m json.tool
  echo ""
fi

# Test 6: Filter by sentiment
echo "6️⃣  Filtering by Sentiment (positive only)"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/feedback?sentiment=positive" | python3 -m json.tool
echo ""

# Test 7: Filter by user
echo "7️⃣  Filtering by User (Shayan)"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/feedback?user=Shayan" | python3 -m json.tool
echo ""

# Test 8: Get user's feedback via dedicated endpoint
echo "8️⃣  Getting User's Feedback (/api/users/Shayan/feedback)"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/users/Shayan/feedback" | python3 -m json.tool
echo ""

# Test 9: Update feedback
if [ -n "$FEEDBACK_ID" ]; then
  echo "9️⃣  Updating Feedback"
  echo "────────────────────────────────────────────────────────────"
  curl -s -X PUT "$BASE_URL/api/feedback/$FEEDBACK_ID" \
    -H "Content-Type: application/json" \
    -d '{"text": "Updated: Still absolutely love this product!"}' | python3 -m json.tool
  echo ""
fi

# Test 10: Get statistics
echo "🔟  Getting Sentiment Statistics"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/stats" | python3 -m json.tool
echo ""

# Test 11: Pagination
echo "1️⃣1️⃣  Testing Pagination (limit=2, offset=0)"
echo "────────────────────────────────────────────────────────────"
curl -s "$BASE_URL/api/feedback?limit=2&offset=0" | python3 -m json.tool
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  Tests Complete!"
echo "═══════════════════════════════════════════════════════════"
