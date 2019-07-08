const passport = require('passport');
const mongoose = require('mongoose');

const User = mongoose.model('users');

module.exports = app => {
  app.get('/', (req, res) => {
    res.send(req.user);
  });
  /**
   * Google authentication
   */
  app.get(
    '/api/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  );
  // callback after google authentication
  app.get(
    '/api/auth/google/callback',
    passport.authenticate('google'),
    (req, res) => {
      res.redirect('/');
    }
  );

  /**
   * Facebook authentication
   */
  //TODO need to get email permission
  app.get(
    '/api/auth/facebook',
    passport.authenticate('facebook', {
      scope: ['email']
    })
  );
  app.get(
    '/api/auth/facebook/callback',
    passport.authenticate('facebook', (req, res) => {
      res.redirect('/');
    })
  );
  // app.get(
  //   '/api/auth/facebook/callback',
  //   passport.authenticate('facebook', {
  //     successRedirect: '/',
  //     failureRedirect: '/login'
  //   })
  // );

  app.get('/api/current_user', (req, res) => {
    res.send(req.user);
  });

  // returns user Profile
  app.get('/api/auth/profile', async (req, res) => {
    const profile = await User.findOne({ _id: req.user.id });

    res.send(profile);
  });

  // destroy current session and logs out user
  app.get('/api/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });
};
