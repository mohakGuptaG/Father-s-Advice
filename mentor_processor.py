import json
import google.generativeai as genai
from pymongo import MongoClient
import traceback
import re
from bson import ObjectId
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

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

# --- Gemini API Configuration ---
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBAu9bzZwVQaIy8r847BN1_SITIGKXwu1c")
genai.configure(api_key=API_KEY)

# --- MongoDB Connection ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "project")

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    mongo_client.server_info()
    db = mongo_client[DB_NAME]
    mentors_collection = db["mentors"]
    mentor_profiles_collection = db["mentor_profiles"]
    mentees_collection = db["mentees"]
    print("Connected to MongoDB")
except Exception as e:
    print(f"MongoDB Connection Error: {e}")
    exit(1)

def clean_ai_response(response_text):
    """Cleans JSON output from AI responses."""
    response_text = response_text.strip()
    response_text = re.sub(r"```json\n?|```", "", response_text)
    return response_text.strip()

def analyze_job_role(job_role):
    """Analyze job role to determine primary subjects and expertise areas."""
    try:
        prompt = (
            "Analyze this job role and determine the primary subjects and expertise areas. "
            "Return a JSON with subjects and their relevance percentages. "
            "Example format: {'results': [{'subject': 'Mathematics', 'percentage': 0.4}, {'subject': 'Physics', 'percentage': 0.3}]} "
            f"\nJob Role: {job_role}"
        )
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        
        cleaned_text = clean_ai_response(response.text)
        breakdown = json.loads(cleaned_text)
        return breakdown
    except Exception as e:
        print(f"Error in job role analysis: {e}\n{traceback.format_exc()}")
        return {"results": [{"subject": "General", "percentage": 1.0}]}

def analyze_skills(skills):
    """Analyze skills to determine subject expertise."""
    try:
        prompt = (
            "Analyze these skills and determine the subject areas they relate to. "
            "Return a JSON with subjects and their relevance percentages. "
            "Example format: {'results': [{'subject': 'Mathematics', 'percentage': 0.4}, {'subject': 'Physics', 'percentage': 0.3}]} "
            f"\nSkills: {', '.join(skills)}"
        )
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        
        cleaned_text = clean_ai_response(response.text)
        breakdown = json.loads(cleaned_text)
        return breakdown
    except Exception as e:
        print(f"Error in skills analysis: {e}\n{traceback.format_exc()}")
        return {"results": [{"subject": "General", "percentage": 1.0}]}

def analyze_education(education):
    """Analyze education background to determine subject expertise."""
    try:
        prompt = (
            "Analyze this education background and determine the subject areas covered. "
            "Return a JSON with subjects and their relevance percentages. "
            "Example format: {'results': [{'subject': 'Mathematics', 'percentage': 0.4}, {'subject': 'Physics', 'percentage': 0.3}]} "
            f"\nEducation: {education}"
        )
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        
        cleaned_text = clean_ai_response(response.text)
        breakdown = json.loads(cleaned_text)
        return breakdown
    except Exception as e:
        print(f"Error in education analysis: {e}\n{traceback.format_exc()}")
        return {"results": [{"subject": "General", "percentage": 1.0}]}

