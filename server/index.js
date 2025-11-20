// server/index.js (Your main server file)
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const scanRouter = require('./routes/scanRouter'); // We will create this

// Middleware to parse JSON bodies
app.use(express.json());

// Example health check route
app.get('/', (req, res) => {
  res.send('Compliance AI Server is Running!');
});

// Main scanning route
app.use('/api', scanRouter);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});