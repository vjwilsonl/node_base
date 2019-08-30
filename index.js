const express = require('express');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const keys = require('./config/keys');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
require('./models/User.js');
require('./models/Story.js');
require('./models/Scene.js');
require('./services/passport');

mongoose.connect(keys.mongoURI);

const app = express();

app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [keys.cookieKey]
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var storyRoutes = require('./routes/storyRoutes');
var authRoutes = require('./routes/authRoutes');
var sceneRoutes = require('./routes/sceneRoutes');

// require('./routes/authRoutes')(app);
// require('./routes/storyRoutes')(app);
app.use('/api/auth', authRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/scene', sceneRoutes);

app.use((req, res, next) => {
  const error = new Error('Gateway to nowhere');
  error.status = 404;
  next(error);
});
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.send({
    error: {
      msg: error.message
    }
  });
});

const PORT = process.env.PORT || 5000;

app.listen(5000);
