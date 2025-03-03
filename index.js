require('dotenv').config();  

const { Telegraf } = require('telegraf'); 
const { message } = require('telegraf/filters');
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token); 
bot.start((ctx) => { 
  ctx.reply('Привет! Я твой Telegram-бот.'); 
});

bot.on('message', (ctx) => {
  if (ctx.message.text) {  
    ctx.reply(ctx.message.text, {
      entities: ctx.message.entities, 
    });
  }
  
  console.log(ctx.message); 
});

bot.launch(); 