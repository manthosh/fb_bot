'use strict'
const http = require('http');
const request = require('request');
const Bot = require('messenger-bot');
const express = require('express')
const bodyParser = require('body-parser')

const GOTO_COMMAND = "@goto";
const BASE_URI = "https://maps.googleapis.com/maps/api/distancematrix/json?";
const DELIMITER = "||";

const TRAFFIC_THRESHOLD = 1.25;
const MODES = ["driving", "walking", "transit"];

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
            // let params = `origins=${encodeURIComponent(commands[1])}&destinations=${encodeURIComponent(commands[2])}&mode=driving&departure_time=now&key=${process.env.GOOGLE_API_TOKEN}`;
            // console.log(`Google url : ${BASE_URI+params}`);
            // request(BASE_URI+params, function (error, response, body) {
            //       if (!error && response.statusCode == 200) {
            //             console.log(`Google response : ${body}`)

            //             let googleResponse = JSON.parse(body);

            //             if(googleResponse.status === "OK") {
            //                 let route = googleResponse.rows[0].elements[0];

            //                 let normalTime = route.duration.value;
            //                 let trafficTime = route.duration_in_traffic.value;
            //                 let text = `The normal time taken for traveling from ${googleResponse.origin_addresses[0]} to ${googleResponse.destination_addresses[0]} is ${route.duration.text}. With the current traffic it might take ${route.duration_in_traffic.text} and `;

            //                 if((trafficTime/normalTime) <= TRAFFIC_THRESHOLD) {
            //                     text += "so it's ideal to start now.";
            //                 }
            //                 else {
            //                     text += "so it's better to start after a while.";
            //                 }
            //                 replyBack(text, profile, reply);
            //             }
            //             else {
            //                 console.log("Error occured with Google API. ");
            //                 console.log(body);
            //                 replyBack(`Sorry ${profile.first_name}. I'm having a temporary head ache. Come back later!!`, profile, reply);      
            //             }
            //       }
            //       else {
            //             console.log("Error occured with Google API. ");
            //             console.log(error);
            //             replyBack(`Sorry ${profile.first_name}. I'm having a temporary head ache. Come back later!!`, profile, reply);  
            //       }
            // })
            let postbackText = getPostback(commands[1], commands[2]);
            console.log(postbackText);
            postBack(postbackText, payload.sender.id, profile);
        }
        else {
            text = "That doesn't ring a bell. Try @goto/<source>/<dest>";
            replyBack(text, profile, reply);
        }
    }
  });
});

bot.on('postback', (payload, reply) => {
    let text = payload.postback.payload;
    bot.getProfile(payload.sender.id, (err, profile) => {
        let commands = text.split(DELIMITER);
        replyBack(`${commands[1]} to ${commands[2]} via ${commands[0]}`, profile, reply);
    });
})

var getPostback = function(source, dest) {

    var buttons = [];

    MODES.map(function(mode) {
        let obj = {
            "type":"postback",
            "title":mode,
            "payload":mode+DELIMITER+source+DELIMITER+dest
        }
        buttons.push(obj);
    });

    return {
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"button",
                        "text":"Pick an option?",
                        "buttons":buttons
                    }
                }
            };
}

var postBack = function(message, recipient, profile) {
    request({
        method : 'POST',
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN
        },
        headers: {
            "Content-Type": "application/json"
        },
        json: {
            recipient: {id: recipient},
            message: message
        }
    }, (error, response, body) => {
        if (error) {
            console.log(`Error occured while sending msg to ${profile.first_name}  ${profile.last_name}: ${message}`);
            console.log(error);
            console.log(body);
        }
        else {
            console.log(`Echoed back to ${profile.first_name} ${profile.last_name}: ${message}`);  
            console.log(body);
        }
    })
}

var replyBack = function(text, profile, reply) {
    reply({text}, (err) => {
        if (err) {
            console.log(`Error occured while sending msg to ${profile.first_name}  ${profile.last_name}: ${text}`);
            console.log(err);
            console.log(text);
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

app.get('/_getlongtoken', (req, res) => {
    let params = `grant_type=fb_exchange_token&client_id=${encodeURIComponent(process.env.APP_ID)}&client_secret=${process.env.APP_SECRET}&fb_exchange_token=${process.env.PAGE_ACCESS_TOKEN}`;
    console.log("Token URL : "+"https://graph.facebook.com/v2.6/me/oauth/access_token?"+params);
    request("https://graph.facebook.com/oauth/access_token?"+params, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log("test : "+body);
            return res.end(body);
        }
        else {
            console.log(`Error occured ${error}`);
            return res.end(`Error occured : ${JSON.stringify(error)}\n${body}`);
        }
    });
    //res.send("Loading...");
})

http.createServer(app).listen(process.env.PORT || 3000)