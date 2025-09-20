import os
import pymongo
from datetime import datetime
import bcrypt
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://gamingworld448:VD6Us86aukIKOcST@cluster0.hxoebiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
DB_NAME = os.getenv('DB_NAME', 'project')

def create_simple_mentor():
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        mentors_collection = db.mentors
        
        # Create a simple mentor profile with exact schema match
        current_time = datetime.now()
        mentor = {
            "name": "Test Mentor",
            "email": "mentor@test.com",
            "password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
            "role": "mentor",
            "phone": "1234567890",
            "address": "Test Address",
            "profileCompleted": True,
            "fieldOfInterest": "Computer Science",
            "yearOfExperience": 5,
            "skills": ["Python", "JavaScript", "Node.js", "MongoDB"],
            "availability": "Weekdays 9AM-5PM",
            "briefBio": "Test mentor for testing purposes",
            "education": "Bachelor of Science in Computer Science",
            "expertise": ["Web Development", "Database Design"],
            "specializations": ["Full Stack Development"],
            "preferredTimeSlots": ["Morning", "Evening"],
            "maxSessions": 5,
            "sessionDuration": 60,
            "isOnline": True,
            "lastActive": current_time,
            "rating": 5.0,
            "totalSessions": 0,
            "subject_breakdown": {
                "results": [
                    {"subject": "Computer Science", "percentage": 100},
                    {"subject": "Web Development", "percentage": 90},
                    {"subject": "Database Design", "percentage": 85}
                ]
            },
            "processed_data": {
                "basic_info": {
                    "name": "Test Mentor",
                    "email": "mentor@test.com",
                    "is_online": True,
                    "last_active": current_time
                },
                "expertise": {
                    "job_role": "Software Developer",
                    "skills": ["Python", "JavaScript", "Node.js", "MongoDB"],
                    "education": "Bachelor of Science in Computer Science",
                    "experience": 5,
                    "specializations": ["Full Stack Development"]
                },
                "availability": {
                    "available_hours": 8,
                    "preferred_time_slots": ["Morning", "Evening"],
                    "timezone": "UTC"
                },
                "location": {
                    "country": "India",
                    "city": "Mumbai",
                    "timezone": "UTC+5:30"
                },
                "workload": {
                    "current_sessions": 0,
                    "max_sessions": 5,
                    "session_duration": 60
                },
                "matching_metrics": {
                    "skill_match_score": 90,
                    "experience_match_score": 85,
                    "availability_match_score": 100,
                    "location_match_score": 100,
                    "workload_score": 100,
                    "subject_match_score": 90,
                    "total_compatibility_score": 94
                }
            },
            "profile_status": "completed",
            "profile_completed_at": current_time,
            "last_updated": current_time,
            "createdAt": current_time,
            "updatedAt": current_time
        }
        
        # Check if mentor already exists
        existing_mentor = mentors_collection.find_one({"email": mentor["email"]})
        
        if existing_mentor:
            # Update existing mentor
            mentors_collection.update_one(
                {"email": mentor["email"]},
                {"$set": mentor}
            )
            print(f"Mentor profile updated successfully")
        else:
            # Insert new mentor
            result = mentors_collection.insert_one(mentor)
            print(f"Mentor profile created successfully")
        
        # Create a simple HTML file with login instructions
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Mentor Login Instructions</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .instructions {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 5px;
                }
                .credentials {
                    background-color: #e0f7fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <h1>Mentor Login Instructions</h1>
            <div class="instructions">
                <p>A test mentor profile has been created in the database. You can now log in to the mentor dashboard using the following credentials:</p>
                <div class="credentials">
                    <p><strong>Email:</strong> mentor@test.com</p>
                    <p><strong>Password:</strong> password123</p>
                </div>
                <p>Steps to access the dashboard:</p>
                <ol>
                    <li>Go to the login page</li>
                    <li>Enter the email and password above</li>
                    <li>Select the role as "mentor"</li>
                    <li>You will be redirected to the mentor dashboard</li>
                </ol>
            </div>
        </body>
        </html>
        """
        
        with open("mentor_login.html", "w") as f:
            f.write(html_content)
        
        print("Login instructions saved to mentor_login.html")
        
    except Exception as e:
        print(f"Error creating mentor profile: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    create_simple_mentor() 