def combine_breakdowns(job_breakdown, skills_breakdown, education_breakdown):
    """Combine multiple subject breakdowns into a single weighted breakdown."""
    combined = {}
    total_weight = 0
    
    # Weights for different aspects
    weights = {
        'job': 0.5,      # Job role is most important
        'skills': 0.3,   # Skills are second most important
        'education': 0.2  # Education background is least important
    }
    
    # Process job role breakdown
    for subject in job_breakdown.get('results', []):
        subject_name = subject['subject'].lower()
        combined[subject_name] = subject['percentage'] * weights['job']
        total_weight += weights['job']
    
    # Process skills breakdown
    for subject in skills_breakdown.get('results', []):
        subject_name = subject['subject'].lower()
        if subject_name in combined:
            combined[subject_name] += subject['percentage'] * weights['skills']
        else:
            combined[subject_name] = subject['percentage'] * weights['skills']
        total_weight += weights['skills']
    
    # Process education breakdown
    for subject in education_breakdown.get('results', []):
        subject_name = subject['subject'].lower()
        if subject_name in combined:
            combined[subject_name] += subject['percentage'] * weights['education']
        else:
            combined[subject_name] = subject['percentage'] * weights['education']
        total_weight += weights['education']
    
    # Normalize percentages
    if total_weight > 0:
        normalized = {
            'results': [
                {'subject': subject.capitalize(), 'percentage': percentage / total_weight}
                for subject, percentage in combined.items()
            ]
        }
    else:
        normalized = {'results': [{'subject': 'General', 'percentage': 1.0}]}
    
    return normalized

