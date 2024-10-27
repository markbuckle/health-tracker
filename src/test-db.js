require('dotenv').config();
require('./mongodb');

setTimeout(() => {
    console.log('Connection test complete');
    process.exit(0);
}, 5000);