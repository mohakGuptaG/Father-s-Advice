import json
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
from dotenv import load_dotenv
import requests
import time

# Load environment variables
load_dotenv()

# MongoDB Connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "project")

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    mongo_client.server_info()
    db = mongo_client[DB_NAME]
    mentors_collection = db["mentors"]
    print("Connected to MongoDB")
except Exception as e:
    print(f"MongoDB Connection Error: {e}")
    exit(1)

def create_mentor_profile():
    try:
        # Create a complete mentor profile
        mentor_profile = {
            "name": "Dr. John Smith",
            "email": "john.smith@example.com",
            "role": "mentor",
            "phone": "1234567890",
            "address": "123 Main St, Anytown, USA",
            "profileCompleted": True,
            "fieldOfInterest": "Computer Science",
            "yearOfExperience": 10,
            "skills": ["JavaScript", "Python", "Java", "Data Structures", "Algorithms", "Machine Learning"],
            "availability": "Weekdays 6PM-10PM, Weekends 10AM-6PM",
            "briefBio": "Experienced software engineer with a Ph.D. in Computer Science. Passionate about teaching and mentoring the next generation of developers.",
            "education": "Ph.D. in Computer Science from Stanford University",
            "expertise": ["Web Development", "Machine Learning", "Data Science", "Software Engineering"],
            "specializations": ["Full Stack Development", "AI/ML", "Cloud Computing"],
            "preferredTimeSlots": ["Monday 6PM-8PM", "Wednesday 6PM-8PM", "Saturday 10AM-12PM"],
            "maxSessions": 5,
            "sessionDuration": 60,
            "isOnline": True,
            "lastActive": datetime.now(),
            "rating": 4.8,
            "totalSessions": 25,
            "job_role": "Senior Software Engineer",
            "experience": 10,
            "available_hours": 20,
            "timezone": "America/New_York",
            "country": "USA",
            "city": "Anytown",
            "current_sessions": 2,
            "subject_breakdown": {
                "results": [
                    {"subject": "Computer Science", "percentage": 0.4},
                    {"subject": "Mathematics", "percentage": 0.2},
                    {"subject": "Data Science", "percentage": 0.2},
                    {"subject": "Web Development", "percentage": 0.1},
                    {"subject": "Machine Learning", "percentage": 0.1}
                ]
            },
            "processed_data": {
                "basic_info": {
                    "name": "Dr. John Smith",
                    "email": "john.smith@example.com",
                    "is_online": True,
                    "last_active": datetime.now().isoformat()
                },
                "expertise": {
                    "job_role": "Senior Software Engineer",
                    "skills": ["JavaScript", "Python", "Java", "Data Structures", "Algorithms", "Machine Learning"],
                    "education": "Ph.D. in Computer Science from Stanford University",
                    "experience": 10,
                    "specializations": ["Full Stack Development", "AI/ML", "Cloud Computing"]
                },
                "availability": {
                    "available_hours": 20,
                    "preferred_time_slots": ["Monday 6PM-8PM", "Wednesday 6PM-8PM", "Saturday 10AM-12PM"],
                    "timezone": "America/New_York"
                },
                "location": {
                    "country": "USA",
                    "city": "Anytown",
                    "timezone": "America/New_York"
                },
                "workload": {
                    "current_sessions": 2,
                    "max_sessions": 5,
                    "session_duration": 60
                },
                "matching_metrics": {
                    "skill_match_score": 0.85,
                    "experience_match_score": 0.9,
                    "availability_match_score": 0.8,
                    "location_match_score": 0.7,
                    "workload_score": 0.9,
                    "subject_match_score": 0.85,
                    "total_compatibility_score": 0.85
                }
            },
            "profile_status": "completed",
            "profile_completed_at": datetime.now(),
            "last_updated": datetime.now()
        }

        # Check if mentor already exists
        existing_mentor = mentors_collection.find_one({"email": mentor_profile["email"]})
        
        if existing_mentor:
            print("Mentor already exists with this email. Updating profile...")
            mentors_collection.update_one(
                {"email": mentor_profile["email"]},
                {"$set": mentor_profile}
            )
            mentor_id = existing_mentor["_id"]
            print("Mentor profile updated successfully!")
        else:
            # Create new mentor
            result = mentors_collection.insert_one(mentor_profile)
            mentor_id = result.inserted_id
            print("New mentor profile created successfully!")
        
        print(f"Mentor ID: {mentor_id}")
        
        # Process the mentor profile using the mentor_processor service
        print("Processing mentor profile with mentor_processor service...")
        try:
            response = requests.post(
                "http://localhost:5003/process_mentor_profile",
                json={"mentor_id": str(mentor_id)}
            )
            
            if response.status_code == 200:
                print("Mentor profile processed successfully!")
                print(f"You can now access the mentor dashboard with ID: {mentor_id}")
            else:
                print(f"Error processing mentor profile: {response.text}")
        except Exception as e:
            print(f"Error connecting to mentor_processor service: {e}")
            print("The mentor profile was created but not processed. You may need to restart the mentor_processor service.")
        
        return mentor_id
    
    except Exception as e:
        print(f"Error creating mentor profile: {e}")
        return None

if __name__ == "__main__":
    mentor_id = create_mentor_profile()
    if mentor_id:
        print("\nTo access the mentor dashboard:")
        print(f"1. Make sure your server.js is running")
        print(f"2. Login with email: john.smith@example.com and password: password123")
        print(f"3. You should be redirected to the mentor dashboard")
        print(f"4. If not, manually navigate to /mentor_dashboard")
    else:
        print("Failed to create mentor profile") 