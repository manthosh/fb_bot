'use strict'
const http = require('http');
const request = require('request');
const Bot = require('messenger-bot');
const express = require('express')
const bodyParser = require('body-parser')

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
            let params = `origins=${encodeURIComponent(commands[1])}&destinations=${encodeURIComponent(commands[2])}&mode=driving&departure_time=now&key=${process.env.GOOGLE_API_TOKEN}`;
            console.log(`Google url : ${BASE_URI+params}`);
            request(BASE_URI+params, function (error, response, body) {
                  if (!error && response.statusCode == 200) {
                        console.log(`Google response : ${body}`)
                         replyBack(body, profile, reply);  
                  }
                  else {
                        console.log("Error occured with Google API. ");
                        console.log(error);
                        replyBack(`Sorry ${profile.first_name}. I'm having a temporary head ache. Come back later!!`, profile, reply);  
                  }
            })
        }
        else {
            text = "That doesn't ring a bell. Try @goto/<source>/<dest>";
            replyBack(text, profile, reply);
        }
    }
  });
});

var replyBack = function(text, profile, reply) {
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

//http.createServer(bot.middleware()).listen(process.env.PORT || 3000);

let app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

app.get('/', (req, res) => {
  return bot._verify(req, res)
})

app.post('/', (req, res) => {
  bot._handleMessage(req.body)
  res.end(JSON.stringify({status: 'ok'}))
})

app.get('/_status', (req, res) => {
    return res.end(JSON.stringify({status: 'ok'}));
})

http.createServer(app).listen(process.env.PORT || 3000)