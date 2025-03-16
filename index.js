// index.js
require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token);

// Инициализация сессии
bot.use(session());
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {}; // Инициализируем session, если он не существует
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

mainHandlers(bot, userTimezones, userChannels, userSelectedChannels);
channelHandlers(bot, userChannels, userSelectedChannels, userTimezones);
timeHandlers(bot, userTimezones, userSelectedChannels);
postHandlers(bot, userSelectedChannels, scheduledPosts);

bot.launch();