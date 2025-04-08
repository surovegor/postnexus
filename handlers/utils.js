const { Markup } = require('telegraf');

const timezones = Array.from({ length: 24 }, (_, index) => ({
  offset: index,
  city: `UTC+${index}:00`,
}));

function getCurrentTime(offset) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const localTime = new Date(utc + 3600000 * offset);
  return localTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function getSettingsKeyboard(userId, userTimezones, userSelectedChannels) {
  const userTimezone = userTimezones.get(userId) || timezones[0];
  const currentTime = getCurrentTime(userTimezone.offset);
  const selectedChannel = userSelectedChannels.get(userId);
  const channelName = selectedChannel ? selectedChannel.name : 'Не выбран';

  return Markup.inlineKeyboard([
    [Markup.button.callback(`Часовой пояс: ${userTimezone.city} (${currentTime})`, 'timezone')],
    [Markup.button.callback(`Канал: ${channelName}`, 'select_channel')],
    [Markup.button.callback('Добавить канал', 'add_channel')],
    [Markup.button.callback('Справочная информация', 'add_channel')],
  ]);
}

module.exports = {
  getSettingsKeyboard,
  timezones,
  getCurrentTime,
};