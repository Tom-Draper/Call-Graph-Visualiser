
const extract = require('./public/extract.js');
const express = require('express');


extract.run();


const app = express()

const port = process.env.PORT || 8080;

app.use(express.static(__dirname + '/')); //__dir and not _dir

// sendFile will go here
app.get('/', function(req, res) {
  res.render('index.html');
});

app.listen(port);
console.log('Server started at http://localhost:' + port);