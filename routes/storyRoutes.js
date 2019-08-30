'use strict';
/**
 *
 * @storyRoutes.js
 * Provides API end points for Story
 *
 */
var express = require('express');
var router = express.Router();
var passport = require('passport');
var mongoose = require('mongoose');
var keys = require('../config/keys');
// copying of files
var fs = require('fs');
var path = require('path');
// mongo db
var User = mongoose.model('users');
var Story = mongoose.model('stories');
var Scene = mongoose.model('scenes');
// check file type
var readChunk = require('read-chunk');
var fileType = require('file-type');
// custom helper functions
var {
  uploadStoryImageParams,
  deleteImageParams
} = require('../services/uploadFileParams');
var { errorResponse, successResponse } = require('../services/responseParams');
var CustomError = require('../services/CustomError');
var { validMongooseId } = require('../middlewares/mongooseValidator');
// configuring the AWS environment
var AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: keys.awsAccessKeyID,
  secretAccessKey: keys.awsSecretKey
});
var { check, validationResult } = require('express-validator');
// file upload library
var multer = require('multer');
var { uploadImage } = require('../services/uploadFile');

function isUserStory(story, req) {
  // var uid =
  //   typeof req.user !== 'undefined' ? req.user.id : '5c7f539b7c34db3024c6795b';
  // return story._user == uid;
  return story._user == req.user.id;
}

/**
 * Validators
 */
var storyValidator = [
  check('title')
    .not()
    .isEmpty()
    .withMessage('Title field is required')
    .trim()
    .escape(),
  check('description')
    .not()
    .isEmpty()
    .withMessage('Description field is required')
    .trim()
    .escape(),
  check('status')
    .not()
    .isEmpty()
    .withMessage('Status field is required')
    .isIn(['live', 'draft'])
    .withMessage('Status field value is not valid')
    .trim()
    .escape(),
  check('visibility')
    .not()
    .isEmpty()
    .withMessage('Visibility field is required')
    .isIn(['public', 'private'])
    .trim()
    .escape()
];
/**
 * API ROUTES
 */
/**
 * POST /api/story
 * Create new story
 */
router.post(
  '/',
  uploadImage.single('thumbnail'),
  storyValidator,
  async (req, res, next) => {
    // if express validator have error
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }
    var { title, description, status, visibility } = req.body;
    // check if image file uploaded
    if (!req.file) {
      return res.send(
        errorResponse('Please upload a thumbnail image.', 'thumbnail')
      );
    }
    var filePath = process.cwd() + '/' + req.file.path;
    var params = uploadStoryImageParams(filePath);
    // Upload thumbnail to S3
    var s3 = new AWS.S3();
    try {
      // TODO maybe try out direct upload to s3 instead of saving in local first
      var s3file = await s3.upload(params).promise();
    } catch (err) {
      // TODO Logging
      return res
        .status(422)
        .send(errorResponse('Unable to upload file', 'thumbnail', 'body'));
    }
    // Remove local file
    fs.unlinkSync(filePath);
    // Get current user ID (TODO remove the default uid)
    // var uid =
    //   typeof req.user !== 'undefined'
    //     ? req.user.id
    //     : '5c7f539b7c34db3024c6795b';
    var uid = req.user.id;
    // Create new Story
    try {
      var story = await new Story({
        title,
        description,
        thumbnail: {
          url: s3file.Location,
          key: s3file.key
        },
        status,
        visibility,
        _user: uid
      });
      var saveStory = await story.save();
      // Respond with newest copy of Story created
      return res.send(successResponse(saveStory, 'Story successfully created'));
    } catch (err) {
      if (err) {
        const error = new Error(err);
        return next(error);
      }
    }
  }
);

/**
 * POST /api/story/:id
 * UPDATE story details
 */
router.post(
  '/:id',
  uploadImage.single('thumbnail'),
  storyValidator,
  async (req, res, next) => {
    // check for valid mongoose object id
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      // if express validator have error
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).send({ errors: errors.array() });
      }
      // check if story belong to user
      try {
        var originalStory = await Story.findById(req.params.id);
        if (!originalStory) {
          // story not found
          return res
            .status(404)
            .send(errorResponse('Unable to update, story not found'));
        } else if (!isUserStory(originalStory, req)) {
          // story dont belong to user
          return res
            .status(403)
            .send(
              errorResponse(
                'Unable to update, this story does not belong to you'
              )
            );
        }
      } catch (err) {
        if (err) {
          const error = new Error(err);
          return next(error);
        }
      }
      // get body parameters
      const { title, description, status, visibility } = req.body;
      var update = { title, description, status, visibility };
      var option = { new: true }; // return newest copy
      // check if new file uploaded
      if (req.file) {
        var filePath = process.cwd() + '/' + req.file.path;
        var params = uploadStoryImageParams(filePath);
        var s3 = new AWS.S3();
        // begin upload
        try {
          // TODO maybe try out direct upload to s3 instead of saving in local first
          var s3file = await s3.upload(params).promise();
        } catch (err) {
          // TODO Logging
          return res
            .status(422)
            .send(errorResponse('Unable to upload file', 'thumbnail', 'body'));
        }
        update.thumbnail = {};
        update.thumbnail.url = s3file.Location;
        update.thumbnail.key = s3file.key;
        // remove local file
        fs.unlinkSync(filePath);
        // delete old s3 image if new one uploaded
        //TODO send to queue
        if (originalStory.thumbnail.key) {
          var oldImageParams = deleteImageParams(originalStory.thumbnail.key);
          s3.deleteObject(oldImageParams, (err, data) => {
            if (err) {
              // TODO log error
              console.error(err);
            } else {
              // TODO log deleted file
              console.log(
                'CONSOLE LOG: user: ' +
                  req.body.id +
                  ' deleted s3 image with key: ' +
                  originalStory.thumbnail.key
              );
            }
          });
        }
      }
      // update new datas
      try {
        var updatedStory = await Story.findByIdAndUpdate(
          req.params.id,
          update,
          option
        );
      } catch (err) {
        return res.status(422).send(err);
      }

      return res.send(
        successResponse(updatedStory, 'Story successfully updated')
      );
    } else {
      // Story ID passed in is not valid
      return res.status(422).send(errorResponse('Invalid story ID', 'id'));
    }

    // Need to control user based story
  }
);

