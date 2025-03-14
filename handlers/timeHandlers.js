const { Markup } = require('telegraf');
const { getSettingsKeyboard, timezones, getCurrentTime } = require('./utils');

module.exports = function(bot, userTimezones, userSelectedChannels) {
  function getTimezoneKeyboard() {
    return Markup.inlineKeyboard(
      timezones.map(({ city, offset }) => [
        Markup.button.callback(`${city} (${getCurrentTime(offset)})`, `set_timezone_${offset}`),
      ]),
    );
  }

  bot.action('timezone', (ctx) => {
    ctx.editMessageText('Выберите часовой пояс. Время выхода постов будет отображаться в вашем часовом поясе.', {
      reply_markup: getTimezoneKeyboard().reply_markup,
    });
  });

  bot.action(/set_timezone_(\d+)/, (ctx) => {
    const userId = ctx.from.id;
    const offset = parseInt(ctx.match[1]);
    const selectedTimezone = timezones.find((tz) => tz.offset === offset);

    if (selectedTimezone) {
      userTimezones.set(userId, selectedTimezone);

      ctx.editMessageText('Выберите настройку:', {
        reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
      });

      ctx.answerCbQuery(`✅ Часовой пояс изменен на ${selectedTimezone.city}`);
    }
  });
};