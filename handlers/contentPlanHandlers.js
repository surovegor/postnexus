const { Markup } = require('telegraf');
const moment = require('moment');
moment.locale('ru');

module.exports = function (bot, userSelectedChannels, scheduledPosts) {
  function generateCalendar(year, month, userId, channelId) {
    const startOfMonth = moment(`${year}-${month}`, 'YYYY-MM').startOf('month');
    const endOfMonth = moment(startOfMonth).endOf('month');
    const daysInMonth = endOfMonth.date();
    const firstDayOfWeek = startOfMonth.day();

    const key = `${userId}_${channelId}`; // Ключ для получения постов
    const userPosts = scheduledPosts.get(key) || [];
    const postsByDate = userPosts.reduce((acc, post) => {
      const postDate = moment(post.time).format('YYYY-MM-DD');
      if (!acc[postDate]) acc[postDate] = [];
      acc[postDate].push(post);
      return acc;
    }, {});

    const calendar = [];
    let week = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      week.push(Markup.button.callback(' ', 'ignore'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = moment(`${year}-${month}-${day}`, 'YYYY-MM-DD').format('YYYY-MM-DD');
      const hasPosts = postsByDate[date] ? '📌' : '';
      week.push(Markup.button.callback(`${day}${hasPosts}`, `day_${date}`));

      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(Markup.button.callback(' ', 'ignore'));
      }
      calendar.push(week);
    }

    return calendar;
  }

  function sendCalendar(ctx, year, month) {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const calendar = generateCalendar(year, month, userId, selectedChannel.id);

    const prevMonth = moment(`${year}-${month}`, 'YYYY-MM').subtract(1, 'month');
    const nextMonth = moment(`${year}-${month}`, 'YYYY-MM').add(1, 'month');

    const navigationButtons = [
      Markup.button.callback('⬅️', `month_${prevMonth.year()}-${prevMonth.month() + 1}`),
      Markup.button.callback(moment(`${year}-${month}`, 'YYYY-MM').format('MMMM YYYY'), 'ignore'),
      Markup.button.callback('➡️', `month_${nextMonth.year()}-${nextMonth.month() + 1}`),
    ];

    const keyboard = Markup.inlineKeyboard([navigationButtons, ...calendar]);

    if (ctx.updateType === 'callback_query') {
      return ctx.editMessageText('Выберите день:', keyboard);
    }

    return ctx.reply('Выберите день:', keyboard);
  }

  bot.command('schedule', (ctx) => {
    const now = moment();
    sendCalendar(ctx, now.year(), now.month() + 1);
  });

  bot.hears('Контент-план', (ctx) => {
    const now = moment();
    sendCalendar(ctx, now.year(), now.month() + 1);
  });

  bot.action(/month_(\d+)-(\d+)/, (ctx) => {
    const year = parseInt(ctx.match[1]);
    const month = parseInt(ctx.match[2]);
    sendCalendar(ctx, year, month);
    ctx.answerCbQuery();
  });

  bot.action(/day_(\d{4}-\d{2}-\d{2})/, (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const date = ctx.match[1];
    const key = `${userId}_${selectedChannel.id}`;
    const userPosts = scheduledPosts.get(key) || [];
    const postsForDay = userPosts.filter(post => moment(post.time).format('YYYY-MM-DD') === date);

    if (postsForDay.length === 0) {
      ctx.reply('На этот день нет запланированных постов.');
      ctx.answerCbQuery();
      return;
    }

    const postButtons = postsForDay.map((post, index) => [
      Markup.button.callback(`Пост #${index + 1} (${moment(post.time).format('HH:mm')})`, `post_${date}_${index}`),
    ]);

    ctx.reply(
      `Посты, запланированные на ${moment(date).format('DD.MM.YYYY')}:`,
      Markup.inlineKeyboard(postButtons)
    );
    ctx.answerCbQuery();
  });

  bot.action(/^post_(\d{4}-\d{2}-\d{2})_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const date = ctx.match[1];
    const postIndex = parseInt(ctx.match[2]);
    const key = `${userId}_${selectedChannel.id}`;
    const userPosts = scheduledPosts.get(key) || [];
    const postsForDay = userPosts.filter(post => moment(post.time).format('YYYY-MM-DD') === date);
    const post = postsForDay[postIndex];

    if (!post) {
      ctx.reply('Пост не найден.');
      ctx.answerCbQuery();
      return;
    }

    const actionButtons = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Удалить', `delete_post_${date}_${postIndex}`)],
    ]);

    if (post.content.media) {
      ctx.replyWithPhoto(post.content.media, {
        caption: post.content.text,
        caption_entities: post.content.entities,
        reply_markup: actionButtons.reply_markup,
      });
    } else {
      ctx.reply(post.content.text, {
        entities: post.content.entities,
        reply_markup: actionButtons.reply_markup,
      });
    }
    ctx.answerCbQuery();
  });

  bot.action(/^delete_post_(\d{4}-\d{2}-\d{2})_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const selectedChannel = userSelectedChannels.get(userId);

    if (!selectedChannel) {
      ctx.reply('Сначала выберите канал в настройках.');
      return;
    }

    const date = ctx.match[1];
    const postIndex = parseInt(ctx.match[2]);
    const key = `${userId}_${selectedChannel.id}`;
    const userPosts = scheduledPosts.get(key) || [];
    const postsForDay = userPosts.filter(post => moment(post.time).format('YYYY-MM-DD') === date);

    if (postIndex >= postsForDay.length) {
      await ctx.reply('Пост не найден.');
      await ctx.answerCbQuery();
      return;
    }

    const postToDelete = postsForDay[postIndex];
    const updatedPosts = userPosts.filter(post => post !== postToDelete);
    scheduledPosts.set(key, updatedPosts);

    await ctx.reply('Пост успешно удален.');
    await ctx.answerCbQuery();

    const updatedPostsForDay = postsForDay.filter((post, index) => index !== postIndex);

    if (updatedPostsForDay.length === 0) {
      await ctx.reply('На этот день больше нет запланированных постов.');
      return;
    }

    const postButtons = updatedPostsForDay.map((post, index) => [
      Markup.button.callback(`Пост #${index + 1} (${moment(post.time).format('HH:mm')})`, `post_${date}_${index}`),
    ]);

    await ctx.reply(
      `Посты, запланированные на ${moment(date).format('DD.MM.YYYY')}:`,
      Markup.inlineKeyboard(postButtons)
    );
  });
};