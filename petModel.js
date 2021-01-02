const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    'type': String,
    'name': String,
    'status': String,
    'picture': String,
    'height': Number,
    'weight': Number,
    'color': String,
    'bio': String,
    'hypoallergenic': Boolean,
    'dietary restrictions': String,
    'breed': String,
    'owner': String,
    'keywords' : Array
  });

const Pet = mongoose.model('Pet', petSchema)
module.exports = Pet