/**
 * GET /api/story/public
 * Retrieve public story list
 */
router.get('/public', async (req, res) => {
  try {
    var story = await Story.find({ visibility: 'public' });
  } catch (err) {
    return res.status(400).send(err);
  }
  if (story && story.length) {
    return res.send(
      successResponse(story, 'Successfully retrieve public story list')
    );
  } else {
    return res
      .status(404)
      .send(errorResponse('There are currently no public stories'));
  }
});

/**
 * GET /api/story/
 * Retrieve current user story list
 */
router.get('/', async (req, res) => {
  try {
    //req.user.id
    var story = await Story.find({ _user: req.user.id });
  } catch (err) {
    return res.status(400).send(err);
  }
  if (story && story.length) {
    return res.send(
      successResponse(story, 'Successfully retrieve user story list')
    );
  } else {
    res
      .status(404)
      .send(errorResponse('There are currently no stories in your list'));
  }
});

/**
 * GET /api/story/:id
 * Retrieve story details
 */
router.get('/:id', validMongooseId, async (req, res) => {
  try {
    var story = await Story.findById(req.params.id).lean();
  } catch (err) {
    return res.status(422).send(err);
  }

  if (story) {
    // reject if story is private and does not belong to user
    if (isUserStory(story, req) || story.visibility == 'public') {
      // Get scenes in the story
      try {
        // lean is to get JSON rather than mongoose document
        var scenes = await Scene.find({ _story: story._id }).lean();
      } catch (err) {
        return res.status(422).send(err);
      }
      story.scenes = scenes;
      // console.log(story);
      return res.send(
        successResponse(story, 'Successfully retrieve story detail')
      );
    } else {
      // story not belong to user or not public
      return res
        .status(403)
        .send(errorResponse('You do not have permission to view this story'));
    }
  } else {
    return res.status(404).send(errorResponse('No story found'));
  }
  // Need to control user based story
});

// TEST ROUTES
router.post(
  '/api/test1',
  uploadImage.single('vrfile'),
  [
    //username must be an email
    check('username', 'Username is required.')
      .not()
      .isEmpty()
      .isEmail()
      .withMessage('Username must be an email.'),
    //description cannot be empty
    check('description')
      .not()
      .isEmpty(),
    check('vrfile', 'Please upload an image.')
      .not()
      .isEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).send({ errors: errors.array() });
    }
    res.send('ok');
  }
);

router.post(
  '/api/test',
  uploadImage.single('vrfile'),
  [
    //username must be an email
    (check('username', 'Username is required')
      .not()
      .isEmpty()
      .isEmail()
      .withMessage('Username must be an email'),
    //description cannot be empty
    check('description')
      .not()
      .isEmpty())
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).send({ errors: errors.array() });
    }
    res.send('hahaha');
    // manually handle file upload errors
    // uploadSingle(req, res, err => {
    //   if (err instanceof multer.MulterError) {
    //     res
    //       .status(400)
    //       .send({ error: 'A uknown error occurred when uploading.' });
    //   } else if (err) {
    //     res.status(422).send(errorResponse(err, 'vrfile', 'body'));
    //   } else {
    //     // if file is empty return error
    //     if (!req.file)
    //       res
    //         .status(422)
    //         .send(errorResponse('Please upload an image', 'vrfile', 'body'));
    //     // if express validator have error
    //     const errors = validationResult(req);
    //     if (!errors.isEmpty()) {
    //       res.status(422).send({ errors: errors.array() });
    //     }
    //     console.log(req.file);
    //   }
    // });
  }
);
router.get('/api/teststory/:id', async (req, res) => {
  console.log(req.params.id);
  try {
    var story = await Story.findById(req.params.id);
  } catch (err) {
    res.status(422).send(err);
  }
  console.log(story);
  res.send(story);
});

router.post(
  '/api/teststory',
  multer().none(),
  [
    check('testing')
      .not()
      .isEmpty()
  ],
  (req, res) => {
    // res.send(errorResponse('heyy'));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).send({ errors: errors.array() });
    }
    res.send('ok');
  }
);
module.exports = router;
