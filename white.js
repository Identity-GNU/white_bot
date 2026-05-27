'use strict';

const mineflayer = require('mineflayer');

const BOT_NAMES = ['name', 'name', 'name', 'name', 'name', 'name'];

const BOT_OPTIONS = {
  host: 'mc.whiterise.su',
  port: 25565,
  version: false,
  auth: 'offline',
};

const WARP_COMMAND = '/warp pool';
const WARP_WAIT_MS = 5000;
const MOVE_BLOCKS = 3;
const MOVE_TIMEOUT_MS = 7000;
const MENU_SLOT = 20;

function ts() {
  return new Date().toISOString().slice(11, 19);
}

function log(name, line) {
  console.log(`[${ts()}] [${name}] ${line}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distance2d(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function findNetherStar(bot) {
  for (let slot = 36; slot <= 44; slot++) {
    const item = bot.inventory.slots[slot];
    if (item && item.name === 'nether_star') return slot - 36;
  }

  return -1;
}

async function waitForWindow(bot, ms) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`menu did not open in ${ms}ms`)), ms);

    bot.once('windowOpen', (window) => {
      clearTimeout(timeout);
      resolve(window);
    });
  });
}

async function openWarpMenu(bot, username) {
  let hotbarPos = findNetherStar(bot);

  if (hotbarPos === -1) {
    log(username, 'nether star not found, retrying in 5s');
    await sleep(5000);
    hotbarPos = findNetherStar(bot);
  }

  if (hotbarPos === -1) {
    log(username, `nether star not found, sending ${WARP_COMMAND}`);
    bot.chat(WARP_COMMAND);
    return;
  }

  await bot.setQuickBarSlot(hotbarPos);
  await sleep(300);

  bot.activateItem(false);
  log(username, `activated nether star in hotbar slot ${hotbarPos}`);

  try {
    const window = await waitForWindow(bot, 5000);
    log(username, `menu opened: "${window.title}", slots: ${window.slots.length}`);

    await sleep(300);
    await bot.clickWindow(MENU_SLOT, 0, 0);
    log(username, `clicked menu slot ${MENU_SLOT}`);

    await sleep(300);
    bot.closeWindow(window);
  } catch (err) {
    log(username, `${err.message}, sending ${WARP_COMMAND}`);
    bot.chat(WARP_COMMAND);
  }
}

async function walkForward(bot, blocks) {
  const start = bot.entity.position.clone();
  const deadline = Date.now() + MOVE_TIMEOUT_MS;

  bot.setControlState('forward', true);

  try {
    while (distance2d(bot.entity.position, start) < blocks && Date.now() < deadline) {
      await sleep(100);
    }
  } finally {
    bot.clearControlStates();
  }
}

function createAfkBot(username, index) {
  const bot = mineflayer.createBot({
    ...BOT_OPTIONS,
    username,
  });

  bot.once('spawn', async () => {
    log(username, 'joined server');

    await sleep(1500 + index * 500);
    await openWarpMenu(bot, username);

    await sleep(WARP_WAIT_MS);
    log(username, `walking forward ${MOVE_BLOCKS} blocks`);
    await walkForward(bot, MOVE_BLOCKS);

    log(username, 'stopped, AFK');
  });

  bot.on('error', (err) => log(username, `error: ${err.message}`));
  bot.on('kicked', (reason) => log(username, `kicked: ${reason}`));
  bot.on('end', () => log(username, 'disconnected'));

  return bot;
}

BOT_NAMES.forEach((username, index) => {
  setTimeout(() => createAfkBot(username, index), index * 1500);
});
