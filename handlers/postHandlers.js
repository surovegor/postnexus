const { Markup } = require('telegraf');

module.exports = function (bot, userSelectedChannels, scheduledPosts) {
  function startCreatingPost(ctx) { // Обработчик кнопки "Создать пост"
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

  bot.on('message', async (ctx) => { // Обработчик для получения контента поста
    if (ctx.session.creatingPost) { // Проверяем, находится ли пользователь в состоянии "создание поста"
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

      if (postContent.media) { // Дублируем пост для проверки
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
      return; // Важно: завершаем обработку, чтобы не попасть в другие обработчики
    }

  if (ctx.session.schedulingPost && ctx.message.text) { // Проверяем, находится ли пользователь в состоянии "ввод времени"
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const timeInput = ctx.message.text;
   
    const [datePart, timePart] = timeInput.split(' '); // Разбираем строку на компоненты даты и времени
    if (!datePart || !timePart) {
      ctx.reply('Некорректный формат времени. Используйте формат ДД.ММ.ГГГГ ЧЧ:ММ.');
      return;
    }

    const [day, month, year] = datePart.split('.');
    const [hour, minute] = timePart.split(':');

    if (!day || !month || !year || !hour || !minute) { // Проверяем, что все компоненты даты и времени присутствуют
      ctx.reply('Некорректный формат времени. Используйте формат ДД.ММ.ГГГГ ЧЧ:ММ.');
      return;
    }

    const scheduledTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

    if (isNaN(scheduledTime.getTime())) {
      ctx.reply('Некорректная дата или время. Попробуйте снова.'); // Проверяем, что дата корректна
      return;
    }

    if (scheduledTime.getTime() <= Date.now()) { // Проверяем, что время в будущем
      ctx.reply('Время публикации должно быть в будущем.');
      return;
    }
    
    const post = { // Сохраняем пост
      channelId: selectedChannel.id,
      content: ctx.session.postContent,
      time: scheduledTime,
    };

    if (!scheduledPosts.has(userId)) 
      scheduledPosts.set(userId, []);
    
    scheduledPosts.get(userId).push(post);

    ctx.reply(`Пост запланирован на ${scheduledTime.toLocaleString('ru-RU')}.`);
    console.log(selectedChannel);
    
    const delay = scheduledTime.getTime() - Date.now(); // Запускаем таймер для публикации
    if (delay > 0) {
      setTimeout(() => {
        if (post.content.media) {
          ctx.telegram.sendPhoto(selectedChannel.name, post.content.media, {
            caption: post.content.text,
            caption_entities: post.content.entities,
          });
        } else {
          ctx.telegram.sendMessage(selectedChannel.name, post.content.text, {
            entities: post.content.entities,
          });
        }
      }, delay);
    }

    // Сбрасываем состояние "ввод времени"
    ctx.session.schedulingPost = false;
    return; // Завершаем обработку
  }
  });

  // Обработчик кнопки "Отложить"
  bot.action('schedule_post', (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    // Предлагаем время на 1 минуту позже текущего
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

    // Устанавливаем состояние "ввод времени"
    ctx.session.schedulingPost = true;
  });
};