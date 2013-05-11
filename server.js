var twitter = require('ntwitter');
var http = require("http");
var db = require('nano')('http://127.0.0.1:5984/pushserver');
var S = require("string");
var config = require(userConfig());

var currentUsers = {};
var streams = {};

function userConfig() {
    return process.argv[2] ?
        process.argv[2].replace(/.js$/, '') :
        './config'
}

function HttpServer() {
    this.server = http.createServer(function(req, res) {
        handleHttpRequest(req, res);
    }).listen(SERVER_PORT);
}

/* Handle requests for registering or unregistering and user for PUSH
 *
 * For REGISTER it expects an JSON body with
 * { "screen_name":"twitter_screen_name",
 *   "access_token_key":"users_access_token_key",
 *   "access_token_secret":"users_access_token_secret",
 *   "gcm_registration_id":"gcm registration id"
 * }
 *
 * For UNREGISTER a simple JSON with just the screen_name
 * is enough...
 *
 * TODO - Add https support and better error handling and parsing.
 * For now, it is best to use this with some https webservice that sends
 * the information to us...
 */
function handleHttpRequest(req, res) {
    switch (req.url) {
        case '/register':
            if (req.method == 'POST') {
                console.log("[200] " + req.method + " to " + req.url);

                var ok = false;
                req.on('data', function(chunk) {
                    var user = JSON.parse(chunk.toString());
                    ok = savePushUser(user);
                });

                req.on('end', function() {
                    // empty 200 OK response for now
                    if (ok === true) {
                        var body = '{"status":0}';
                        res.writeHead(200, "OK", {
                            'Content-Length': body.length,
                            'Content-Type': 'application/json'
                        });
                        res.write(body);
                        res.end();
                    } else {
                        sendErrorResponse(req, res);
                    }
                });

            } else {
                sendErrorResponse(req, res);
            }
            break;
        case '/unregister':
            if (req.method == 'POST') {
                console.log("[200] " + req.method + " to " + req.url);

                req.on('data', function(chunk) {
                    var user = JSON.parse(chunk.toString());
                    console.log("Unregister: " + user);

                    var stream = streams[user.screen_name];
                    if (stream !== null) {
                        console.log("destroying stream for " + stream.user.screen_name);
                        currentUsers[user.screen_name] = false;
                        stream.stream.destroy();
                        streams[user.screen_name] = null;
                        db.destroy(stream.user.screen_name, stream.user._rev, function(err, body) {
                            if (!err)
                                console.log(body);
                        });
                    }
                });

                req.on('end', function() {
                    // empty 200 OK response for now
                    var body = '{"status":1}';
                    res.writeHead(200, "OK", {
                        'Content-Length': body.length,
                        'Content-Type': 'application/json'
                    });
                    res.write(body);
                    res.end();
                });

            } else {
                sendErrorResponse(res);
            }
    }
}

function sendErrorResponse(req, res) {
    console.log("[405] " + req.method + " to " + req.url);
    var body = '{"message":"Method not supported"}';
    res.writeHead(405, "Method not supported", {
        'Content-Length': body.length,
        'Content-Type': 'application/json'
    });
    res.write(body);
    res.end();
}

function savePushUser(user) {
    if (currentUsers[user.screen_name]) {
        console.log("user: " + user.screen_name + " already running");
        db.insert(user, user.screen_name, function(err, body) {
            if (!err)
                console.log(body);
        });
    } else {
        setupTwitterUserStream(user);
        console.log("Adding user: " + user.screen_name);
    }
    return true;
}

function setupTwitterUserStream(user) {
    var twit = new twitter({
        consumer_key: twitter_key,
        consumer_secret: twitter_secret,
        access_token_key: user.access_token_key,
        access_token_secret: user.access_token_secret,
        screen_name: user.screen_name
    });

    user.reestart_on_destroy = true;
    currentUsers[user.screen_name] = true;

    twit.stream('user', function(stream) {
        stream.on('data', function(tweet) {
            if (tweet.hasOwnProperty("friends")) {
                console.log("User stream connected: " + user.screen_name);
            } else if (tweet.hasOwnProperty("direct_message") &&
                tweet.direct_message.sender_screen_name !== user.screen_name) {
                console.log("got message: " + tweet.direct_message.text +
                    " from: " + tweet.direct_message.sender_screen_name);
                sendPushMessage(user, tweet);
            } else if (tweet.hasOwnProperty("text")) {
                if ((tweet.in_reply_to_screen_name !== null &&
                    tweet.in_reply_to_screen_name == user.screen_name) ||
                    S(tweet.text).contains("@" + user.screen_name + " ") ||
                    S(tweet.text).contains(" @" + user.screen_name)) {
                    console.log("New message for: " + user.screen_name);
                    sendPushMessage(user, tweet);
                }
            } else {
                console.log(tweet);
            }
        });
        stream.on('destroy', function(message) {
            if (currentUsers[user.screen_name] === false)
                return;
            console.log("Stream DESTROY, recreating it");
            streams[user.screen_name] = null;
            setupTwitterUserStream(user);
        });
        db.insert(user, user.screen_name, function(err, body) {
            if (!err)
                console.log(body);
            db.get(user.screen_name, function(err, body) {
                if (!err)
                    streams[user.screen_name] = { user:body, stream:stream };
            });
        });
    });
}

/* TODO - implement GCM push sending...
 * Maybe use node2cm from instagram (updated to GCM).
 */
function sendPushMessage(user, tweet) {
    console.log("Sending push for " + user.screen_name);
}

/* Initialize saved users on start... */
db.list({include_docs:true}, function(err, body) {
    if (!err) {
        body.rows.forEach(function(doc) {
            /*db.get(doc.key, function(err, body) {
                if (!err)
                    console.log(body);
            });*/
            console.log(doc);
            setupTwitterUserStream(doc.doc);
        });
    }
});

console.log("Port: " + process.env.PORT + " Server: " + process.env.HOST);
var connection = new HttpServer();
