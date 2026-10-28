const express = require('express');
const cors = require('cors');
const path = require('path');

const dispatchRoutes = require('./routes/dispatch.routes');
const tallyRoutes = require('./routes/tally.routes');
const queueRoutes = require('./routes/queue.routes');
const copyRoutes = require('./routes/copy.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(dispatchRoutes);
app.use(tallyRoutes);
app.use(queueRoutes);
app.use(copyRoutes);
app.use(dashboardRoutes);

module.exports = app;
