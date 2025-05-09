const responseHandler = (req, res, next) => {
  res.sendSuccess = (data = {}, message = 'Success') => {
    return res.json({
      success: true,
      ...data,
      message
    });
  };

  res.sendError = (message = 'Error', statusCode = 400) => {
    return res.status(statusCode).json({
      success: false,
      message
    });
  };

  next();
};

module.exports = responseHandler;