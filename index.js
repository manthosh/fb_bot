'use strict'
const http = require('http')
const Bot = require('messenger-bot')

let bot = new Bot({
  token: process.env.PAGE_ACCESS_TOKEN,
  verify: 'testbot_verify_token'
})

bot.on('error', (err) => {
  console.log(err.message)
})

bot.on('message', (payload, reply) => {
  let text = payload.message.text

  bot.getProfile(payload.sender.id, (err, profile) => {
    if (err) {
        console.log(err);
        // throw err
    }
    else {
        reply({ text }, (err) => {
          if (err) {
            console.log(err);
            // throw err
        }
        else {
          console.log(`Echoed back to ${profile.first_name} ${profile.last_name}: ${text}`)
        }
        })
    }
  })
})

http.createServer(bot.middleware()).listen(process.env.PORT || 3000)