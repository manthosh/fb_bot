'use strict'
const http = require('http');
const request = require('request');
const Bot = require('messenger-bot');
const express = require('express')
const bodyParser = require('body-parser')
const moment = require('moment');

const GOTO_COMMAND = "@goto";
const BASE_URI = "https://maps.googleapis.com/maps/api/distancematrix/json?";
const DELIMITER = "||";

const TRAFFIC_THRESHOLD = 1.25;
const CHECK_AFTER_TIME_IN_MILLI = 1800000;
const MODES = ["driving", "walking", "transit"];

const GREETINGS = ["hello", "hi", "good morning", "good afternoon", "good evening", "morning", "afternoon", "evening", "hey", "whats up", "sup", "hows it going", "howdy", "well hello", "why hello there", "yo", "greetings", "look who it is", "look what the cat dragged in", "hola"];
const ThUMBS_UP = "👍";

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

        if(!text) {
            replyBack(ThUMBS_UP, profile, reply);
        }
        else {

            let commands = text.split('/');
            if(commands.length >= 1 && commands[0] === GOTO_COMMAND) {
                let postbackText = getButtonTemplate("Pick an option?", getModesButtons(commands[1], commands[2]));
                console.log(postbackText);
                postBack(postbackText, payload.sender.id, profile);
            }
            else {
                let trimmedString = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g,"").replace(/\s{2,}/g," ").toLowerCase();

                if(GREETINGS.indexOf(trimmedString) > -1) {
                    text = `Hi ${profile.first_name}`;
                    //replyBack(text, profile, reply);
                    text += "\nTry @goto/<source>/<dest> for getting the time of travel";
                    replyBack(text, profile, reply);
                }
                else {
                    text = "That doesn't ring a bell. Try @goto/<source>/<dest>";
                    replyBack(text, profile, reply);
                }            
            }
        }
    }
  });
});

bot.on('postback', (payload, reply) => {
    let text = payload.postback.payload;
    bot.getProfile(payload.sender.id, (err, profile) => {
        let commands = text.split(DELIMITER);
        //replyBack(`${commands[1]} to ${commands[2]} via ${commands[0]}`, profile, reply);
        sendDirections(commands[1], commands[2], commands[0], commands[3], payload.sender.id, profile, reply);
    });
})

var sendDirections = function(source, destination, mode, departure_time, recipient, profile, reply) {
    let params = `origins=${encodeURIComponent(source)}&destinations=${encodeURIComponent(destination)}&mode=${mode}&departure_time=${departure_time || 'now'}&key=${process.env.GOOGLE_API_TOKEN}`;
    console.log(`Google url : ${BASE_URI+params}`);
    request(BASE_URI+params, function (error, response, body) {
          if (!error && response.statusCode == 200) {
                //console.log(`Google response : ${body}`)

                let googleResponse = JSON.parse(body);

                if(googleResponse.status === "OK" && googleResponse.rows.length > 0) {

                    let googleSrc = googleResponse.origin_addresses[0], googleDest = googleResponse.destination_addresses[0];

                    if(googleSrc.trim() == "" ){
                        replyBack(`Sorry ${profile.first_name}. Google doesn't recognise ${source}. Although it's not right always, I'm not of much help without it!!`, profile, reply);
                        return;
                    }
                    else if (googleDest.trim() == "") {
                        replyBack(`Sorry ${profile.first_name}. Google doesn't recognise ${destination}. Although it's not right always, I'm not of much help without it!!`, profile, reply);
                        return;
                    }

                    let route = googleResponse.rows[0].elements[0];

                    if(route.status == "OK") {
                        let normalTime = route.duration.value;
                        let text = `The normal time taken for traveling from ${googleSrc} to ${googleDest} via ${mode} is ${route.duration.text}.`; 

                        let buttons = [ 
                            {
                                "type" : "web_url",
                                //"url" : `https://www.google.com/maps/dir/${googleResponse.origin_addresses[0]}/${googleResponse.destination_addresses[0]}`,
                                "url" : `https://maps.google.com?saddr=${googleSrc.replace(' ','+')}&daddr=${googleDest.replace(' ','+')}`,
                                "title" : "Open Google Maps"
                            }
                        ];

                        if(mode === MODES[0]) {

                            let departure_time_moment = moment(parseInt(departure_time) || Date.now()).utcOffset(profile.timezone);

                            let trafficTime = route.duration_in_traffic.value;
                            if(!departure_time) {
                                text += `With the current traffic, it might take ${route.duration_in_traffic.text} and `;
                            }
                            else {
                                text += `With the expected traffic at ${departure_time_moment.format("HH:mm")}, it might take ${route.duration_in_traffic.text} and `;
                            }

                            if((trafficTime/normalTime) <= TRAFFIC_THRESHOLD) {
                                text += "so it's ideal to start "+(!departure_time?"now":"at "+departure_time_moment.format("HH:mm"))+".";
                            }
                            else {
                                text += "so it's better to start after a while.";
                            }

                            let laterButton = {
                                "type" : "postback",
                                "title" : "Check after 30 min",
                                "payload" : MODES[0]+DELIMITER+source+DELIMITER+destination+DELIMITER+(departure_time_moment.valueOf()+CHECK_AFTER_TIME_IN_MILLI)
                            };

                            buttons.push(laterButton);
                        }

                        postBack(getButtonTemplate(text, buttons), recipient, profile);
                    }
                    else if(route.status == "ZERO_RESULTS") {
                        replyBack(`Sorry ${profile.first_name}. Google didn't find any route between ${googleSrc} and ${googleDest}. If you are sure Google is wrong, why not try giving more details?\nLike @goto/<place name> <city> <country>/dest`, profile, reply);
                    }
                    else {
                        sendErrorMsg(body, error, profile, reply);
                    }
                }
                else {
                    sendErrorMsg(body, error, profile, reply);
                }
          }
          else {
                sendErrorMsg(body, error, profile, reply);  
          }
    })
}

var sendErrorMsg = function(body, error, profile, reply) {
    console.log("Error occured with Google API. ");
    console.log(body)
    console.log(error);
    replyBack(`Sorry ${profile.first_name}. I'm having a slight head ache. Come back later!!`, profile, reply);
}

var getModesButtons = function(source, dest) {

    var buttons = [];

    MODES.map(function(mode) {
        let obj = {
            "type":"postback",
            "title":mode,
            "payload":mode+DELIMITER+source+DELIMITER+dest
        }
        buttons.push(obj);
    });

    return buttons;
}

var getButtonTemplate = function(title, buttons) {
    return {
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"button",
                        "text":title,
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