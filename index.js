require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.use(session()); // Инициализация сессии
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {}; 
  }
  return next();
});

// Глобальные переменные
const userTimezones = new Map();
const userChannels = new Map();
const userSelectedChannels = new Map();
const scheduledPosts = new Map();

// Подключение обработчиков
const mainHandlers = require('./handlers/mainHandlers');
const channelHandlers = require('./handlers/channelHandlers');
const timeHandlers = require('./handlers/timeHandlers');
const postHandlers = require('./handlers/postHandlers');
const contentPlanHandler = require('./handlers/contentPlanHandlers');

mainHandlers(bot, userTimezones, userChannels, userSelectedChannels);
channelHandlers(bot, userChannels, userSelectedChannels, userTimezones);
timeHandlers(bot, userTimezones, userSelectedChannels);
contentPlanHandler(bot, userSelectedChannels, scheduledPosts);
postHandlers(bot, userSelectedChannels, scheduledPosts);

bot.launch();