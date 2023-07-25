const express = require("express");
const bodyParser = require('body-parser')

const app = express();
const db = require('./queries');
const port = 8080;

app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, PUT, GET, DELETE");
    next();
});

app.listen(port, () => {
    console.log(`API listening on port ${port}`);
});

db.setupTables();

app.get('/brothers', db.getBrothers);
app.post('/brothers', db.addBrother);
app.put('/brothers/:id', db.editBrother);
app.delete('/brothers/:id', db.deleteBrother);

app.get('/dues', db.getDues);
app.put('/dues', db.updateDues);