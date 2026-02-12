
const http = require('http');
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end('Hello World');
});

server.listen(3005, '0.0.0.0', (err) => {
    if (err) return console.error(err);
    console.log('Server running on http://0.0.0.0:3005');
});
