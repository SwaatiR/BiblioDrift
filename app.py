# Flask backend application with GoodReads mood analysis integration
# Initialize Flask app, configure CORS, and setup mood analysis endpoints

from flask import Flask, request, jsonify
from flask_cors import CORS
from ai_service import generate_book_note, get_ai_recommendations, get_book_mood_tags_safe
from collections import defaultdict, deque
from math import ceil
from time import time

# Try to import enhanced mood analysis
try:
    from mood_analysis.ai_service_enhanced import AIBookService
    MOOD_ANALYSIS_AVAILABLE = True
except ImportError:
    MOOD_ANALYSIS_AVAILABLE = False
    print("Mood analysis package not available - some endpoints will be disabled")

app = Flask(__name__)
CORS(app)

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 30
_request_log = defaultdict(deque)
_request_calls = 0


def _cleanup_expired_keys(cutoff: float) -> None:
    """Remove keys whose newest timestamp is already outside the window."""
    stale_keys = [key for key, dq in _request_log.items() if not dq or dq[-1] <= cutoff]
    for key in stale_keys:
        _request_log.pop(key, None)


def _rate_limited(endpoint: str) -> tuple[bool, int]:
    """Sliding window limiter per IP/endpoint, returns limit flag and wait time."""
    global _request_calls
    key = f"{request.remote_addr}|{endpoint}"
    now = time()
    window_start = now - RATE_LIMIT_WINDOW
    _request_calls += 1

    dq = _request_log[key]
    while dq and dq[0] <= window_start:
        dq.popleft()

    if len(dq) >= RATE_LIMIT_MAX_REQUESTS:
        oldest = dq[0]
        retry_after = max(1, ceil(RATE_LIMIT_WINDOW - (now - oldest)))
        return True, retry_after

    dq.append(now)

    if _request_calls % 100 == 0:
        _cleanup_expired_keys(window_start)

    return False, 0

# Initialize AI service if available
if MOOD_ANALYSIS_AVAILABLE:
    ai_service = AIBookService()

@app.route('/api/v1/analyze-mood', methods=['POST'])
def handle_analyze_mood():
    """Analyze book mood using GoodReads reviews."""
    limited, retry_after = _rate_limited('analyze_mood')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    if not MOOD_ANALYSIS_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "Mood analysis not available - missing dependencies"
        }), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        title = data.get('title', '')
        author = data.get('author', '')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        mood_analysis = ai_service.analyze_book_mood(title, author)
        
        if mood_analysis:
            return jsonify({
                "success": True,
                "mood_analysis": mood_analysis
            })
        else:
            return jsonify({
                "success": False,
                "error": "Could not analyze mood for this book"
            }), 404
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/mood-tags', methods=['POST'])
def handle_mood_tags():
    """Get mood tags for a book."""
    limited, retry_after = _rate_limited('mood_tags')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        title = data.get('title', '')
        author = data.get('author', '')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        mood_tags = get_book_mood_tags_safe(title, author)
        return jsonify({
            "success": True,
            "mood_tags": mood_tags
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/mood-search', methods=['POST'])
def handle_mood_search():
    """Search for books based on mood/vibe."""
    limited, retry_after = _rate_limited('mood_search')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        mood_query = data.get('query', '')
        
        if not mood_query:
            return jsonify({"error": "Query is required"}), 400
        
        recommendations = get_ai_recommendations(mood_query)
        return jsonify({
            "success": True,
            "recommendations": recommendations,
            "query": mood_query
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/generate-note', methods=['POST'])
def handle_generate_note():
    """Generate AI-powered book note with optional mood analysis."""
    limited, retry_after = _rate_limited('generate_note')
    if limited:
        response = jsonify({
            "success": False,
            "error": "Rate limit exceeded. Try again shortly.",
            "retry_after": retry_after
        })
        response.status_code = 429
        response.headers['Retry-After'] = retry_after
        return response
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON or missing request body"}), 400
            
        description = data.get('description', '')
        title = data.get('title', '')
        author = data.get('author', '')
        
        vibe = generate_book_note(description, title, author)
        return jsonify({"vibe": vibe})
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "BiblioDrift Mood Analysis API",
        "version": "1.0.0",
        "mood_analysis_available": MOOD_ANALYSIS_AVAILABLE
    })

if __name__ == '__main__':
    print("--- BIBLIODRIFT MOOD ANALYSIS SERVER STARTING ON PORT 5000 ---")
    print("Available endpoints:")
    print("  POST /api/v1/generate-note - Generate AI book notes")
    if MOOD_ANALYSIS_AVAILABLE:
        print("  POST /api/v1/analyze-mood - Analyze book mood from GoodReads")
        print("  POST /api/v1/mood-tags - Get mood tags for a book")
    else:
        print("  [DISABLED] Mood analysis endpoints (missing dependencies)")
    print("  POST /api/v1/mood-search - Search books by mood/vibe")
    print("  GET  /api/v1/health - Health check")
    app.run(debug=True, port=5000)