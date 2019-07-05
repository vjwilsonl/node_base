const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const keys = require('../config/keys');
const FacebookStrategy = require('passport-facebook').Strategy;

const User = mongoose.model('users');

passport.serializeUser((user, done) => {
  //for cookie
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  //for cookie
  User.findById(id).then(user => {
    done(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: keys.googleClientID,
      clientSecret: keys.googleClientSecret,
      callbackURL: '/api/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        // already have record
        done(null, existingUser);
      } else {
        const user = await new User({
          googleId: profile.id,
          name: profile.name.givenName + ' ' + profile.name.familyName,
          email: profile.emails[0].value,
          avatarURI: profile.photos[0].value
        }).save();
        done(null, user);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: keys.facebookClientID,
      clientSecret: keys.facebookClientSecret,
      callbackURL: '/api/auth/facebook/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      const existingUser = await User.findOne({ googleId: profile.id });
      console.log(existingUser);
      console.log(profile);
      return;
      if (existingUser) {
        // already have record
        done(null, existingUser);
      } else {
        const user = await new User({
          googleId: profile.id,
          name: profile.displayName + ' ' + profile.name.familyName,
          email: profile.emails[0].value,
          avatarURI: profile.photos[0].value
        }).save();
        done(null, user);
      }
    }
  )
);
