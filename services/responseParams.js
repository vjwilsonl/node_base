/**
 *
 * @responseParams.js
 * Helper functions to return successful or error response API data
 *
 */
module.exports = {
  errorResponse: (msg, params = null, location = null) => {
    return {
      errors: [{ msg: msg, param: params, location: location }]
    };
  },
  successResponse: (data = null, message) => {
    return {
      data,
      message
    };
  }
};
