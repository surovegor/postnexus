// handlers/channelHandlers.js
const { Markup } = require('telegraf');
const { getSettingsKeyboard } = require('./utils');

module.exports = function(bot, userChannels, userSelectedChannels, userTimezones) {
  // Обработчик кнопки "Добавить канал"
  bot.action('add_channel', (ctx) => {
    const instructions = 
`Чтобы подключить канал, сделайте @PostNexusBot его администратором, дав следующие права:
- Редактирование сообщений

Затем отправьте публичную ссылку на ваш канал.`;

    ctx.reply(instructions);

    // Устанавливаем состояние "добавление канала"
    ctx.session.addingChannel = true;
  });

  // Обработчик для получения ссылки на канал
  bot.hears(/https:\/\/t\.me\//, (ctx) => {
    // Проверяем, находится ли пользователь в состоянии "добавление канала"
    if (ctx.session.addingChannel) {
      const userId = ctx.from.id;
      const channelLink = ctx.message.text;

      const channelName = `@${channelLink.split('/').pop()}`;
      const channelId = `channel_${Date.now()}`;

      if (!userChannels.has(userId)) {
        userChannels.set(userId, []);
      }
      const channels = userChannels.get(userId);
      channels.push({ id: channelId, name: channelName, link: channelLink });

      // Если это первый канал, автоматически выбираем его
      if (channels.length === 1) {
        userSelectedChannels.set(userId, channels[0]);
      }

      ctx.reply(`Канал "${channelName}" успешно добавлен!`, {
        reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
      });

      // Сбрасываем состояние
      ctx.session.addingChannel = false;
    }
  });

  // Обработчик кнопки "Выбрать канал"
  bot.action('select_channel', (ctx) => {
    const userId = ctx.from.id;
    const channels = userChannels.get(userId) || [];

    if (channels.length === 0) {
      ctx.answerCbQuery('У вас нет добавленных каналов.');
      return;
    }

    const channelKeyboard = Markup.inlineKeyboard([
      ...channels.map(channel => [
        Markup.button.callback(channel.name, `choose_channel_${channel.id}`),
      ]),
      [Markup.button.callback('Удалить канал', 'delete_channel')],
      [Markup.button.callback('Назад', 'back_to_settings')],
    ]);

    ctx.editMessageText('Выберите канал:', {
      reply_markup: channelKeyboard.reply_markup,
    });
  });

  // Обработчик выбора канала
  bot.action(/choose_channel_(.+)/, (ctx) => {
    const userId = ctx.from.id;
    const channelId = ctx.match[1];
    const channels = userChannels.get(userId) || [];
    const selectedChannel = channels.find(channel => channel.id === channelId);

    if (selectedChannel) {
      userSelectedChannels.set(userId, selectedChannel); // Сохраняем выбранный канал
      ctx.editMessageText(`Выбран канал: ${selectedChannel.name}`, {
        reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
      });
      ctx.answerCbQuery(`✅ Канал "${selectedChannel.name}" выбран.`);
    }
  });

  // Обработчик кнопки "Удалить канал"
  bot.action('delete_channel', (ctx) => {
    const userId = ctx.from.id;
    const channels = userChannels.get(userId) || [];

    if (channels.length === 0) {
      ctx.answerCbQuery('У вас нет добавленных каналов.');
      return;
    }

    const deleteKeyboard = Markup.inlineKeyboard([
      ...channels.map(channel => [
        Markup.button.callback(`Удалить ${channel.name}`, `delete_channel_${channel.id}`),
      ]),
      [Markup.button.callback('Назад', 'back_to_settings')],
    ]);

    ctx.editMessageText('Выберите канал для удаления:', {
      reply_markup: deleteKeyboard.reply_markup,
    });
  });

  // Обработчик удаления канала
  bot.action(/delete_channel_(.+)/, (ctx) => {
    const userId = ctx.from.id;
    const channelId = ctx.match[1];
    const channels = userChannels.get(userId) || [];
    const updatedChannels = channels.filter(channel => channel.id !== channelId);

    userChannels.set(userId, updatedChannels);

    const selectedChannel = userSelectedChannels.get(userId);
    if (selectedChannel && selectedChannel.id === channelId) {
      userSelectedChannels.delete(userId);
    }

    ctx.editMessageText('Канал успешно удален.', {
      reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
    });
    ctx.answerCbQuery('✅ Канал удален.');
  });

  // Обработчик кнопки "Назад в настройки"
  bot.action('back_to_settings', (ctx) => {
    const userId = ctx.from.id;
    ctx.editMessageText('Выберите настройку:', {
      reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
    });
  });

  // Обработчик кнопки "Назад в главное меню"
  bot.action('back_to_main', (ctx) => {
    ctx.reply('Возвращаемся в главное меню:', menuKeyboard);
  });
};