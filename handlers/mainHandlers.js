const { Markup } = require('telegraf');
const { getSettingsKeyboard, timezones, getCurrentTime } = require('./utils');

const welcomeMessage = 
`*PostNexus* — это простой и удобный бот для отложенного постинга, поддерживающий работу с любыми форматами контента.

*Бот позволяет:*

✔️ Планировать выход публикаций в ваших каналах
✔️ Автоматически удалять их по расписанию
✔️ Создавать и настраивать посты любого формата
✔️ И многое другое`;

const menuKeyboard = { 
  reply_markup: {
    keyboard: [
      ['Создать пост', 'Контент-план'],
      ['Настройки']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

module.exports = function(bot, userTimezones, userChannels, userSelectedChannels) {
  bot.start((ctx) => {
    ctx.reply(welcomeMessage, { parse_mode: 'Markdown', ...menuKeyboard });
  });


  bot.hears('Настройки', (ctx) => {
    const userId = ctx.from.id;
    ctx.reply('Выберите настройку:', getSettingsKeyboard(userId, userTimezones, userSelectedChannels));
  });
};