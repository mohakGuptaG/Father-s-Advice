from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS  # You might need to install this
from pymongo import MongoClient
import numpy as np
from scipy.optimize import linear_sum_assignment
import sys
import traceback
import logging
from bson.objectid import ObjectId
import os
import json

# Add this at the top of the file after imports
PORT = int(os.environ.get("PORT", 5004))

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app = Flask(__name__)
app.json_encoder = MongoJSONEncoder  # Use our custom encoder
CORS(app)  # Enable CORS

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# --------------------
# MongoDB Configuration
# --------------------
# Use environment variables for sensitive data
DB_NAME = os.environ.get("DB_NAME", "project")
DB_URI = os.environ.get("MONGO_URI", "mongodb+srv://gamingworld448:VD6Us86aukIKOcST@cluster0.hxoebiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
db = None
client = None

try:
    client = MongoClient(DB_URI, serverSelectionTimeoutMS=5000)
    # Test the connection
    client.server_info()
    db = client[DB_NAME]
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    sys.exit(1)

# Initialize collections
mentors_collection = db['mentors'] if db is not None else None
mentees_collection = db['mentees'] if db is not None else None
matches_collection = db['matches_results'] if db is not None else None
sessions_collection = db['sessions'] if db is not None else None
mentors_result_collection = db['mentors_result'] if db is not None else None

# --------------------
# Matching Criteria Weights & Normalization
# --------------------
# Weights for the matching criteria (they should sum to 1)
weights = {
    'skill': 0.6,    # Subject/Skill Match (highest weight)
    'time': 0.2,     # Time Availability Match
    'location': 0.1, # Location Match
    'workload': 0.1  # Workload Balancing
}

# Maximum values for normalization
MAX_WORKLOAD = 5  # Maximum acceptable workload (number of active mentees)
MAX_EXPERIENCE_DIFF = 5  # Maximum acceptable difference in years of experience
print("algo.py is running...")

# --------------------
# Helper Functions for Sub-Scores
# --------------------
def jaccard_similarity(set1, set2):
    """Compute the Jaccard similarity between two sets."""
    if not set1 and not set2:
        return 1.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union if union > 0 else 0

def compute_S1(mentee_skills, mentor_skills):
    """Skill match (S1) using Jaccard similarity."""
    # Handle the case where skills might be None
    mentee_skills = mentee_skills or []
    mentor_skills = mentor_skills or []
    return jaccard_similarity(set(mentee_skills), set(mentor_skills))

def compute_S2(mentee_exp, mentor_exp):
    """
    Experience match (S2): Mentor must have equal or more experience.
    If mentee's experience is greater than mentor's, return 0.
    Otherwise, return a scaled score.
    """
    # Handle the case where experience might be None or non-numeric
    try:
        mentee_exp = float(mentee_exp or 0)
        mentor_exp = float(mentor_exp or 0)
    except (ValueError, TypeError):
        mentee_exp = 0
        mentor_exp = 0

    if mentee_exp > mentor_exp:
        return 0.0
    diff = mentor_exp - mentee_exp
    return max(0, 1 - diff / MAX_EXPERIENCE_DIFF)

def compute_S3(mentee_slots, mentor_slots):
    """Time availability match (S3) using overlapping time slots."""
    # Handle the case where slots might be None
    mentee_slots = mentee_slots or []
    mentor_slots = mentor_slots or []
    
    if not mentee_slots or not mentor_slots:
        return 0.0
    
    # Convert slots to sets for easier comparison
    mentee_set = set(mentee_slots)
    mentor_set = set(mentor_slots)
    
    # Calculate overlap
    overlap = len(mentee_set.intersection(mentor_set))
    total = len(mentee_set.union(mentor_set))
    
    return overlap / total if total > 0 else 0.0

def compute_S4(mentee_timezone, mentor_timezone):
    """Location match (S4) based on timezone."""
    if not mentee_timezone or not mentor_timezone:
        return 0.0
    
    # Convert timezones to lowercase for comparison
    mentee_tz = str(mentee_timezone).lower()
    mentor_tz = str(mentor_timezone).lower()
    
    # Exact match
    if mentee_tz == mentor_tz:
        return 1.0
    
    # Check if timezones are in the same region (e.g., both in US/Eastern)
    mentee_region = mentee_tz.split('/')[0] if '/' in mentee_tz else mentee_tz
    mentor_region = mentor_tz.split('/')[0] if '/' in mentor_tz else mentor_tz
    
    if mentee_region == mentor_region:
        return 0.8
    
    # Check if timezones are in adjacent regions
    adjacent_regions = {
        'us': ['canada', 'mexico'],
        'europe': ['africa', 'asia'],
        'asia': ['europe', 'australia'],
        'australia': ['asia', 'pacific']
    }
    
    for region, neighbors in adjacent_regions.items():
        if (mentee_region == region and mentor_region in neighbors) or \
           (mentor_region == region and mentee_region in neighbors):
            return 0.5
    
    return 0.0

def compute_S5(mentor_workload):
    """Workload balancing (S5): Penalize mentors with high workload."""
    if mentor_workload is None:
        return 1.0  # Default to maximum score if workload is not specified
    
    # Convert to float in case it's a string
    try:
        workload = float(mentor_workload)
    except (ValueError, TypeError):
        return 1.0
    
    # Calculate score based on workload
    if workload >= MAX_WORKLOAD:
        return 0.0  # Maximum penalty for overloaded mentors
    elif workload == 0:
        return 1.0  # Maximum score for mentors with no workload
    
    # Linear scale between 0 and MAX_WORKLOAD
    return 1.0 - (workload / MAX_WORKLOAD)

def compute_subject_match(mentee_subjects, mentor_subjects):
    """
    Compute subject match score between mentee and mentor.
    This function is used to store top tier matches for offline mentor matching.
    """
    if not mentee_subjects or not mentor_subjects:
        return 0.0, None, 0.0
    
    max_score = 0.0
    matching_subject = None
    matching_percentage = 0.0
    
    for mentor_subj in mentor_subjects:
        # Check if mentor_subj is a dictionary with required keys
        if not isinstance(mentor_subj, dict) or "subject" not in mentor_subj or "percentage" not in mentor_subj:
            continue
            
        for mentee_subj in mentee_subjects:
            # Check if mentee_subj is a dictionary with required keys
            if not isinstance(mentee_subj, dict) or "subject" not in mentee_subj or "percentage" not in mentee_subj:
                continue
                
            if mentor_subj["subject"].lower() == mentee_subj["subject"].lower():
                # Calculate combined percentage
                try:
                    combined_percentage = (float(mentor_subj["percentage"]) + float(mentee_subj["percentage"])) / 2
                    if combined_percentage > max_score:
                        max_score = combined_percentage
                        matching_subject = mentor_subj["subject"]
                        matching_percentage = combined_percentage
                except (ValueError, TypeError):
                    # Handle case where percentage is not a valid number
                    continue
    
    return max_score, matching_subject, matching_percentage

def compute_compatibility(mentee, mentor):
    """Compute overall compatibility score between a mentee and mentor."""
    try:
        if not mentee or not mentor:
            return 0.0, "General", 0.0
            
        # Get subject breakdowns
        mentor_subjects = mentor.get("subject_breakdown", [])
        mentee_subjects = mentee.get("subject_breakdown", [])
        
        # Calculate subject match score using compute_subject_match
        subject_score, matching_subject, matching_percentage = compute_subject_match(mentee_subjects, mentor_subjects)
        
        # If no subject match, fallback to skill-based matching
        if subject_score == 0.0:
            subject_score = compute_S1(mentee.get("skills", []), mentor.get("skills", []))

        # Calculate time availability score
        time_score = compute_S3(
            mentee.get("preferredTimeSlots", []),
            mentor.get("preferredTimeSlots", [])
        )

        # Calculate location match score
        location_score = compute_S4(
            mentee.get("timezone", ""),
            mentor.get("timezone", "")
        )

        # Calculate workload score
        workload_score = compute_S5(mentor.get("activeMentees", 0))

        # Calculate final score using weights
        final_score = (
            weights['skill'] * subject_score +
            weights['time'] * time_score +
            weights['location'] * location_score +
            weights['workload'] * workload_score
        )
    
        return final_score, matching_subject or "General", matching_percentage
    except Exception as e:
        logger.error(f"Error in compute_compatibility: {e}\n{traceback.format_exc()}")
        return 0.0, "General", 0.0  # Return default values in case of error

def get_online_mentors():
    """Get all online mentors."""
    if mentors_collection is None:
        return []
    return list(mentors_collection.find({"is_online": True}))

def get_offline_mentors():
    """Get all offline mentors."""
    if mentors_collection is None:
        return []
    return list(mentors_collection.find({"is_online": False}))

def match_mentor_mentee(mentee, mentors):
    """Match a single mentee with the best available mentor."""
    best_match = None
    best_score = -1
    best_subject = None
    best_percentage = 0.0
    
    for mentor in mentors:
        score, matching_subject, matching_percentage = compute_compatibility(mentee, mentor)
        if score > best_score:
            best_score = score
            best_subject = matching_subject
            best_percentage = matching_percentage
            best_match = {
                "mentor_id": str(mentor["_id"]),  # Convert ObjectId to string
                "compatibility_score": score,
                "mentor_details": {
                    "name": mentor.get("name", ""),
                    "skills": mentor.get("skills", []),
                    "experience": mentor.get("experience", 0),
                    "location": mentor.get("location", ""),
                    "available_hours": mentor.get("available_hours", 0),
                    "is_online": mentor.get("is_online", False),
                    "matching_subject": matching_subject,
                    "matching_percentage": matching_percentage
                }
            }
    
    return best_match

# --------------------
# Flask API Endpoint for Advanced Matching
# --------------------
@app.route('/match_advanced', methods=['POST'])
def match_advanced():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.get_json()
        mentor_id = data.get('mentor_id')
        mentee_id = data.get('mentee_id')
        mentor_ids = data.get('mentor_ids', [])

        # Check if MongoDB is available
        if db is None or mentors_collection is None or mentees_collection is None:
            return jsonify({"error": "Database connection not available"}), 503

        # Check if this is a mentor or mentee matching request
        if mentor_id and not mentee_id:
            # Mentor matching flow - find mentees for a mentor
            return match_mentor_to_mentees(mentor_id)
        elif mentee_id and not mentor_id:
            # Mentee matching flow - find mentors for a mentee
            return match_mentee_to_mentors(mentee_id, mentor_ids)
        else:
            return jsonify({"error": "Either mentor_id or mentee_id is required, but not both"}), 400

    except Exception as e:
        logger.error(f"Error in match_advanced: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

def match_mentor_to_mentees(mentor_id):
    """Match a mentor with potential mentees."""
    try:
        # Check if MongoDB collections are available
        if mentors_collection is None or mentees_collection is None:
            logger.error("MongoDB collections not available")
            return jsonify({"error": "Database connection error"}), 500

        try:
            mentor_obj_id = ObjectId(mentor_id)
        except Exception as e:
            logger.error(f"Invalid mentor ID format: {e}")
            return jsonify({"error": "Invalid mentor ID format"}), 400

        # Get the mentor profile
        mentor = mentors_collection.find_one({"_id": mentor_obj_id})
        if mentor is None:
            logger.error(f"Mentor {mentor_id} not found")
            return jsonify({"error": "Mentor not found"}), 404

        # Get mentor's subject breakdown
        mentor_subjects = mentor.get("subject_breakdown", [])
        if not mentor_subjects:
            logger.warning(f"Mentor {mentor_id} has no subject breakdown")
            mentor_subjects = [{"subject": "General", "percentage": 1.0}]

        # Get all mentees with subject breakdowns
        mentees = list(mentees_collection.find({
            "profileCompleted": True,
            "status": "active"  # Only get active mentees
        }))

        if len(mentees) == 0:
            logger.info("No active mentees found")
            return jsonify({
                "status": "success",
                "matches": []
            })

        # Find best matching mentees
        matched_mentees = []
        
        for mentee in mentees:
            try:
                # Calculate compatibility score
                score, matching_subject, matching_percentage = compute_compatibility(mentee, mentor)
                
                if score > 0.3:  # Only include mentees with reasonable compatibility
                    matched_mentees.append({
                        "mentee_id": str(mentee["_id"]),  # Convert ObjectId to string
                        "compatibility_score": score,
                        "mentee_details": {
                            "name": mentee.get("name", ""),
                            "email": mentee.get("email", ""),
                            "skills": mentee.get("skills", []),
                            "education": mentee.get("education", ""),
                            "brief_bio": mentee.get("brief_bio", ""),
                            "is_online": mentee.get("is_online", False),
                            "subject_breakdown": mentee.get("subject_breakdown", []),
                            "matching_subject": matching_subject,
                            "matching_percentage": matching_percentage
                        }
                    })
                    logger.debug(f"Added mentee {mentee['_id']} with score {score}")
            except Exception as e:
                logger.error(f"Error processing mentee {mentee.get('_id')}: {e}")
                continue
        
        # Sort by compatibility score (highest first)
        matched_mentees.sort(key=lambda x: x["compatibility_score"], reverse=True)
        
        response = {
            "status": "success",
            "matches": matched_mentees
        }
        logger.debug(f"Returning {len(matched_mentees)} matches")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in match_mentor_to_mentees: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

def match_mentee_to_mentors(mentee_id, mentor_ids=None):
    """Match a mentee with potential mentors."""
    try:
        # Check if MongoDB collections are available
        if mentors_collection is None or mentees_collection is None:
            logger.error("MongoDB collections not available")
            return jsonify({"error": "Database connection error"}), 500

        try:
            mentee_obj_id = ObjectId(mentee_id)
        except Exception as e:
            logger.error(f"Invalid mentee ID format: {e}")
            return jsonify({"error": "Invalid mentee ID format"}), 400

        # Get mentee data
        mentee = mentees_collection.find_one({"_id": mentee_obj_id})
        if not mentee:
            return jsonify({"error": "Mentee not found"}), 404

        # Get available mentors
        if mentor_ids and isinstance(mentor_ids, list):
            try:
                # Convert strings to ObjectIds
                object_ids = [ObjectId(mid) for mid in mentor_ids]
                # Use pre-matched mentors if provided
                mentors = list(mentors_collection.find({
                    "_id": {"$in": object_ids},
                    "is_online": True
                }))
            except Exception as e:
                logger.error(f"Error with mentor IDs: {e}")
                # Fallback to all online mentors
                mentors = list(mentors_collection.find({"is_online": True}))
        else:
            # Get all online mentors
            mentors = list(mentors_collection.find({"is_online": True}))

        if not mentors:
            # Get offline mentors as fallback
            offline_mentors = list(mentors_collection.find({"is_online": False}))
            
            if not offline_mentors:
                return jsonify({
                    "status": "offline",
                    "message": "No mentors available"
                }), 200
            
            # Find best matching offline mentor
            best_match = match_mentor_mentee(mentee, offline_mentors)
            if best_match:
                return jsonify({
                    "status": "offline",
                    "match": best_match,
                    "message": "No online mentors available. Showing best offline match."
                })
            
            return jsonify({
                "status": "no_match",
                "message": "No suitable mentors found"
            })

        # Find best matching online mentor
        best_match = match_mentor_mentee(mentee, mentors)
        if best_match:
            return jsonify({
                "status": "success",
                "match": best_match
            })

        return jsonify({
            "status": "no_match",
            "message": "No suitable mentors found"
        })
    except Exception as e:
        logger.error(f"Error in match_mentee_to_mentors: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route("/update_online_status", methods=["POST"])
def update_online_status():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.get_json()
        mentor_id = data.get("mentor_id")
        is_online = data.get("is_online", False)

        # Check if MongoDB collections are available
        if mentors_collection is None:
            logger.error("MongoDB collections not available")
            return jsonify({"error": "Database connection error"}), 500

        if not mentor_id:
            return jsonify({"error": "mentor_id is required"}), 400

        try:
            mentor_obj_id = ObjectId(mentor_id)
        except Exception as e:
            logger.error(f"Invalid mentor ID format: {e}")
            return jsonify({"error": "Invalid mentor ID format"}), 400

        # Update mentor's online status
        result = mentors_collection.update_one(
            {"_id": mentor_obj_id},
            {"$set": {"is_online": is_online, "last_active": datetime.now()}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Mentor not found or no changes needed"}), 404

        return jsonify({
            "status": "success",
            "message": f"Mentor status updated to {'online' if is_online else 'offline'}"
        })

    except Exception as e:
        logger.error(f"Error in update_online_status: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/submit_doubt', methods=['POST'])
def submit_doubt():
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type must be application/json'}), 400
        
        data = request.get_json()
        logging.info(f"Received doubt submission: {data}")
        
        if not data.get('mentee_id') or not data.get('doubt_text'):
            return jsonify({'error': 'Missing required fields: mentee_id and doubt_text'}), 400
        
        try:
            mentee_id = ObjectId(data['mentee_id'])
        except (TypeError, InvalidId):
            return jsonify({'error': 'Invalid mentee_id format'}), 400
        
        # Get mentee data
        mentee = mentees_collection.find_one({'_id': mentee_id})
        if not mentee:
            return jsonify({'error': 'Mentee not found'}), 404
        
        # Get online mentors
        online_mentors = list(mentors_collection.find({'status': 'online'}))
        logging.info(f"Found {len(online_mentors)} online mentors")
        
        if not online_mentors:
            # If no online mentors, try offline mentors
            offline_mentors = list(mentors_collection.find({'status': 'offline'}))
            logging.info(f"Found {len(offline_mentors)} offline mentors")
            
            if offline_mentors:
                # Find best matching offline mentors
                matches = []
                for mentor in offline_mentors:
                    score = compute_compatibility(mentee, mentor)
                    if score > 0.5:  # Only include mentors with >50% compatibility
                        matches.append({
                            '_id': str(mentor['_id']),
                            'name': mentor.get('name', 'Unknown'),
                            'compatibility_score': score
                        })
                
                if matches:
                    # Sort by compatibility score
                    matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
                    return jsonify({
                        'status': 'offline_match',
                        'offline_matches': matches[:3]  # Return top 3 matches
                    })
            
            return jsonify({
                'status': 'no_match',
                'message': 'No mentors available at the moment'
            })
        
        # Find best matching online mentors
        matches = []
        for mentor in online_mentors:
            score = compute_compatibility(mentee, mentor)
            if score > 0.5:  # Only include mentors with >50% compatibility
                matches.append({
                    '_id': str(mentor['_id']),
                    'name': mentor.get('name', 'Unknown'),
                    'compatibility_score': score
                })
        
        if matches:
            # Sort by compatibility score
            matches.sort(key=lambda x: x['compatibility_score'], reverse=True)
            return jsonify({
                'status': 'matched',
                'matched_mentors': matches[:3]  # Return top 3 matches
            })
        
        return jsonify({
            'status': 'no_match',
            'message': 'No suitable mentors found'
        })
        
    except Exception as e:
        logging.error(f"Error in submit_doubt: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health')
def health_check():
    try:
        # Test MongoDB connection by running a simple command
        if db is None:
            mongodb_status = "disconnected"
        else:
            db.command('ping')
            mongodb_status = "connected"
    except Exception as e:
        mongodb_status = f"disconnected ({str(e)})"

    return jsonify({
        "status": "healthy",
        "service": "algo",
        "timestamp": datetime.now().isoformat(),
        "dependencies": {
            "mongodb": mongodb_status,
            "collections": {
                "mentors": "available" if mentors_collection is not None else "unavailable",
                "mentees": "available" if mentees_collection is not None else "unavailable",
                "matches": "available" if matches_collection is not None else "unavailable",
                "sessions": "available" if sessions_collection is not None else "unavailable"
            }
        }
    })

@app.route('/test', methods=['GET'])
def test_endpoint():
    return jsonify({"status": "ok", "message": "Algorithm service is running"})

@app.route('/get_mentor_matching_interface/<user_id>', methods=['GET'])
def get_mentor_matching_interface_endpoint(user_id):
    """Get matching interface for a mentor or mentee."""
    try:
        # Check if MongoDB collections are available
        if mentors_collection is None or mentees_collection is None:
            logger.error("MongoDB collections not available")
            return jsonify({"error": "Database connection error"}), 500
            
        # Convert string ID to ObjectId
        try:
            user_id_obj = ObjectId(user_id)
        except Exception as e:
            logger.error(f"Invalid ObjectId format: {e}")
            return jsonify({"error": "Invalid user ID format"}), 400
        
        # Check if user exists and is a mentor or mentee
        mentor = mentors_collection.find_one({"_id": user_id_obj})
        logger.debug(f"Found mentor: {mentor is not None}")
        mentee = mentees_collection.find_one({"_id": user_id_obj})
        logger.debug(f"Found mentee: {mentee is not None}")
        
        if mentor is not None:
            # User is a mentor, find matching mentees
            logger.debug("Processing mentor matching")
            return match_mentor_to_mentees(user_id)
        elif mentee is not None:
            # User is a mentee, find matching mentors
            logger.debug("Processing mentee matching")
            return match_mentee_to_mentors(user_id)
        else:
            logger.debug("User not found")
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        logger.error(f"Error in get_mentor_matching_interface endpoint: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/debug/routes')
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify(routes)

if __name__ == '__main__':
    try:
        print(f"Starting algorithm service on port {PORT}...")
        print("Initializing Flask app...")
        print(f"MongoDB URI: {DB_URI}")
        print("Checking MongoDB connection...")
        client.server_info()
        print("MongoDB connection successful")
        print("Starting Flask server...")
        app.run(host='0.0.0.0', port=PORT, debug=True)
    except Exception as e:
        print(f"Error starting algorithm service: {str(e)}")
        traceback.print_exc()
        sys.exit(1)