from pymongo import MongoClient
from bson.objectid import ObjectId

# MongoDB connection
client = MongoClient('mongodb+srv://gamingworld448:VD6Us86aukIKOcST@cluster0.hxoebiy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
db = client['project']

def cleanup_database():
    # Clean up mentees collection
    mentees = list(db.mentees.find({}))
    seen_names = set()
    
    for mentee in mentees:
        # Skip if name is already seen
        if mentee.get('name') in seen_names:
            db.mentees.delete_one({'_id': mentee['_id']})
            continue
            
        seen_names.add(mentee.get('name'))
        
        # If ID is a string, create new document with ObjectId
        if isinstance(mentee['_id'], str):
            try:
                # Create new document with same data but new ObjectId
                new_doc = mentee.copy()
                new_doc['_id'] = ObjectId()
                db.mentees.insert_one(new_doc)
                # Delete old document
                db.mentees.delete_one({'_id': mentee['_id']})
            except Exception as e:
                print(f"Error processing mentee {mentee.get('name')}: {str(e)}")

    print("Database cleanup completed")
    print(f"Total mentees after cleanup: {db.mentees.count_documents({})}")
    print(f"Total mentors: {db.mentors.count_documents({})}")

if __name__ == '__main__':
    cleanup_database() 