def process_completed_mentor_profile(mentor_id):
    """Process mentor data when their profile is completed."""
    try:
        # Get mentor profile
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        # Check if all required fields are present
        required_fields = {
            'basic_info': ['name', 'email', 'is_online'],
            'expertise': ['job_role', 'skills', 'education', 'experience', 'specializations'],
            'availability': ['available_hours', 'preferred_time_slots', 'timezone'],
            'location': ['country', 'city', 'timezone'],
            'subject_breakdown': ['results'],
            'workload': ['current_sessions', 'max_sessions', 'session_duration']
        }
        
        missing_fields = []
        for section, fields in required_fields.items():
            for field in fields:
                if not mentor.get(field) and not mentor.get('processed_data', {}).get(section, {}).get(field):
                    missing_fields.append(f"{section}.{field}")
        
        if missing_fields:
            return {
                "error": "Profile incomplete",
                "missing_fields": missing_fields
            }
        
        # Process the profile
        result = process_mentor_profile(mentor_id)
        
        if "error" in result:
            return result
            
        # Prepare mentor data for storage
        mentor_data = {
            "basic_info": {
                "name": mentor.get("name", ""),
                "email": mentor.get("email", ""),
                "is_online": mentor.get("is_online", False),
                "last_active": datetime.now().isoformat()
            },
            "expertise": {
                "job_role": mentor.get("job_role", ""),
                "skills": mentor.get("skills", []),
                "education": mentor.get("education", ""),
                "experience": mentor.get("experience", 0),
                "specializations": mentor.get("specializations", [])
            },
            "availability": {
                "available_hours": mentor.get("available_hours", 0),
                "preferred_time_slots": mentor.get("preferred_time_slots", []),
                "timezone": mentor.get("timezone", "")
            },
            "location": {
                "country": mentor.get("country", ""),
                "city": mentor.get("city", ""),
                "timezone": mentor.get("timezone", "")
            },
            "subject_breakdown": result["mentor_data"].get("subject_breakdown", {}),
            "workload": {
                "current_sessions": mentor.get("current_sessions", 0),
                "max_sessions": mentor.get("max_sessions", 5),
                "session_duration": mentor.get("session_duration", 60)
            },
            "matching_metrics": {
                "skill_match_score": 0.0,
                "experience_match_score": 0.0,
                "availability_match_score": 0.0,
                "location_match_score": 0.0,
                "workload_score": 0.0,
                "subject_match_score": 0.0,
                "total_compatibility_score": 0.0
            }
        }
        
        # Update mentor status and store processed data
        mentors_collection.update_one(
            {"_id": ObjectId(mentor_id)},
            {
                "$set": {
                    "profile_status": "completed",
                    "profile_completed_at": datetime.now(),
                    "processed_data": mentor_data,
                    "last_updated": datetime.now()
                }
            }
        )
        
        return {
            "status": "success",
            "message": "Mentor profile processed successfully",
            "mentor_id": mentor_id,
            "mentor_data": mentor_data
        }
        
    except Exception as e:
        print(f"Error in processing completed mentor profile: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def check_profile_completion(mentor_id):
    """Check if a mentor's profile is complete and ready for processing."""
    try:
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        # Check required fields
        required_fields = {
            'basic_info': ['name', 'email', 'is_online'],
            'expertise': ['job_role', 'skills', 'education', 'experience', 'specializations'],
            'availability': ['available_hours', 'preferred_time_slots', 'timezone'],
            'location': ['country', 'city', 'timezone'],
            'subject_breakdown': ['results'],
            'workload': ['current_sessions', 'max_sessions', 'session_duration']
        }
        
        missing_fields = []
        for section, fields in required_fields.items():
            for field in fields:
                if not mentor.get(field) and not mentor.get('processed_data', {}).get(section, {}).get(field):
                    missing_fields.append(f"{section}.{field}")
        
        return {
            "status": "success",
            "is_complete": len(missing_fields) == 0,
            "missing_fields": missing_fields,
            "profile_status": mentor.get("profile_status", "incomplete")
        }
        
    except Exception as e:
        print(f"Error in checking profile completion: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def get_mentor_profile_status(mentor_id):
    """Get the current status of a mentor's profile."""
    try:
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        return {
            "status": "success",
            "mentor_id": mentor_id,
            "profile_status": mentor.get("profile_status", "incomplete"),
            "last_updated": mentor.get("last_updated"),
            "profile_completed_at": mentor.get("profile_completed_at"),
            "has_processed_data": "processed_data" in mentor
        }
        
    except Exception as e:
        print(f"Error in getting profile status: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def process_mentor_profile(mentor_id):
    """Process a mentor's complete profile to generate subject breakdown and prepare for matching."""
    try:
        # Get mentor profile
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        # Check if profile is complete
        completion_check = check_profile_completion(mentor_id)
        if not completion_check.get("is_complete", False):
            return {
                "error": "Profile incomplete",
                "missing_fields": completion_check.get("missing_fields", [])
            }
        
        # Analyze different aspects of the profile
        job_breakdown = analyze_job_role(mentor.get('job_role', ''))
        skills_breakdown = analyze_skills(mentor.get('skills', []))
        education_breakdown = analyze_education(mentor.get('education', ''))
        
        # Combine the breakdowns
        final_breakdown = combine_breakdowns(job_breakdown, skills_breakdown, education_breakdown)
        
        # Prepare mentor data for matching
        mentor_data = {
            "mentor_id": str(mentor["_id"]),
            "basic_info": {
                "name": mentor.get("name", ""),
                "email": mentor.get("email", ""),
                "is_online": mentor.get("is_online", False),
                "last_active": mentor.get("last_active", datetime.now().isoformat())
            },
            "expertise": {
                "skills": mentor.get("skills", []),
                "experience": mentor.get("experience", 0),
                "education": mentor.get("education", ""),
                "job_role": mentor.get("job_role", ""),
                "specializations": mentor.get("specializations", [])
            },
            "subject_breakdown": final_breakdown,
            "availability": {
                "available_hours": mentor.get("available_hours", 0),
                "preferred_time_slots": mentor.get("preferred_time_slots", []),
                "timezone": mentor.get("timezone", "UTC")
            },
            "location": {
                "country": mentor.get("country", ""),
                "city": mentor.get("city", ""),
                "timezone": mentor.get("timezone", "UTC")
            },
            "workload": {
                "current_sessions": mentor.get("current_sessions", 0),
                "max_sessions": mentor.get("max_sessions", 5),
                "session_duration": mentor.get("session_duration", 60)
            },
            "matching_metrics": {
                "skill_match_score": 0.0,
                "experience_match_score": 0.0,
                "availability_match_score": 0.0,
                "location_match_score": 0.0,
                "workload_score": 0.0,
                "subject_match_score": 0.0,
                "total_compatibility_score": 0.0
            }
        }
        
        # Update mentor record with processed data
        mentors_collection.update_one(
            {"_id": ObjectId(mentor_id)},
            {
                "$set": {
                    "subject_breakdown": final_breakdown,
                    "processed_data": mentor_data,
                    "last_updated": datetime.now()
                }
            }
        )
        
        return {
            "status": "success",
            "mentor_id": mentor_id,
            "mentor_data": mentor_data
        }
        
    except Exception as e:
        print(f"Error in mentor profile processing: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def process_all_mentors():
    """Process all mentor profiles in the database."""
    try:
        mentors = mentors_collection.find({})
        results = []
        
        for mentor in mentors:
            result = process_mentor_profile(str(mentor["_id"]))
            if "mentor_data" in result:
                results.append(result["mentor_data"])
            
        return {
            "status": "success",
            "total_processed": len(results),
            "mentors_data": results
        }
        
    except Exception as e:
        print(f"Error in processing all mentors: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def get_mentors_by_subject(subject):
    """Get all mentors with expertise in a specific subject."""
    try:
        mentors = mentors_collection.find({
            "subject_breakdown.results": {
                "$elemMatch": {
                    "subject": {"$regex": f"^{subject}$", "$options": "i"}
                }
            }
        })
        
        mentors_data = []
        for mentor in mentors:
            if "processed_data" in mentor:
                mentors_data.append(mentor["processed_data"])
        
        return {
            "status": "success",
            "subject": subject,
            "total_mentors": len(mentors_data),
            "mentors_data": mentors_data
        }
        
    except Exception as e:
        print(f"Error in getting mentors by subject: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def get_online_mentors():
    """Get all online mentors with their complete processed data."""
    try:
        mentors = mentors_collection.find({"is_online": True})
        
        mentors_data = []
        for mentor in mentors:
            if "processed_data" in mentor:
                mentors_data.append(mentor["processed_data"])
        
        return {
            "status": "success",
            "total_online": len(mentors_data),
            "mentors_data": mentors_data
        }
        
    except Exception as e:
        print(f"Error in getting online mentors: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def update_mentor_metrics(mentor_id, metrics):
    """Update matching metrics for a mentor."""
    try:
        result = mentors_collection.update_one(
            {"_id": ObjectId(mentor_id)},
            {
                "$set": {
                    "matching_metrics": metrics,
                    "last_updated": datetime.now()
                }
            }
        )
        
        if result.modified_count == 0:
            return {"error": "Mentor not found or no changes made"}
            
        return {
            "status": "success",
            "mentor_id": mentor_id,
            "updated_metrics": metrics
        }
        
    except Exception as e:
        print(f"Error in updating mentor metrics: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def get_mentor_dashboard(mentor_id):
    """Get mentor dashboard data including profile details."""
    try:
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        # Get processed mentor data
        processed_data = mentor.get("processed_data", {})
        
        return {
            "status": "success",
            "dashboard_data": {
                "profile": {
                    "basic_info": {
                        "name": mentor.get("name", ""),
                        "email": mentor.get("email", ""),
                        "is_online": mentor.get("is_online", False)
                    },
                    "expertise": {
                        "job_role": mentor.get("job_role", ""),
                        "skills": mentor.get("skills", []),
                        "education": mentor.get("education", ""),
                        "experience": mentor.get("experience", 0),
                        "specializations": mentor.get("specializations", [])
                    },
                    "subject_breakdown": processed_data.get("subject_breakdown", {}),
                    "availability": {
                        "available_hours": mentor.get("available_hours", 0),
                        "timezone": mentor.get("timezone", "")
                    },
                    "location": {
                        "country": mentor.get("country", ""),
                        "city": mentor.get("city", "")
                    }
                },
                "profile_status": mentor.get("profile_status", "incomplete")
            }
        }
        
    except Exception as e:
        print(f"Error in getting mentor dashboard: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def get_mentor_matching_interface(mentor_id):
    """Get matching interface data for mentor showing matched mentees."""
    try:
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        # Get mentor's subject breakdown
        subject_breakdown = mentor.get("processed_data", {}).get("subject_breakdown", {})
        
        # Get mentees with matching subjects
        matched_mentees = []
        for subject_data in subject_breakdown.get("results", []):
            subject = subject_data["subject"].lower()  # Convert to lowercase for case-insensitive matching
            subject_percentage = subject_data["percentage"]  # Get the percentage for this subject
            
            mentees = mentees_collection.find({
                "subject_breakdown.results": {
                    "$elemMatch": {
                        "subject": {"$regex": f"^{subject}$", "$options": "i"}  # Case-insensitive match
                    }
                },
                "status": "active"
            })
            
            for mentee in mentees:
                # Calculate compatibility score
                compatibility = calculate_mentor_mentee_compatibility(mentor, mentee)
                
                if compatibility > 0.5:  # Only include mentees with good compatibility
                    # Get mentee's subject breakdown
                    mentee_subject_breakdown = mentee.get("subject_breakdown", {})
                    
                    # Find the matching subject in mentee's breakdown
                    mentee_subject_percentage = 0
                    for mentee_subject in mentee_subject_breakdown.get("results", []):
                        if mentee_subject["subject"].lower() == subject:
                            mentee_subject_percentage = mentee_subject["percentage"]
                            break
                    
                    matched_mentees.append({
                        "mentee_id": str(mentee["_id"]),
                        "compatibility_score": compatibility,
                        "mentee_details": {
                            "name": mentee.get("name", ""),
                            "email": mentee.get("email", ""),
                            "skills": mentee.get("skills", []),
                            "education": mentee.get("education", ""),
                            "brief_bio": mentee.get("brief_bio", ""),
                            "subject_breakdown": mentee_subject_breakdown,
                            "matching_subject": {
                                "name": subject,
                                "mentor_percentage": subject_percentage,
                                "mentee_percentage": mentee_subject_percentage
                            }
                        }
                    })
        
        # Sort mentees by compatibility score
        matched_mentees.sort(key=lambda x: x["compatibility_score"], reverse=True)
        
        return {
            "status": "success",
            "matches": matched_mentees
        }
        
    except Exception as e:
        print(f"Error in getting mentor matching interface: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def calculate_mentor_mentee_compatibility(mentor, mentee):
    """Calculate compatibility score between mentor and mentee."""
    try:
        # Get mentor's subject breakdown
        mentor_subjects = {
            s["subject"].lower(): s["percentage"] 
            for s in mentor.get("processed_data", {}).get("subject_breakdown", {}).get("results", [])
        }
        
        # Get mentee's subject
        mentee_subject = mentee.get("subject", "").lower()
        
        # Subject match score
        subject_score = mentor_subjects.get(mentee_subject, 0)
        
        # Time availability match
        mentor_time = mentor.get("processed_data", {}).get("availability", {}).get("preferred_time_slots", [])
        mentee_time = mentee.get("preferred_time", "")
        time_score = 1.0 if mentee_time in mentor_time else 0.5
        
        # Location match
        mentor_location = mentor.get("processed_data", {}).get("location", {}).get("timezone", "")
        mentee_location = mentee.get("location", "")
        location_score = 1.0 if mentor_location == mentee_location else 0.5
        
        # Calculate final score
        weights = {
            "subject": 0.6,
            "time": 0.2,
            "location": 0.2
        }
        
        final_score = (
            weights["subject"] * subject_score +
            weights["time"] * time_score +
            weights["location"] * location_score
        )
        
        return final_score
        
    except Exception as e:
        print(f"Error in calculating compatibility: {e}\n{traceback.format_exc()}")
        return 0.0

def accept_mentee_request(mentor_id, mentee_id):
    """Accept a mentee request and create a match."""
    try:
        # Check if mentor can accept more mentees
        mentor = mentors_collection.find_one({"_id": ObjectId(mentor_id)})
        if not mentor:
            return {"error": "Mentor not found"}
            
        current_sessions = mentor.get("processed_data", {}).get("workload", {}).get("current_sessions", 0)
        max_sessions = mentor.get("processed_data", {}).get("workload", {}).get("max_sessions", 5)
        
        if current_sessions >= max_sessions:
            return {"error": "Mentor has reached maximum session limit"}
        
        # Create match record
        match_data = {
            "mentor_id": str(mentor_id),
            "mentee_id": str(mentee_id),
            "status": "active",
            "match_date": datetime.now(),
            "session_status": "pending"
        }
        
        db.matches_collection.insert_one(match_data)
        
        # Update mentor's current sessions
        mentors_collection.update_one(
            {"_id": ObjectId(mentor_id)},
            {
                "$inc": {"processed_data.workload.current_sessions": 1}
            }
        )
        
        return {
            "status": "success",
            "message": "Mentee request accepted successfully",
            "match_data": match_data
        }
        
    except Exception as e:
        print(f"Error in accepting mentee request: {e}\n{traceback.format_exc()}")
        return {"error": str(e)}

def process_mentor_data(mentor_data):
    """Process mentor data and calculate additional metrics."""
    try:
        # Calculate expertise score based on experience and skills
        experience = mentor_data['expertise']['experience']
        skills_count = len(mentor_data['expertise']['skills'])
        expertise_score = min(1.0, (experience / 10 + skills_count / 20) / 2)

        # Calculate availability score
        available_hours = mentor_data['availability']['available_hours']
        max_sessions = mentor_data['workload']['max_sessions']
        availability_score = min(1.0, available_hours / (max_sessions * 2))

        # Calculate workload score
        current_sessions = mentor_data['workload']['current_sessions']
        max_sessions = mentor_data['workload']['max_sessions']
        workload_score = 1.0 - (current_sessions / max_sessions)

        # Calculate overall score
        overall_score = (expertise_score * 0.4 + 
                        availability_score * 0.3 + 
                        workload_score * 0.3)

        # Prepare processed data
        processed_data = {
            'expertise_score': expertise_score,
            'availability_score': availability_score,
            'workload_score': workload_score,
            'overall_score': overall_score,
            'processed_at': datetime.utcnow().isoformat(),
            'metrics': {
                'experience_years': experience,
                'skills_count': skills_count,
                'available_hours': available_hours,
                'current_sessions': current_sessions,
                'max_sessions': max_sessions
            }
        }

        return processed_data
    except Exception as e:
        print(f"Error processing mentor data: {str(e)}")
        return None

@app.route('/process_mentor_profile', methods=['POST'])
def process_mentor_profile():
    try:
        data = request.json
        mentor_id = data.get('mentor_id')
        mentor_data = data.get('mentor_data')

        if not mentor_id or not mentor_data:
            return jsonify({'error': 'Missing mentor_id or mentor_data'}), 400

        # Process the mentor data
        processed_data = process_mentor_data(mentor_data)
        
        if not processed_data:
            return jsonify({'error': 'Failed to process mentor data'}), 500

        # Update mentor profile with processed data
        mentor_profiles_collection.update_one(
            {'mentorId': mentor_id},
            {'$set': {'processedData': processed_data}},
            upsert=True
        )

        # Update mentor document with processed data
        mentors_collection.update_one(
            {'_id': mentor_id},
            {'$set': {'processedData': processed_data}},
            upsert=True
        )

        return jsonify({
            'message': 'Mentor profile processed successfully',
            'processed_data': processed_data
        })

    except Exception as e:
        print(f"Error in process_mentor_profile: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"}), 200

# Test endpoint
@app.route('/test', methods=['GET'])
def test():
    return jsonify({
        'status': 'success',
        'message': 'Mentor processor service is running'
    })

if __name__ == '__main__':
    PORT = int(os.environ.get("MENTOR_PROCESSOR_PORT", 5003))
    app.run(host='0.0.0.0', debug=False, port=PORT) 