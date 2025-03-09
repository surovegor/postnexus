require('dotenv').config();  

const { Telegraf, Markup } = require('telegraf'); 
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token); 

const userTimezones = new Map(); // Хранение часового пояса для каждого пользователя

const welcomeMessage = 
`*PostNexus* — это простой и удобный бот для отложенного постинга, поддерживающий работу с любыми форматами контента.

*Бот позволяет:*

✔️Планировать выход публикаций в ваших каналах

✔️Автоматически удалять их по расписанию

✔️Создавать и настраивать посты любого формата

✔️И многое другое`;

const menuKeyboard = { 
  reply_markup: {
    keyboard: [
      ['Создать пост', 'Контент-план'],
      ['Настройки']
    ],
    resize_keyboard: true, // Изменение размера клавиатруы для кнопок
    one_time_keyboard: false // Сокрытие клавиатуры после нажатия
  }
};

bot.start((ctx) => { // Обработчик для кнопки СТАРТ (/start)
  ctx.reply(welcomeMessage, { parse_mode: 'Markdown', ...menuKeyboard }); 
});

bot.hears('Добавить пост', (ctx) => { // Обработчик для кнопки "Добавить пост"
  ctx.reply('Вы выбрали "Добавить пост".');
});

bot.hears('Контент-план', (ctx) => { // Обработчик для кнопки "Контент-план"
  ctx.reply('Вы выбрали "Контент-план".');
});

function getSettingsKeyboard(userId) { // Функция для создания клавиатуры настроек
  const userTimezone = userTimezones.get(userId) || timezones[0]; // По умолчанию UTC+0
  const currentTime = getCurrentTime(userTimezone.offset);

  return Markup.inlineKeyboard([
    [Markup.button.callback(`Часовой пояс: ${userTimezone.city} (${currentTime})`, 'timezone')],
    [Markup.button.callback('Добавить канал', 'back_to_main')],
  ]);
}

bot.hears('Настройки', (ctx) => {
  const userId = ctx.from.id;
  ctx.reply('Выберите настройку:', getSettingsKeyboard(userId));
});

const timezones = Array.from({ length: 24 }, (_, index) => ({ // Список часовых поясов (UTC+0 до UTC+23)
  offset: index, // Смещение от UTC (0 до 23)
  city: `UTC+${index}:00`, // Название пояса (UTC+X:00)
}));

function getCurrentTime(offset) { // Функция для получения текущего времени в указанном часовом поясе
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000; // Переводим в UTC
  const localTime = new Date(utc + 3600000 * offset); // Применяем смещение
  return localTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function getTimezoneKeyboard() { // Inline-клавиатура для выбора часового пояса
  return Markup.inlineKeyboard(
    timezones.map(({ city, offset }) => [
      Markup.button.callback(`${city} (${getCurrentTime(offset)})`, `set_timezone_${offset}`),
    ]),
  );
}

bot.action('timezone', (ctx) => { // Обработчик кнопки "Часовой пояс"
  ctx.editMessageText('Выберите часовой пояс. Время выхода постов будет отображаться в вашем часовом поясе.', {
    reply_markup: getTimezoneKeyboard().reply_markup,
  });
});

bot.action(/set_timezone_(\d+)/, (ctx) => { // Обработчик выбора часового пояса
  const userId = ctx.from.id;
  const offset = parseInt(ctx.match[1]); // Извлекаем смещение из callback_data
  const selectedTimezone = timezones.find((tz) => tz.offset === offset);

  if (selectedTimezone) {
    userTimezones.set(userId, selectedTimezone); // Сохраняем выбранный пояс

    ctx.editMessageText('Выберите настройку:', { // Обновляем первоначальное сообщение с меню настроек
      reply_markup: getSettingsKeyboard(userId).reply_markup,
    });

    ctx.answerCbQuery(`✅Часовой пояс изменен на ${selectedTimezone.city}`);
  }
});

bot.action('back_to_main', (ctx) => {
  ctx.reply('Возвращаемся в главное меню:', menuKeyboard);
});

bot.on('message', (ctx) => {
  if (ctx.message.text) {  
    ctx.reply(ctx.message.text, {
      entities: ctx.message.entities, 
    });
  }
  
  console.log(ctx.message); 
});

bot.launch(); 