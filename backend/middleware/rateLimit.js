const express = require("express");
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
    max: 6,
    windowMs: 60 * 60 * 1000,
    message: "Too many request from this IP"
 });

 module.exports = limiter;