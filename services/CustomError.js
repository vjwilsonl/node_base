class CustomError extends Error {
  constructor(status = null, message) {
    super(message);
    this.status = status;
  }
}

module.exports = CustomError;
