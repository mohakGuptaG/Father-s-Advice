const axios = require('axios');

async function checkService() {
    try {
        console.log('Checking mentor processor service...');
        const response = await axios.get('http://localhost:5003/test');
        console.log('Service response:', response.data);
        console.log('Service is running!');
    } catch (error) {
        console.error('Service is not running or not accessible:');
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

checkService(); 