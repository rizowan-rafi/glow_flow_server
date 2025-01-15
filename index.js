require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('GigFlow is running');
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
