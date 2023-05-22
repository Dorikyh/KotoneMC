const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;
const { Viewer } = require('prismarine-viewer');

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Is Ready');
});

app.listen(3000, () => {
  console.log('server started');
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.settings.colorsEnabled = false;

  bot.once('spawn', () => {
    console.log('\x1b[33m[BotLog] Bot joined to the server', '\x1b[0m');

    if (config.utils['auto-auth'].enabled) {
      console.log('[INFO] Started auto-auth module');

      var password = config.utils['auto-auth'].password;
      setTimeout(() => {
        bot.chat(`/register ${password} ${password}`);
        bot.chat(`/login ${password}`);
      }, 500);

      console.log(`[Auth] Authentification commands executed.`);
    }

    if (config.utils['chat-messages'].enabled) {
      console.log('[INFO] Started chat-messages module');
      var messages = config.utils['chat-messages']['messages'];

      if (config.utils['chat-messages'].repeat) {
        var delay = config.utils['chat-messages']['repeat-delay'];
        let i = 0;

        let msg_timer = setInterval(() => {
          bot.chat(`${messages[i]}`);

          if (i + 1 == messages.length) {
            i = 0;
          } else i++;
        }, delay * 1000);
      } else {
        messages.forEach((msg) => {
          bot.chat(msg);
        });
      }
    }

    const pos = config.position;

    if (config.position.enabled) {
      console.log(
        `\x1b[32m[BotLog] Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`
      );
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
    }
  });

  bot.on('chat', (username, message) => {
    if (config.utils['chat-log']) {
      console.log(`[ChatLog] ${username}: ${message}`);
    }
  });


  let currentGoal = null;
  
  bot.on('chat', (username, message) => {
    if (message === '$stop') {
      if (currentGoal) {
        bot.pathfinder.setGoal(null);
        bot.chat('Movimiento detenido.');
        currentGoal = null;
      } else {
        bot.chat('No hay movimiento en progreso.');
      }
    }
  });
  
  bot.on('goal_updated', (goal) => {
    currentGoal = goal;
  });
  
  bot.on('goal_reached', () => {
    currentGoal = null;
  });
    
  bot.on('chat', (username, message) => {
    if (username !== bot.username) {
      if (message.startsWith('$goto')) {
        const args = message.split(' ');
        if (args.length === 3) {
          const x = parseInt(args[1]);
          const z = parseInt(args[2]);
    
          if (!isNaN(x) && !isNaN(z)) {
            bot.pathfinder.setGoal(new GoalXZ(x, z));
            bot.chat(`Moving to X: ${x}, Z: ${z}`);
          } else {
            bot.chat('Coords not valid.');
          }
        } else {
          bot.chat('Command using: $goto <x> <z>');
        }
      }
    }
  });

  
  bot.on('goal_reached', () => {
    console.log(
      `\x1b[32m[BotLog] Bot arrived to target location. ${bot.entity.position}\x1b[0m`
    );
  });

  bot.on('death', () => {
    console.log(
      `\x1b[33m[BotLog] Bot has died and was respawned ${bot.entity.position}`,
      '\x1b[0m'
    );
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => {
      setTimeout(() => {
        createBot();
      }, config.utils['auto-recconect-delay']);

    });
  }

  bot.on('chat', (username, message) => {
    if (username !== bot.username) {
      if (message === '$coords') {
        const { x, z } = bot.entity.position;
        bot.chat(`Coords: X: ${Math.floor(x)}, Z: ${Math.floor(z)}`);
      }
    }
  });

  bot.on('chat', (username, message) => {
    if (message.startsWith('$say')) {
      const chatMessage = message.slice(5);

      if (username !== bot.username) {
        bot.chat(chatMessage);
      }
    }
  });

  bot.on('chat', (username, message) => {
    if (message.startsWith('$help')) {

      if (username !== bot.username) {
        bot.chat('$say <msg>, $move <x> <y>, $stop');
      }
    }
  });
  
  bot.once('spawn', () => {
    // Busca al jugador más cercano cada segundo
    setInterval(() => {
      closestPlayer = findClosestPlayer(bot);
  
      if (closestPlayer) {
        // Hace que el bot mire hacia el jugador más cercano
        bot.lookAt(closestPlayer.position.offset(0, closestPlayer.height, 0));
      }
    }, 1000);
  });
  
  function findClosestPlayer(bot) {
    const players = bot.players;
  
    let closestPlayer = null;
    let closestDistance = Infinity;
  
    for (const player of Object.values(players)) {
      if (player.entity && player.entity.position) {  // Agrega esta verificación adicional
        const distance = bot.entity.position.distanceTo(player.entity.position);
  
        if (distance < closestDistance) {
          closestPlayer = player.entity;
          closestDistance = distance;
        }
      }
    }
  
    return closestPlayer;
  }
  
    
  bot.on('kicked', (reason) =>
    console.log(
      '\x1b[33m',
      `[BotLog] Bot was kicked from the server. Reason: \n${reason}`,
      '\x1b[0m'
    )
  );
  bot.on('error', (err) =>
    console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m')
  );
}

createBot();