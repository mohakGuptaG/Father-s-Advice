const axios = require('axios');

async function checkAlgoService() {
    try {
        console.log('Checking algo service...');
        const response = await axios.get('http://localhost:5000/health');
        console.log('Service response:', response.data);
        console.log('Algo service is running!');
    } catch (error) {
        console.error('Algo service is not running or not accessible:');
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

checkAlgoService(); 