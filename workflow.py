from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import requests
from datetime import datetime
import uuid
from pymongo import MongoClient
import os
import time
import sys
import json
from bson import ObjectId

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app = Flask(__name__)
app.json_encoder = MongoJSONEncoder  # Use our custom encoder
CORS(app)

# MongoDB Connection with retry logic
def connect_to_mongodb(max_retries=3, retry_delay=2):
    for attempt in range(max_retries):
        try:
            client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
            # Test the connection
            client.server_info()
            print("Connected to MongoDB successfully")
            return client
        except Exception as e:
            print(f"Attempt {attempt + 1} failed to connect to MongoDB: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                print("Failed to connect to MongoDB after all retries")
                sys.exit(1)

try:
    client = connect_to_mongodb()
    db = client['project']
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    sys.exit(1)

# Collections
mentees_collection = db['mentees']
mentors_collection = db['mentors']
doubts_collection = db['doubts']
matches_collection = db['matches']
sessions_collection = db['sessions']

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Check MongoDB connection
        client.server_info()
        
        # Check if all required collections exist and are accessible
        collections = {
            'mentees': mentees_collection,
            'mentors': mentors_collection,
            'doubts': doubts_collection,
            'matches': matches_collection,
            'sessions': sessions_collection
        }
        
        collection_status = {}
        for name, collection in collections.items():
            try:
                # Try to perform a simple operation on each collection
                collection.find_one()
                collection_status[name] = "available"
            except Exception as e:
                collection_status[name] = f"error: {str(e)}"
                return jsonify({
                    "status": "unhealthy",
                    "service": "workflow",
                    "error": f"Collection {name} is not accessible",
                    "details": str(e),
                    "timestamp": datetime.now().isoformat()
                }), 500
            
        return jsonify({
            "status": "healthy",
            "service": "workflow",
            "timestamp": datetime.now().isoformat(),
            "dependencies": {
                "mongodb": "connected",
                "collections": collection_status
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "service": "workflow",
            "error": "MongoDB connection failed",
            "details": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/submit_doubt', methods=['POST'])
def submit_doubt():
    try:
        data = request.get_json()
        mentee_id = data.get('mentee_id')
        doubt_text = data.get('doubt')
        subject = data.get('subject')
        topic = data.get('topic')
        difficulty_level = data.get('difficulty_level', 'intermediate')

        if not all([mentee_id, doubt_text, subject, topic]):
            return jsonify({"error": "Missing required fields"}), 400

        # Create doubt document
        doubt_data = {
            "_id": f"doubt_{uuid.uuid4().hex[:6]}",
            "mentee_id": mentee_id,
            "subject": subject,
            "topic": topic,
            "description": doubt_text,
            "priority": "high",
            "status": "pending",
            "created_at": datetime.now(),
            "tags": [subject, topic],
            "preferred_time_slots": ["morning", "evening"],
            "duration_needed": 60,
            "matched_mentors": [],
            "category": "Programming",
            "subcategory": subject,
            "difficulty_level": difficulty_level,
            "context": {
                "learning_stage": "beginner",
                "previous_attempts": 0,
                "specific_issues": [],
                "code_snippet": "",
                "error_messages": []
            },
            "matching_criteria": {
                "required_expertise_level": 4,
                "preferred_mentor_experience": 5,
                "topic_specific_requirements": [topic],
                "teaching_style_preference": "practical",
                "language_preference": "English"
            }
        }

        # Insert doubt into database
        doubts_collection.insert_one(doubt_data)
        doubt_id = doubt_data["_id"]

        # Get mentee data
        mentee = mentees_collection.find_one({"_id": mentee_id})
        if not mentee:
            return jsonify({"error": "Mentee not found"}), 404

        # Get available mentors
        mentors = list(mentors_collection.find({"skills": {"$in": [topic.lower()]}}))
        if not mentors:
            return jsonify({
                "status": "offline",
                "message": "No mentors available for this topic"
            }), 200

        # Find best matching mentor
        best_match = None
        best_score = 0

        for mentor in mentors:
            # Calculate compatibility score
            skill_match = len(set(mentee.get('skills', [])) & set(mentor.get('skills', []))) / len(set(mentee.get('skills', [])) | set(mentor.get('skills', [])))
            experience_match = min(mentor.get('experience', 0) / mentee.get('experience', 1), 1)
            location_match = 1 if mentee.get('location') == mentor.get('location') else 0
            workload_score = 1 - (mentor.get('workload', 0) / 5)

            # Calculate total score
            total_score = (skill_match * 0.4 + experience_match * 0.3 + location_match * 0.2 + workload_score * 0.1)

            if total_score > best_score:
                best_score = total_score
                best_match = mentor

        if best_match:
            # Create match document
            match_data = {
                "_id": f"match_{uuid.uuid4().hex[:6]}",
                "mentor_id": best_match["_id"],
                "mentee_id": mentee_id,
                "doubt_id": doubt_id,
                "status": "active",
                "match_score": best_score,
                "created_at": datetime.now()
            }

            # Insert match into database
            matches_collection.insert_one(match_data)

            # Create session
            session_data = {
                "_id": f"session_{uuid.uuid4().hex[:6]}",
                "match_id": match_data["_id"],
                "status": "scheduled",
                "start_time": datetime.now(),
                "duration": 60,
                "topic": topic,
                "notes": f"Focus on {topic}",
                "feedback": None
            }

            sessions_collection.insert_one(session_data)

            # Update mentor's workload
            mentors_collection.update_one(
                {"_id": best_match["_id"]},
                {"$inc": {"workload": 1}}
            )

            return jsonify({
                "status": "success",
                "match_id": match_data["_id"],
                "mentor": {
                    "name": best_match.get("name", "Unknown"),
                    "skills": best_match.get("skills", []),
                    "experience": best_match.get("experience", 0),
                    "match_score": best_score
                }
            })

        return jsonify({
            "status": "no_match",
            "message": "No suitable mentor found"
        })

    except Exception as e:
        print(f"Error in submit_doubt: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/matching_interface', methods=['GET'])
def matching_interface():
    try:
        mentee_id = request.args.get('mentee_id')
        if not mentee_id:
            return jsonify({"error": "mentee_id is required"}), 400

        # Get active match
        match = matches_collection.find_one({
            "mentee_id": mentee_id,
            "status": "active"
        })

        if match:
            mentor = mentors_collection.find_one({"_id": match["mentor_id"]})
            if mentor:
                return jsonify({
                    "status": "matched",
                    "mentor": {
                        "name": mentor.get("name", "Unknown"),
                        "skills": mentor.get("skills", []),
                        "experience": mentor.get("experience", 0),
                        "match_score": match["match_score"]
                    }
                })
            else:
                return jsonify({
                    "status": "error",
                    "message": "Mentor not found"
                }), 404
        else:
            return jsonify({
                "status": "pending",
                "message": "No active match found"
            })

    except Exception as e:
        print(f"Error in matching_interface: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    try:
        print("Starting workflow service on port 5002...")
        app.run(host='0.0.0.0', port=5002)
    except Exception as e:
        print(f"Error starting workflow service: {e}")
        sys.exit(1)