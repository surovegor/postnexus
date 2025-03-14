const { Markup } = require('telegraf');
const { getSettingsKeyboard } = require('./utils');

module.exports = function(bot, userChannels, userSelectedChannels, userTimezones) {
  bot.action('add_channel', (ctx) => {
    const instructions = 
`Чтобы подключить канал, сделайте @posted его администратором, дав следующие права:
- Редактирование сообщений

Затем отправьте публичную ссылку на ваш канал.`;

    ctx.reply(instructions);

    bot.on('message', (ctx) => {
      const channelLink = ctx.message.text;
      const userId = ctx.from.id;

      if (channelLink.startsWith('https://t.me/')) {
        const channelName = channelLink.split('/').pop();
        const channelId = `channel_${Date.now()}`;

        if (!userChannels.has(userId)) {
          userChannels.set(userId, []);
        }
        const channels = userChannels.get(userId);
        channels.push({ id: channelId, name: channelName, link: channelLink });

        if (channels.length === 1) {
          userSelectedChannels.set(userId, channels[0]);
        }

        ctx.reply(`Канал "${channelName}" успешно добавлен!`, {
          reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
        });
      } else {
        ctx.reply('Пожалуйста, отправьте корректную публичную ссылку на канал.');
      }
    });
  });

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

  bot.action('back_to_settings', (ctx) => {
    const userId = ctx.from.id;
    ctx.editMessageText('Выберите настройку:', {
      reply_markup: getSettingsKeyboard(userId, userTimezones, userSelectedChannels).reply_markup,
    });
  });

  bot.action('back_to_main', (ctx) => {
    ctx.reply('Возвращаемся в главное меню:', menuKeyboard);
  });
};