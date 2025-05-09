const responseHandler = (req, res, next) => {
    res.json = function(data) {
        return res.contentType('application/json').send(JSON.stringify(data));
    };
    
    res.success = function(data = {}, message = 'Success') {
        return this.json({
            success: true,
            ...data,
            message
        });
    };

    res.error = function(message = 'Error', statusCode = 400) {
        return this.status(statusCode).json({
            success: false,
            message
        });
    };

    next();
};

module.exports = responseHandler;