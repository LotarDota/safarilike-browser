// ==UserScript==
// @name         Botva AutoClicker
// @namespace    https://github.com/LotarDota/safarilike-browser
// @version      1.0.0
// @description  Автокликер для браузерной игры Botva.ru — автоатака, автолечение, автоферма, автодозор, автошахта
// @author       LotarDota
// @match        *://botva.ru/*
// @match        *://*.botva.ru/*
// @match        *://g1.botva.ru/*
// @match        *://g2.botva.ru/*
// @match        *://g3.botva.ru/*
// @match        *://g4.botva.ru/*
// @match        *://g5.botva.ru/*
// @icon         https://botva.ru/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // =========================================================================
  //  CONSTANTS
  // =========================================================================
  const VERSION = '1.0.0';
  const STORAGE_KEY = 'botva_ac_settings';
  const LOG_MAX = 200;

  const DEFAULT_SETTINGS = {
    // Auto-attack
    attackEnabled: false,
    attackMinLevel: 1,
    attackMaxLevel: 99,
    attackInterval: 15000,    // ms between attack cycles
    attackSearchDelay: 3000,  // ms delay after searching

    // Auto-heal
    healEnabled: false,
    healThreshold: 30,        // heal when HP drops below this %
    healInterval: 10000,

    // Auto-farm
    farmEnabled: false,
    farmInterval: 60000,

    // Auto-patrol (dozor)
    patrolEnabled: false,
    patrolInterval: 60000,

    // Auto-mine
    mineEnabled: false,
    mineInterval: 60000,

    // General
    globalDelay: 2000,        // base delay between any actions
    randomDelay: 3000,        // random additional delay (anti-detection)
    soundNotify: true,
    panelCollapsed: false,
    panelX: 10,
    panelY: 10,
  };

  // =========================================================================
  //  STATE
  // =========================================================================
  let settings = loadSettings();
  let logs = [];
  let stats = {
    attacks: 0,
    wins: 0,
    losses: 0,
    heals: 0,
    farmRuns: 0,
    patrolRuns: 0,
    mineRuns: 0,
    sessionStart: Date.now(),
  };
  let timers = {};
  let isRunning = false;

  // =========================================================================
  //  UTILITIES
  // =========================================================================
  function loadSettings() {
    try {
      const raw = typeof GM_getValue === 'function'
        ? GM_getValue(STORAGE_KEY, null)
        : localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Object.assign({}, DEFAULT_SETTINGS, parsed);
      }
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function saveSettings() {
    try {
      const json = JSON.stringify(settings);
      if (typeof GM_setValue === 'function') {
        GM_setValue(STORAGE_KEY, json);
      } else {
        localStorage.setItem(STORAGE_KEY, json);
      }
    } catch (e) { /* ignore */ }
  }

  function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms + rnd(0, settings.randomDelay)));
  }

  function log(msg, type) {
    type = type || 'info';
    const time = new Date().toLocaleTimeString('ru-RU');
    logs.unshift({ time, msg, type });
    if (logs.length > LOG_MAX) logs.pop();
    updateLogUI();
  }

  function formatDuration(ms) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    return (h > 0 ? h + 'ч ' : '') + m + 'м ' + s + 'с';
  }

  // =========================================================================
  //  DOM HELPERS
  // =========================================================================
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function clickButton(text) {
    const buttons = $$('input[type="submit"], input[type="button"], button');
    for (const btn of buttons) {
      const val = (btn.value || btn.textContent || '').trim().toUpperCase();
      if (val.includes(text.toUpperCase())) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function clickLink(text) {
    const links = $$('a');
    for (const a of links) {
      if ((a.textContent || '').trim().toLowerCase().includes(text.toLowerCase())) {
        a.click();
        return true;
      }
    }
    return false;
  }

  function getHPPercent() {
    // Try multiple selectors to find HP bar
    const hpBar = $('[class*="hp"]') || $('[id*="hp"]') || $('.health-bar') || $('#health');
    if (hpBar) {
      const widthMatch = (hpBar.style.width || '').match(/(\d+)/);
      if (widthMatch) return parseInt(widthMatch[1], 10);
      const text = hpBar.textContent || '';
      const fracMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (fracMatch) return Math.round((parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10)) * 100);
    }
    // Fallback: search all text nodes
    const body = document.body.innerText || '';
    const hpMatch = body.match(/HP[:\s]*(\d+)\s*\/\s*(\d+)/i) ||
                    body.match(/Здоровье[:\s]*(\d+)\s*\/\s*(\d+)/i) ||
                    body.match(/Жизни[:\s]*(\d+)\s*\/\s*(\d+)/i);
    if (hpMatch) return Math.round((parseInt(hpMatch[1], 10) / parseInt(hpMatch[2], 10)) * 100);
    return 100; // assume full if can't detect
  }

  function isOnPage(keyword) {
    return document.body.innerText.toLowerCase().includes(keyword.toLowerCase());
  }

  function navigateTo(url) {
    window.location.href = url;
  }

  function getCurrentPageURL() {
    return window.location.href;
  }

  // =========================================================================
  //  AUTO-ATTACK MODULE
  // =========================================================================
  async function attackCycle() {
    if (!settings.attackEnabled || !isRunning) return;
    try {
      log('Начинаю цикл атаки...', 'attack');

      // Navigate to fight page if not there
      if (!isOnPage('ИСКАТЬ ПРОТИВНИКА') && !isOnPage('НАПАСТЬ')) {
        log('Перехожу в Бодалку...', 'attack');
        if (!clickLink('Бодалка') && !clickLink('бодалка')) {
          // Try direct navigation
          const base = window.location.origin;
          navigateTo(base + '/fight.php');
          return;
        }
        await delay(settings.globalDelay);
      }

      // Set level range in search form
      const forms = $$('form');
      for (const form of forms) {
        const minInput = form.querySelector('[name="min"], [name="level_min"], [name="minlevel"]');
        const maxInput = form.querySelector('[name="max"], [name="level_max"], [name="maxlevel"]');
        if (minInput) {
          minInput.value = settings.attackMinLevel;
          minInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (maxInput) {
          maxInput.value = settings.attackMaxLevel;
          maxInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Search for opponent
      if (isOnPage('ИСКАТЬ ПРОТИВНИКА') || isOnPage('Искать противника')) {
        log('Ищу противника (ур. ' + settings.attackMinLevel + '-' + settings.attackMaxLevel + ')...', 'attack');
        clickButton('ИСКАТЬ ПРОТИВНИКА') || clickButton('Искать противника') || clickButton('Искать');
        await delay(settings.attackSearchDelay);
      }

      // Attack
      if (isOnPage('НАПАСТЬ') || isOnPage('Напасть')) {
        log('Нападаю!', 'attack');
        clickButton('НАПАСТЬ') || clickButton('Напасть');
        stats.attacks++;
        await delay(settings.globalDelay);

        // Check result
        if (isOnPage('Вы победили') || isOnPage('победа')) {
          stats.wins++;
          log('Победа!', 'success');
        } else if (isOnPage('Вы проиграли') || isOnPage('поражение')) {
          stats.losses++;
          log('Поражение', 'warning');
        }
      } else {
        log('Противник не найден, жду...', 'warning');
      }

      updateStatsUI();
    } catch (e) {
      log('Ошибка атаки: ' + e.message, 'error');
    }
  }

  // =========================================================================
  //  AUTO-HEAL MODULE
  // =========================================================================
  async function healCycle() {
    if (!settings.healEnabled || !isRunning) return;
    try {
      const hp = getHPPercent();
      if (hp < settings.healThreshold) {
        log('HP низкий (' + hp + '%), лечусь...', 'heal');

        // Try clicking heal/potion buttons
        const healed =
          clickButton('Лечиться') ||
          clickButton('Выпить') ||
          clickButton('Использовать зелье') ||
          clickButton('Восстановить') ||
          clickButton('лечение');

        if (healed) {
          stats.heals++;
          log('Зелье использовано', 'success');
        } else {
          // Try navigating to heal page
          clickLink('Жилище') || clickLink('жилище');
          await delay(settings.globalDelay);
          var healed2 = clickButton('Лечиться') || clickButton('Выпить');
          if (healed2) stats.heals++;
        }
        updateStatsUI();
      }
    } catch (e) {
      log('Ошибка лечения: ' + e.message, 'error');
    }
  }

  // =========================================================================
  //  AUTO-FARM MODULE
  // =========================================================================
  async function farmCycle() {
    if (!settings.farmEnabled || !isRunning) return;
    try {
      log('Начинаю работу на ферме...', 'farm');

      if (!isOnPage('Ферма') && !isOnPage('ферма') && !isOnPage('Собрать')) {
        clickLink('Ферма') || clickLink('ферма');
        await delay(settings.globalDelay);
      }

      // Collect resources
      const collected =
        clickButton('Собрать') ||
        clickButton('Собрать урожай') ||
        clickButton('Работать') ||
        clickButton('Начать работу');

      if (collected) {
        stats.farmRuns++;
        log('Ферма: ресурсы собраны', 'success');
      } else {
        log('Ферма: нечего собирать', 'info');
      }
      updateStatsUI();
    } catch (e) {
      log('Ошибка фермы: ' + e.message, 'error');
    }
  }

  // =========================================================================
  //  AUTO-PATROL MODULE
  // =========================================================================
  async function patrolCycle() {
    if (!settings.patrolEnabled || !isRunning) return;
    try {
      log('Иду в дозор...', 'patrol');

      if (!isOnPage('Дозор') && !isOnPage('дозор')) {
        clickLink('Дозор') || clickLink('дозор') || clickLink('Бодалка');
        await delay(settings.globalDelay);
      }

      const started =
        clickButton('В дозор') ||
        clickButton('Идти в дозор') ||
        clickButton('Начать дозор') ||
        clickButton('Дозор');

      if (started) {
        stats.patrolRuns++;
        log('Дозор начат', 'success');
      } else {
        log('Дозор недоступен', 'info');
      }
      updateStatsUI();
    } catch (e) {
      log('Ошибка дозора: ' + e.message, 'error');
    }
  }

  // =========================================================================
  //  AUTO-MINE MODULE
  // =========================================================================
  async function mineCycle() {
    if (!settings.mineEnabled || !isRunning) return;
    try {
      log('Иду в шахту...', 'mine');

      if (!isOnPage('Шахта') && !isOnPage('шахта') && !isOnPage('Добыть')) {
        clickLink('Шахта') || clickLink('шахта');
        await delay(settings.globalDelay);
      }

      const mined =
        clickButton('Добыть') ||
        clickButton('Копать') ||
        clickButton('Начать добычу') ||
        clickButton('Добыть кристаллы');

      if (mined) {
        stats.mineRuns++;
        log('Шахта: добыча начата', 'success');
      } else {
        log('Шахта: добыча недоступна', 'info');
      }
      updateStatsUI();
    } catch (e) {
      log('Ошибка шахты: ' + e.message, 'error');
    }
  }

  // =========================================================================
  //  ENGINE — START / STOP
  // =========================================================================
  function startBot() {
    if (isRunning) return;
    isRunning = true;
    stats.sessionStart = Date.now();
    log('Бот запущен', 'success');

    scheduleAll();
    updateControlUI();
  }

  function stopBot() {
    isRunning = false;
    Object.values(timers).forEach(clearTimeout);
    timers = {};
    log('Бот остановлен', 'warning');
    updateControlUI();
  }

  function scheduleAll() {
    if (!isRunning) return;
    scheduleModule('attack', attackCycle, settings.attackInterval, settings.attackEnabled);
    scheduleModule('heal', healCycle, settings.healInterval, settings.healEnabled);
    scheduleModule('farm', farmCycle, settings.farmInterval, settings.farmEnabled);
    scheduleModule('patrol', patrolCycle, settings.patrolInterval, settings.patrolEnabled);
    scheduleModule('mine', mineCycle, settings.mineInterval, settings.mineEnabled);
  }

  function scheduleModule(name, fn, interval, enabled) {
    if (timers[name]) clearTimeout(timers[name]);
    if (!enabled || !isRunning) return;
    timers[name] = setTimeout(async () => {
      await fn();
      scheduleModule(name, fn, settings[name + 'Interval'], settings[name + 'Enabled']);
    }, interval + rnd(0, settings.randomDelay));
  }

  // =========================================================================
  //  UI — STYLES
  // =========================================================================
  const CSS = `
    #botva-ac-panel {
      position: fixed;
      z-index: 999999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      color: #e0e0e0;
      width: 340px;
      background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border: 1px solid #0f3460;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 15px rgba(15,52,96,0.3);
      user-select: none;
      overflow: hidden;
      transition: height 0.3s ease;
    }
    #botva-ac-panel.collapsed {
      height: 42px !important;
    }
    #botva-ac-header {
      background: linear-gradient(90deg, #0f3460, #533483);
      padding: 10px 14px;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #botva-ac-header span {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.5px;
    }
    #botva-ac-header .version {
      font-size: 10px;
      opacity: 0.6;
      margin-left: 6px;
    }
    .ac-header-btns {
      display: flex;
      gap: 6px;
    }
    .ac-header-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: #e0e0e0;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .ac-header-btn:hover {
      background: rgba(255,255,255,0.25);
    }
    #botva-ac-body {
      padding: 10px;
      max-height: 520px;
      overflow-y: auto;
    }
    #botva-ac-body::-webkit-scrollbar {
      width: 5px;
    }
    #botva-ac-body::-webkit-scrollbar-track {
      background: transparent;
    }
    #botva-ac-body::-webkit-scrollbar-thumb {
      background: #533483;
      border-radius: 4px;
    }
    .ac-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
    }
    .ac-tab {
      flex: 1;
      padding: 6px 4px;
      border: none;
      background: rgba(255,255,255,0.05);
      color: #aaa;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .ac-tab:hover {
      background: rgba(255,255,255,0.1);
      color: #ddd;
    }
    .ac-tab.active {
      background: linear-gradient(135deg, #533483, #0f3460);
      color: #fff;
    }
    .ac-tab-content {
      display: none;
    }
    .ac-tab-content.active {
      display: block;
    }
    .ac-section {
      background: rgba(255,255,255,0.04);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .ac-section-title {
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ac-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .ac-row label {
      font-size: 12px;
      color: #bbb;
    }
    .ac-toggle {
      position: relative;
      width: 40px;
      height: 22px;
    }
    .ac-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .ac-toggle-slider {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #333;
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .ac-toggle-slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.3s;
    }
    .ac-toggle input:checked + .ac-toggle-slider {
      background: #28a745;
    }
    .ac-toggle input:checked + .ac-toggle-slider::before {
      transform: translateX(18px);
    }
    .ac-input {
      width: 60px;
      padding: 4px 6px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      color: #e0e0e0;
      font-size: 12px;
      text-align: center;
    }
    .ac-input:focus {
      outline: none;
      border-color: #533483;
    }
    .ac-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: all 0.2s;
    }
    .ac-btn-start {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: #fff;
      width: 100%;
    }
    .ac-btn-start:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }
    .ac-btn-stop {
      background: linear-gradient(135deg, #dc3545, #e74c3c);
      color: #fff;
      width: 100%;
    }
    .ac-btn-stop:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }
    .ac-status {
      text-align: center;
      padding: 6px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 12px;
    }
    .ac-status.running {
      background: rgba(40,167,69,0.15);
      color: #28a745;
      border: 1px solid rgba(40,167,69,0.3);
    }
    .ac-status.stopped {
      background: rgba(220,53,69,0.15);
      color: #dc3545;
      border: 1px solid rgba(220,53,69,0.3);
    }
    .ac-log {
      max-height: 150px;
      overflow-y: auto;
      font-size: 11px;
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      padding: 6px;
    }
    .ac-log::-webkit-scrollbar {
      width: 4px;
    }
    .ac-log::-webkit-scrollbar-thumb {
      background: #444;
      border-radius: 2px;
    }
    .ac-log-entry {
      padding: 2px 0;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      word-break: break-word;
    }
    .ac-log-entry .time {
      color: #666;
      margin-right: 4px;
    }
    .ac-log-entry.info { color: #8899aa; }
    .ac-log-entry.success { color: #28a745; }
    .ac-log-entry.warning { color: #ffc107; }
    .ac-log-entry.error { color: #dc3545; }
    .ac-log-entry.attack { color: #e74c3c; }
    .ac-log-entry.heal { color: #17a2b8; }
    .ac-log-entry.farm { color: #28a745; }
    .ac-log-entry.patrol { color: #fd7e14; }
    .ac-log-entry.mine { color: #6f42c1; }
    .ac-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .ac-stat-card {
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    .ac-stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }
    .ac-stat-label {
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ac-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .ac-indicator.on {
      background: #28a745;
      box-shadow: 0 0 6px #28a745;
    }
    .ac-indicator.off {
      background: #555;
    }
  `;

  // =========================================================================
  //  UI — HTML
  // =========================================================================
  function buildUI() {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(CSS);
    } else {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const panel = document.createElement('div');
    panel.id = 'botva-ac-panel';
    panel.style.left = settings.panelX + 'px';
    panel.style.top = settings.panelY + 'px';
    if (settings.panelCollapsed) panel.classList.add('collapsed');

    panel.innerHTML = `
      <div id="botva-ac-header">
        <span>Botva AC <span class="version">v${VERSION}</span></span>
        <div class="ac-header-btns">
          <button class="ac-header-btn" id="ac-btn-collapse" title="Свернуть/Развернуть">_</button>
          <button class="ac-header-btn" id="ac-btn-close" title="Скрыть (Ctrl+Shift+B)">x</button>
        </div>
      </div>
      <div id="botva-ac-body">
        <div id="ac-status" class="ac-status stopped">ОСТАНОВЛЕН</div>

        <div class="ac-tabs">
          <button class="ac-tab active" data-tab="modules">Модули</button>
          <button class="ac-tab" data-tab="settings">Настройки</button>
          <button class="ac-tab" data-tab="stats">Стат</button>
          <button class="ac-tab" data-tab="log">Лог</button>
        </div>

        <!-- MODULES TAB -->
        <div class="ac-tab-content active" data-tab="modules">
          <div class="ac-section">
            <div class="ac-section-title">
              <span class="ac-indicator off" id="ac-ind-attack"></span>
              Авто-Атака
            </div>
            <div class="ac-row">
              <label>Включить</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-attack-enabled" ${settings.attackEnabled ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
            <div class="ac-row">
              <label>Ур. от</label>
              <input type="number" class="ac-input" id="ac-attack-min" value="${settings.attackMinLevel}" min="1" max="999">
            </div>
            <div class="ac-row">
              <label>Ур. до</label>
              <input type="number" class="ac-input" id="ac-attack-max" value="${settings.attackMaxLevel}" min="1" max="999">
            </div>
            <div class="ac-row">
              <label>Интервал (сек)</label>
              <input type="number" class="ac-input" id="ac-attack-interval" value="${settings.attackInterval / 1000}" min="5" max="600">
            </div>
          </div>

          <div class="ac-section">
            <div class="ac-section-title">
              <span class="ac-indicator off" id="ac-ind-heal"></span>
              Авто-Лечение
            </div>
            <div class="ac-row">
              <label>Включить</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-heal-enabled" ${settings.healEnabled ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
            <div class="ac-row">
              <label>Лечить при HP ниже %</label>
              <input type="number" class="ac-input" id="ac-heal-threshold" value="${settings.healThreshold}" min="1" max="99">
            </div>
            <div class="ac-row">
              <label>Интервал (сек)</label>
              <input type="number" class="ac-input" id="ac-heal-interval" value="${settings.healInterval / 1000}" min="5" max="600">
            </div>
          </div>

          <div class="ac-section">
            <div class="ac-section-title">
              <span class="ac-indicator off" id="ac-ind-farm"></span>
              Авто-Ферма
            </div>
            <div class="ac-row">
              <label>Включить</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-farm-enabled" ${settings.farmEnabled ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
            <div class="ac-row">
              <label>Интервал (сек)</label>
              <input type="number" class="ac-input" id="ac-farm-interval" value="${settings.farmInterval / 1000}" min="10" max="3600">
            </div>
          </div>

          <div class="ac-section">
            <div class="ac-section-title">
              <span class="ac-indicator off" id="ac-ind-patrol"></span>
              Авто-Дозор
            </div>
            <div class="ac-row">
              <label>Включить</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-patrol-enabled" ${settings.patrolEnabled ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
            <div class="ac-row">
              <label>Интервал (сек)</label>
              <input type="number" class="ac-input" id="ac-patrol-interval" value="${settings.patrolInterval / 1000}" min="10" max="3600">
            </div>
          </div>

          <div class="ac-section">
            <div class="ac-section-title">
              <span class="ac-indicator off" id="ac-ind-mine"></span>
              Авто-Шахта
            </div>
            <div class="ac-row">
              <label>Включить</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-mine-enabled" ${settings.mineEnabled ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
            <div class="ac-row">
              <label>Интервал (сек)</label>
              <input type="number" class="ac-input" id="ac-mine-interval" value="${settings.mineInterval / 1000}" min="10" max="3600">
            </div>
          </div>

          <button class="ac-btn ac-btn-start" id="ac-btn-toggle">ЗАПУСТИТЬ</button>
        </div>

        <!-- SETTINGS TAB -->
        <div class="ac-tab-content" data-tab="settings">
          <div class="ac-section">
            <div class="ac-section-title">Общие настройки</div>
            <div class="ac-row">
              <label>Базовая задержка (сек)</label>
              <input type="number" class="ac-input" id="ac-global-delay" value="${settings.globalDelay / 1000}" min="1" max="60">
            </div>
            <div class="ac-row">
              <label>Случ. задержка (сек)</label>
              <input type="number" class="ac-input" id="ac-random-delay" value="${settings.randomDelay / 1000}" min="0" max="30">
            </div>
            <div class="ac-row">
              <label>Задержка поиска (сек)</label>
              <input type="number" class="ac-input" id="ac-search-delay" value="${settings.attackSearchDelay / 1000}" min="1" max="30">
            </div>
            <div class="ac-row">
              <label>Звуковые уведомления</label>
              <div class="ac-toggle">
                <input type="checkbox" id="ac-sound" ${settings.soundNotify ? 'checked' : ''}>
                <span class="ac-toggle-slider"></span>
              </div>
            </div>
          </div>
          <div class="ac-section">
            <div class="ac-section-title">Горячие клавиши</div>
            <div class="ac-row"><label>Ctrl+Shift+B</label><label style="color:#888">Показать/скрыть панель</label></div>
            <div class="ac-row"><label>Ctrl+Shift+S</label><label style="color:#888">Старт/стоп бота</label></div>
          </div>
        </div>

        <!-- STATS TAB -->
        <div class="ac-tab-content" data-tab="stats">
          <div class="ac-section">
            <div class="ac-section-title">Статистика сессии</div>
            <div class="ac-stats-grid">
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-attacks">0</div>
                <div class="ac-stat-label">Атак</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-wins">0</div>
                <div class="ac-stat-label">Побед</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-losses">0</div>
                <div class="ac-stat-label">Поражений</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-heals">0</div>
                <div class="ac-stat-label">Лечений</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-farms">0</div>
                <div class="ac-stat-label">Ферма</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-patrols">0</div>
                <div class="ac-stat-label">Дозоры</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-mines">0</div>
                <div class="ac-stat-label">Шахта</div>
              </div>
              <div class="ac-stat-card">
                <div class="ac-stat-value" id="ac-stat-uptime">0с</div>
                <div class="ac-stat-label">Время</div>
              </div>
            </div>
          </div>
        </div>

        <!-- LOG TAB -->
        <div class="ac-tab-content" data-tab="log">
          <div class="ac-section">
            <div class="ac-section-title">Журнал действий</div>
            <div class="ac-log" id="ac-log"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    bindEvents(panel);
    log('Панель автокликера загружена', 'info');
  }

  // =========================================================================
  //  UI — EVENTS
  // =========================================================================
  function bindEvents(panel) {
    // Drag
    const header = $('#botva-ac-header', panel);
    let dragging = false, dragX, dragY;
    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('.ac-header-btn')) return;
      dragging = true;
      dragX = e.clientX - panel.offsetLeft;
      dragY = e.clientY - panel.offsetTop;
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 50, e.clientX - dragX));
      const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragY));
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      settings.panelX = x;
      settings.panelY = y;
    });
    document.addEventListener('mouseup', function () {
      if (dragging) {
        dragging = false;
        saveSettings();
      }
    });

    // Collapse
    $('#ac-btn-collapse', panel).addEventListener('click', function () {
      panel.classList.toggle('collapsed');
      settings.panelCollapsed = panel.classList.contains('collapsed');
      saveSettings();
    });

    // Close
    $('#ac-btn-close', panel).addEventListener('click', function () {
      panel.style.display = 'none';
    });

    // Tabs
    $$('.ac-tab', panel).forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.ac-tab', panel).forEach(function (t) { t.classList.remove('active'); });
        $$('.ac-tab-content', panel).forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var target = panel.querySelector('.ac-tab-content[data-tab="' + tab.dataset.tab + '"]');
        if (target) target.classList.add('active');
      });
    });

    // Toggle start/stop
    $('#ac-btn-toggle', panel).addEventListener('click', function () {
      if (isRunning) {
        stopBot();
      } else {
        applySettings();
        startBot();
      }
    });

    // Module toggles
    bindToggle('ac-attack-enabled', 'attackEnabled');
    bindToggle('ac-heal-enabled', 'healEnabled');
    bindToggle('ac-farm-enabled', 'farmEnabled');
    bindToggle('ac-patrol-enabled', 'patrolEnabled');
    bindToggle('ac-mine-enabled', 'mineEnabled');
    bindToggle('ac-sound', 'soundNotify');

    // Numeric inputs — save on change
    $$('.ac-input', panel).forEach(function (input) {
      input.addEventListener('change', function () {
        applySettings();
        saveSettings();
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Ctrl+Shift+B — toggle panel
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        panel.style.display = panel.style.display === 'none' ? '' : 'none';
      }
      // Ctrl+Shift+S — start/stop
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        if (isRunning) stopBot(); else { applySettings(); startBot(); }
      }
    });
  }

  function bindToggle(id, settingKey) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      settings[settingKey] = el.checked;
      saveSettings();
      updateIndicators();
      if (isRunning) scheduleAll();
    });
  }

  function applySettings() {
    var v;
    v = document.getElementById('ac-attack-min');
    if (v) settings.attackMinLevel = parseInt(v.value, 10) || 1;
    v = document.getElementById('ac-attack-max');
    if (v) settings.attackMaxLevel = parseInt(v.value, 10) || 99;
    v = document.getElementById('ac-attack-interval');
    if (v) settings.attackInterval = (parseFloat(v.value) || 15) * 1000;

    v = document.getElementById('ac-heal-threshold');
    if (v) settings.healThreshold = parseInt(v.value, 10) || 30;
    v = document.getElementById('ac-heal-interval');
    if (v) settings.healInterval = (parseFloat(v.value) || 10) * 1000;

    v = document.getElementById('ac-farm-interval');
    if (v) settings.farmInterval = (parseFloat(v.value) || 60) * 1000;

    v = document.getElementById('ac-patrol-interval');
    if (v) settings.patrolInterval = (parseFloat(v.value) || 60) * 1000;

    v = document.getElementById('ac-mine-interval');
    if (v) settings.mineInterval = (parseFloat(v.value) || 60) * 1000;

    v = document.getElementById('ac-global-delay');
    if (v) settings.globalDelay = (parseFloat(v.value) || 2) * 1000;
    v = document.getElementById('ac-random-delay');
    if (v) { var rd = parseFloat(v.value); settings.randomDelay = (rd >= 0 ? rd : 3) * 1000; }
    v = document.getElementById('ac-search-delay');
    if (v) settings.attackSearchDelay = (parseFloat(v.value) || 3) * 1000;

    saveSettings();
  }

  // =========================================================================
  //  UI — UPDATES
  // =========================================================================
  function updateControlUI() {
    var btn = document.getElementById('ac-btn-toggle');
    var status = document.getElementById('ac-status');
    if (btn) {
      btn.textContent = isRunning ? 'ОСТАНОВИТЬ' : 'ЗАПУСТИТЬ';
      btn.className = 'ac-btn ' + (isRunning ? 'ac-btn-stop' : 'ac-btn-start');
    }
    if (status) {
      status.textContent = isRunning ? 'РАБОТАЕТ' : 'ОСТАНОВЛЕН';
      status.className = 'ac-status ' + (isRunning ? 'running' : 'stopped');
    }
    updateIndicators();
  }

  function updateIndicators() {
    var modules = ['attack', 'heal', 'farm', 'patrol', 'mine'];
    modules.forEach(function (m) {
      var ind = document.getElementById('ac-ind-' + m);
      if (ind) {
        var enabled = settings[m + 'Enabled'] && isRunning;
        ind.className = 'ac-indicator ' + (enabled ? 'on' : 'off');
      }
    });
  }

  function updateStatsUI() {
    var el;
    el = document.getElementById('ac-stat-attacks');
    if (el) el.textContent = stats.attacks;
    el = document.getElementById('ac-stat-wins');
    if (el) el.textContent = stats.wins;
    el = document.getElementById('ac-stat-losses');
    if (el) el.textContent = stats.losses;
    el = document.getElementById('ac-stat-heals');
    if (el) el.textContent = stats.heals;
    el = document.getElementById('ac-stat-farms');
    if (el) el.textContent = stats.farmRuns;
    el = document.getElementById('ac-stat-patrols');
    if (el) el.textContent = stats.patrolRuns;
    el = document.getElementById('ac-stat-mines');
    if (el) el.textContent = stats.mineRuns;
    el = document.getElementById('ac-stat-uptime');
    if (el) el.textContent = formatDuration(Date.now() - stats.sessionStart);
  }

  function updateLogUI() {
    var el = document.getElementById('ac-log');
    if (!el) return;
    el.innerHTML = logs.map(function (entry) {
      return '<div class="ac-log-entry ' + entry.type + '">' +
        '<span class="time">[' + entry.time + ']</span> ' + entry.msg +
        '</div>';
    }).join('');
  }

  // Periodically update uptime
  setInterval(function () {
    if (isRunning) updateStatsUI();
  }, 1000);

  // =========================================================================
  //  INIT
  // =========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }
})();
