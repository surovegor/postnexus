require('dotenv').config();
const { Telegraf } = require('telegraf');
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token);

// Глобальные переменные
const userTimezones = new Map();
const userChannels = new Map();
const userSelectedChannels = new Map();

// Подключение обработчиков
const mainHandlers = require('./handlers/mainHandlers');
const channelHandlers = require('./handlers/channelHandlers');
const timeHandlers = require('./handlers/timeHandlers');

mainHandlers(bot, userTimezones, userChannels, userSelectedChannels);
channelHandlers(bot, userChannels, userSelectedChannels, userTimezones); // Передаем userTimezones
timeHandlers(bot, userTimezones, userSelectedChannels);

bot.launch();