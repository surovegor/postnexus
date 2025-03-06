require('dotenv').config();  

const { Telegraf } = require('telegraf'); 
const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_TOKEN не задан в .env!');
  process.exit(1);
}

const bot = new Telegraf(token); 

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
      ['Добавить канал'],
      ['Мои каналы'] 
    ],
    resize_keyboard: true, // Изменение размера клавиатруы для кнопок
    one_time_keyboard: false // Сокрытие клавиатуры после нажатия
  }
};

bot.start((ctx) => { // Обработчик для кнопки СТАРТ (/start)
  ctx.reply(welcomeMessage, { parse_mode: 'Markdown', ...menuKeyboard }); 
});

bot.hears('Добавить канал', (ctx) => { // Обработчик для кнопки "Добавить канал"
  ctx.reply('Вы выбрали "Добавить канал". Введите название канала:');
});

bot.hears('Мои каналы', (ctx) => { // Обработчик для кнопки "Мои каналы"
  ctx.reply('Вы выбрали "Мои каналы". Вот список ваших каналов:');
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