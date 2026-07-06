import axios from 'axios';

const client = axios.create({
    baseURL: '/api',
    withCredentials: true  // Send httpOnly cookies with every request
});

// No token interceptor needed — authentication is handled via httpOnly cookies

export default client;
