'use strict'
const http = require('http');
const request = require('request');
const Bot = require('messenger-bot');

const GOTO_COMMAND = "@goto";
const BASE_URI = "https://maps.googleapis.com/maps/api/distancematrix/json?";

let bot = new Bot({
  token: process.env.PAGE_ACCESS_TOKEN,
  verify: 'testbot_verify_token'
});

bot.on('error', (err) => {
  console.log(err.message);
});

bot.on('message', (payload, reply) => {
  let text = payload.message.text;

  bot.getProfile(payload.sender.id, (err, profile) => {
    if (err) {
        console.log(err);
        // throw err
    }
    else {
        let commands = text.split('/');
        if(commands.length >= 1 && commands[0] === GOTO_COMMAND) {
            let url = `${BASE_URI}origins=${commands[1]}&destinations=${commands[2]}&mode=driving&departure_time=now&key=${process.env.GOOGLE_API_TOKEN}`;
            request(encodeURIComponent(url), function (error, response, body) {
                  if (!error && response.statusCode == 200) {
                        console.log(`Google response : ${body}`) // Show the HTML for the Google homepage.
                        reply({text}, (err) => {
                            if (err) {
                                console.log(err);
                                // throw err
                            }
                            else {
                              console.log(`Echoed back to ${profile.first_name} ${profile.last_name}: ${text}`);
                            }
                        });     
                  }
            })
        }
        else {
            text = "That doesn't ring a bell. Try @goto/<source>/<dest>";
            reply({text}, (err) => {
                if (err) {
                    console.log(err);
                    // throw err
                }
                else {
                  console.log(`Echoed back to ${profile.first_name} ${profile.last_name}: ${text}`);
                }
            });
        }
    }
  });
});

http.createServer(bot.middleware()).listen(process.env.PORT || 3000);