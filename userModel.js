const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstname: String,
    lastname: String,
    phone: String,
    email: String,
    password: String,
    isAdmin: false,
    owns: Array,
    saved: Array,
    bio: String
  });

const User = mongoose.model('User', userSchema)
module.exports = User
