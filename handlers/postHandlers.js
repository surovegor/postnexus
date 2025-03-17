const { Markup } = require('telegraf');

module.exports = function (bot, userSelectedChannels, scheduledPosts) {
  function startCreatingPost(ctx) {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    ctx.reply(`Пост будет опубликован в канале ${selectedChannel.name}.\n\nТеперь отправьте боту то, что хотите опубликовать.`);
    ctx.session.creatingPost = true; // Устанавливаем состояние "создание поста"
  }

  bot.command('newpost', (ctx) => startCreatingPost(ctx)); // Обработчик команды /newpost
  bot.hears('Создать пост', (ctx) => startCreatingPost(ctx)); // Обработчик кнопки "Создать пост"

  bot.on('message', async (ctx) => {
    if (ctx.session.creatingPost) {
      const userId = ctx.from.id;
      const selectedChannel = userSelectedChannels.get(userId);

      if (!selectedChannel) {
        ctx.reply('Сначала выберите канал в настройках.');
        return;
      }

      const postContent = {
        text: ctx.message.text || ctx.message.caption,
        entities: ctx.message.entities || ctx.message.caption_entities,
        media: ctx.message.photo ? ctx.message.photo[0].file_id : null, // Если есть фото
      };

      ctx.session.postContent = postContent; // Сохраняем пост для предпросмотра

      if (postContent.media) {
        await ctx.replyWithPhoto(postContent.media, {
          caption: postContent.text,
          caption_entities: postContent.entities,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отложить', callback_data: 'schedule_post' }],
            ],
          },
        });
      } else if (postContent.text) {
        await ctx.reply(postContent.text, {
          entities: postContent.entities,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отложить', callback_data: 'schedule_post' }],
            ],
          },
        });
      }

      ctx.session.creatingPost = false; // Сбрасываем состояние "создание поста"
      return;
    }

    if (ctx.session.schedulingPost && ctx.message.text) {
      const userId = ctx.from.id;
      const selectedChannel = userSelectedChannels.get(userId);

      if (!selectedChannel) {
        ctx.reply('Сначала выберите канал в настройках.');
        return;
      }

      const timeInput = ctx.message.text;
      const [datePart, timePart] = timeInput.split(' ');

      if (!datePart || !timePart) {
        ctx.reply('Некорректный формат времени. Используйте формат ДД.ММ.ГГГГ ЧЧ:ММ.');
        return;
      }

      const [day, month, year] = datePart.split('.');
      const [hour, minute] = timePart.split(':');

      if (!day || !month || !year || !hour || !minute) {
        ctx.reply('Некорректный формат времени. Используйте формат ДД.ММ.ГГГГ ЧЧ:ММ.');
        return;
      }

      const scheduledTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

      if (isNaN(scheduledTime.getTime())) {
        ctx.reply('Некорректная дата или время. Попробуйте снова.');
        return;
      }

      if (scheduledTime.getTime() <= Date.now()) {
        ctx.reply('Время публикации должно быть в будущем.');
        return;
      }

      const post = {
        channelId: selectedChannel.id,
        content: ctx.session.postContent,
        time: scheduledTime,
      };

      const key = `${userId}_${selectedChannel.id}`; // Ключ для хранения постов

      if (!scheduledPosts.has(key)) {
        scheduledPosts.set(key, []);
      }

      scheduledPosts.get(key).push(post);

      ctx.reply(`Пост запланирован на ${scheduledTime.toLocaleString('ru-RU')}.`);

      setInterval(async () => {
        const now = new Date();
      
        for (const [key, posts] of scheduledPosts.entries()) {
          const readyPosts = posts.filter(post => post.time <= now);
      
          for (const post of readyPosts) {
            const channelId = post.channelId;
            try {
              if (post.content.media) {
                await bot.telegram.sendPhoto(selectedChannel.name, post.content.media, {
                  caption: post.content.text,
                  caption_entities: post.content.entities,
                });
              } else {
                await bot.telegram.sendMessage(selectedChannel.name, post.content.text, {
                  entities: post.content.entities,
                });
              }
              console.log(`✅ Пост опубликован в ${channelId} в ${now.toLocaleString('ru-RU')}`);
            } catch (err) {
              console.error(`❌ Ошибка при публикации поста в ${channelId}:`, err);
            }
          }
      
          // Удаляем уже опубликованные посты
          const remainingPosts = posts.filter(post => post.time > now);
          scheduledPosts.set(key, remainingPosts);
        }
      }, 60 * 1000); // Проверка каждую минуту
      
      

      ctx.session.schedulingPost = false;
      return;
    }
  });

  bot.action('schedule_post', (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const now = new Date();
    const suggestedTime = new Date(now.getTime() + 60000); // +1 минута
    const formattedTime = suggestedTime.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', '');

    ctx.reply(`Введите время публикации в формате ДД.ММ.ГГГГ ЧЧ:ММ (например, ${formattedTime}):`);
    ctx.session.schedulingPost = true;
  });
};