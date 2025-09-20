# Mentor-Mentee Matching System

A system for matching mentors with mentees based on skills, experience, and preferences.

## Features

- Intelligent doubt analysis using Google's Gemini AI
- Advanced mentor matching algorithm
- Real-time matching interface
- MongoDB database for data persistence
- RESTful API endpoints
- Comprehensive logging and monitoring

## Prerequisites

- Python 3.8 or higher
- Node.js 14 or higher
- npm (Node Package Manager)
- MongoDB

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd <repository-name>
```

2. Install Python dependencies:

```bash
# On Windows:
pip install -r requirements.txt

# On Unix-like systems:
pip3 install -r requirements.txt
```

3. Install Node.js dependencies:

```bash
npm install
```

4. Set up MongoDB:

```bash
# Start MongoDB service
sudo systemctl start mongod

# Verify MongoDB is running
mongo --eval "db.runCommand({connectionStatus:1})"
```

5. Set up environment variables:
Create a `.env` file in the project root with the following variables:

```
GOOGLE_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb://localhost:27017/
```

## Running the Application

### On Windows:

1. Run the start script:

```bash
start.bat
```

### On Unix-like systems:

1. Run the start script:

```bash
./start.sh
```

The script will:

- Start all Python services
- Start the Node.js server
- Verify that all services are running
- Display the URLs for accessing each service

## Services

The application consists of the following services:

- Mentor Processor: http://localhost:5003
- API Service: http://localhost:5001
- Workflow Service: http://localhost:5002
- Algorithm Service: http://localhost:5000
- Node.js server: http://localhost:3000

## Testing

To run the test workflow:

```bash
# On Windows:
python test_workflow.py

# On Unix-like systems:
python3 test_workflow.py
```

## Logs

Logs are stored in the `logs` directory:

- `python_services.log`: Python services output
- `mentor_processor.log`: Mentor processor output
- `node_server.log`: Node.js server output

## Troubleshooting

If you encounter any issues:

1. Check the logs in the `logs` directory
2. Ensure all required services are running
3. Verify that MongoDB is running
4. Check that all required ports are available

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
