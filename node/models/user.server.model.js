/**
 * Created by HUI on 16/9/9.
 */
var mongoose = require('mongoose');

var UserSchema = mongoose.Schema({
    username: String,
    password: String,
    subject:[]
});

mongoose.model('User', UserSchema);