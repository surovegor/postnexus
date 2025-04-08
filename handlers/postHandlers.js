const { Markup } = require('telegraf');
require('dotenv').config();
const API_TOKEN = process.env.API_TOKEN;

module.exports = function (bot, userSelectedChannels, scheduledPosts) {

  const API_URL = 'https://api.intelligence.io.solutions/api/v1/chat/completions';

  function cleanAIResponse(text) {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  async function improveTextWithAI(text) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "deepseek-ai/DeepSeek-R1",
          messages: [
            {
              role: "system",
              content: "Исправь орфографические, пунктуационные и грамматические ошибки в тексте. Сохрани исходный стиль и структуру текста. Не добавляй комментарии, размышления (<think>) или дополнительные объяснения. Верни только исправленный вариант текста, без каких-либо дополнений. Основные правила: 1. Исправь ошибки, но сохрани авторский стиль 2. Не меняй структуру предложений 3. Не добавляй новые фразы или слова 4. Верни ровно тот же текст, но без ошибок 5. Не используй теги <think> и подобные 6. Не пиши ничего кроме исправленного текста"
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const rawText = data.choices[0]?.message?.content || text;
      return cleanAIResponse(rawText);
    } catch (error) {
      console.error('Ошибка при обращении к API:', error);
      return text;
    }
  }

  async function showPostWithOptions(ctx, postContent) {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);
    
    const keyboard = Markup.inlineKeyboard([
      [{ text: 'Улучшить с помощью нейросети', callback_data: 'improve_post' }],
      [{ text: 'Добавить автоподпись', callback_data: 'add_signature' }],
      [{ text: 'Отложить', callback_data: 'schedule_post' }]
    ]);

    if (postContent.media) {
      await ctx.replyWithPhoto(postContent.media, {
        caption: postContent.text,
        caption_entities: postContent.entities,
        reply_markup: keyboard.reply_markup
      });
    } else {
      await ctx.reply(postContent.text, {
        entities: postContent.entities,
        reply_markup: keyboard.reply_markup
      });
    }
  }

  function startCreatingPost(ctx) {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    ctx.reply(`Пост будет опубликован в канале ${selectedChannel.name}.\n\nТеперь отправьте боту то, что хотите опубликовать.`);
    ctx.session.creatingPost = true;
  }

  bot.command('newpost', (ctx) => startCreatingPost(ctx));
  bot.hears('Создать пост', (ctx) => startCreatingPost(ctx));

  bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);
    
    if (!ctx.session.creatingPost && !ctx.session.schedulingPost && selectedChannel) {
      ctx.session.creatingPost = true;
    }

    if (ctx.session.creatingPost) {
      if (!selectedChannel) {
        ctx.reply('Сначала выберите канал в настройках.');
        ctx.session.creatingPost = false;
        return;
      }

      const postContent = {
        text: ctx.message.text || ctx.message.caption,
        entities: ctx.message.entities || ctx.message.caption_entities,
        media: ctx.message.photo ? ctx.message.photo[0].file_id : null,
      };

      ctx.session.postContent = postContent;
      await showPostWithOptions(ctx, postContent);
      ctx.session.creatingPost = false;
      return;
    }

    if (ctx.session.schedulingPost && ctx.message.text) {
      if (!selectedChannel) {
        ctx.reply('Сначала выберите канал в настройках.');
        ctx.session.schedulingPost = false;
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
        channelName: selectedChannel.name,
        content: ctx.session.postContent,
        time: scheduledTime,
      };

      const key = `${userId}_${selectedChannel.name}`;

      if (!scheduledPosts.has(key)) {
        scheduledPosts.set(key, []);
      }

      scheduledPosts.get(key).push(post);

      ctx.reply(`Пост запланирован на ${scheduledTime.toLocaleString('ru-RU')} в канал ${selectedChannel.name}.`);

      setInterval(async () => {
        const now = new Date();
      
        for (const [key, posts] of scheduledPosts.entries()) {
          const readyPosts = posts.filter(post => post.time <= now);
      
          for (const post of readyPosts) {
            try {
              if (post.content.media) {
                await bot.telegram.sendPhoto(post.channelName, post.content.media, {
                  caption: post.content.text,
                  caption_entities: post.content.entities,
                });
              } else {
                await bot.telegram.sendMessage(post.channelName, post.content.text, {
                  entities: post.content.entities,
                });
              }
              console.log(`✅ Пост опубликован в ${post.channelName} в ${now.toLocaleString('ru-RU')}`);
            } catch (err) {
              console.error(`❌ Ошибка при публикации поста в ${post.channelName}:`, err);
            }
          }
      
          const remainingPosts = posts.filter(post => post.time > now);
          scheduledPosts.set(key, remainingPosts);
        }
      }, 60 * 1000);
      
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
    const suggestedTime = new Date(now.getTime() + 60000);
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

  bot.action('improve_post', async (ctx) => {
    try {
        try {
            await ctx.deleteMessage().catch(err => {
                console.log('Не удалось удалить сообщение:', err.message);
            });
        } catch (deleteError) {
            console.log('Ошибка при удалении:', deleteError.message);
        }

        const loadingMsg = await ctx.reply('🔄 Улучшаю текст...');

        const improvedText = await improveTextWithAI(ctx.session.postContent.text);
        
        if (!improvedText) {
            await ctx.answerCbQuery('Не удалось улучшить текст');
            return ctx.reply('Произошла ошибка при обработке текста');
        }

        ctx.session.postContent.text = improvedText;
        ctx.session.postContent.entities = null;

        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        } catch (e) {
            console.log('Не удалось удалить сообщение загрузки:', e.message);
        }

        await showPostWithOptions(ctx, ctx.session.postContent);
        
        try {
            await ctx.answerCbQuery();
        } catch (cbError) {
            console.log('Callback уже обработан:', cbError.message);
        }

    } catch (error) {
        console.error('Ошибка при улучшении:', error);
        try {
            await ctx.answerCbQuery('⚠️ Ошибка улучшения');
            await ctx.reply('Произошла ошибка. Попробуйте снова.');
        } catch (e) {
            console.log('Ошибка при отправке сообщения об ошибке:', e.message);
        }
    }
  });

  bot.action('add_signature', async (ctx) => {
    try {
        // Удаляем сообщение с кнопками
        try {
            await ctx.deleteMessage();
        } catch (deleteError) {
            console.log('Не удалось удалить сообщение:', deleteError.message);
        }

        const userId = ctx.from.id;
        const selectedChannel = userSelectedChannels.get(userId);
        
        if (!selectedChannel) {
            await ctx.answerCbQuery('Канал не выбран');
            return ctx.reply('Сначала выберите канал в настройках.');
        }

        const originalText = ctx.session.postContent.text;
        const signature = `\n\n${selectedChannel.name}`;
        
        if (!originalText.includes(signature)) {
            ctx.session.postContent.text = originalText + signature;
            ctx.session.postContent.entities = null;
        }

        await showPostWithOptions(ctx, ctx.session.postContent);
        
        await ctx.answerCbQuery('Подпись добавлена');
    } catch (error) {
        console.error('Ошибка при добавлении подписи:', error);
        try {
            await ctx.answerCbQuery('⚠️ Ошибка добавления подписи');
            await ctx.reply('Произошла ошибка при добавлении подписи. Попробуйте снова.');
        } catch (e) {
            console.log('Ошибка при отправке сообщения об ошибке:', e.message);
        }
    }
  });
};