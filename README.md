Jaimito - Node.js Push Server for Twitter
=========================================

This is a simple HACK that eventually will evolve into a full feature Push Server (GCM/Android) for Twitter apps.

This is my first project in node.js and the code is a mess, and obviously not optimal.

Jaimito is the mailman in 'El Chavo del Ocho" TV Program (Or Jaiminho in Portuguese)
http://en.wikipedia.org/wiki/El_Chavo_del_Ocho
http://es.wikipedia.org/wiki/Jaimito_el_Cartero

It doesn't currently support GCM already (will be adding this weekend),
it just connects to the Twitter USER Stream for each registered user and
looks for direct messages, in_reply_to_screen_name with your screen_name,
and for your '@screen_name' in messages.

How to use it:

    $ npm install ntwitter nano string  (to install dependencies)
    $ node server.js config.js

You will need a couchdb running with a 'pushserver' db.

Copy configSample.js to config.js and configure the twitter and GCM keys.

Registering a user for push notifications:
POST to /register with

    {
      "screen_name":"twitter_screen_name",
      "access_token_key":"users_access_token_key",
      "access_token_secret":"users_access_token_secret",
      "gcm_registration_id":"gcm registration id"
    }

Unregistering for push notifications
POST /unregister

    {
      "screen_name":"twitter_screen_name"
    }
