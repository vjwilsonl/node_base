var express = require('express');
var app = express();
var mongoose = require('mongoose');
//custom helper functions
var { errorResponse } = require('../services/responseParams');

module.exports = {
  validMongooseId: (req, res, next) => {
    if (req.params.id) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(422).send(errorResponse('Invalid ID', 'id'));
      }
    }
    next();
  }
};
