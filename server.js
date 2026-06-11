const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const { exec } = require('child_process');
const dataLoader = require('./src/dataLoader');
const csv = require('./src/csv');
const config = require('./src/config');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// API Endpoints
app.get('/api/stats', (req, res) => {
  try {
    const senders = dataLoader.loadSenders();
    const schedules = dataLoader.loadScheduleRows();
    const templates = dataLoader.loadTemplates();
    
    res.json({
      total_senders: senders.length,
      total_schedules: schedules.length,
      total_templates: Object.keys(templates).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/senders', (req, res) => {
  try {
    const filePath = path.join(config.DATA_DIR, 'sender_accounts.csv');
    const senders = csv.readCsv(filePath);
    res.json(senders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/run-schedule', (req, res) => {
  const command = 'npm run schedule';
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: error.message, stderr });
    }
    res.json({ message: 'Schedule run completed', stdout });
  });
});

// Serve Frontend (to be built later)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dashboard/frontend/dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dashboard', 'frontend', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
