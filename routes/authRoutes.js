'use strict';
/**
 *
 * @authRoutes.js
 * Provide API endpoints for authentication
 */
var passport = require('passport');
var mongoose = require('mongoose');
var express = require('express');
var router = express.Router();
var User = mongoose.model('users');
/**
 * API ROUTES
 */
router.get('/', (req, res) => {
  res.send(req.user);
});

// Google authentication

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);
// callback after google authentication
router.get('/google/callback', passport.authenticate('google'), (req, res) => {
  res.redirect('/');
});

/**
 * Facebook authentication
 */
//TODO need to get email permission
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['email']
  })
);
// router.get(
//   '/facebook/callback',
//   passport.authenticate('facebook', (req, res) => {
//     res.redirect('/');
//   })
// );
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

router.get('/current_user', (req, res) => {
  res.send(req.user);
});

// returns user Profile
router.get('/profile', async (req, res) => {
  const profile = await User.findOne({ _id: req.user.id });

  res.send(profile);
});

// destroy current session and logs out user
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;
