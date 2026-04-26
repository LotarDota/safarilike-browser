"""
Game action definitions for Botva.ru auto-clicker.
Each action maps to a JavaScript snippet that finds and clicks game elements.
"""

# ---------------------------------------------------------------------------
# JavaScript helpers injected into every page
# ---------------------------------------------------------------------------

JS_HELPERS = r"""
(function() {
    if (window.__botvaHelpers) return;
    window.__botvaHelpers = true;

    window.botva = {
        // Click a link/button whose visible text contains `text`
        clickByText: function(text) {
            var elems = document.querySelectorAll('a, input[type="submit"], button, span, div.button');
            for (var i = 0; i < elems.length; i++) {
                var el = elems[i];
                var t = (el.innerText || el.value || '').trim();
                if (t.indexOf(text) !== -1) {
                    el.click();
                    return true;
                }
            }
            return false;
        },

        // Click an element matching a CSS selector
        clickBySelector: function(sel) {
            var el = document.querySelector(sel);
            if (el) { el.click(); return true; }
            return false;
        },

        // Check whether text is present on the page
        hasText: function(text) {
            return document.body && document.body.innerText.indexOf(text) !== -1;
        },

        // Navigate within the game frame
        navigate: function(url) {
            window.location.href = url;
        },

        // Get current page URL
        currentUrl: function() {
            return window.location.href;
        },

        // Submit a form by selector
        submitForm: function(sel) {
            var f = document.querySelector(sel);
            if (f) { f.submit(); return true; }
            return false;
        },

        // Click an image whose src contains `srcPart`
        clickImageBySrc: function(srcPart) {
            var imgs = document.querySelectorAll('img');
            for (var i = 0; i < imgs.length; i++) {
                if (imgs[i].src.indexOf(srcPart) !== -1) {
                    var parent = imgs[i].parentElement;
                    if (parent && parent.tagName === 'A') { parent.click(); return true; }
                    imgs[i].click();
                    return true;
                }
            }
            return false;
        },

        // Fill an input field
        fillInput: function(sel, value) {
            var el = document.querySelector(sel);
            if (el) { el.value = value; return true; }
            return false;
        },

        // Wait for element to appear
        waitFor: function(sel, timeout) {
            return new Promise(function(resolve) {
                var start = Date.now();
                var check = function() {
                    var el = document.querySelector(sel);
                    if (el) { resolve(true); return; }
                    if (Date.now() - start > (timeout || 5000)) { resolve(false); return; }
                    setTimeout(check, 300);
                };
                check();
            });
        }
    };
})();
"""


# ---------------------------------------------------------------------------
# Action definitions – each is a dict with:
#   name_ru : Russian display name
#   key     : internal key
#   js      : JavaScript to execute (uses window.botva helpers)
#   section : UI section the action belongs to
# ---------------------------------------------------------------------------

BASE_ACTIONS = [
    {
        "key": "dozor",
        "name_ru": "Дозор",
        "section": "base",
        "js": "botva.clickByText('Дозор') || botva.clickByText('Патруль');",
    },
    {
        "key": "srazhalka",
        "name_ru": "Сражалка",
        "section": "base",
        "js": "botva.clickByText('Сражаться') || botva.clickByText('Сражалка');",
    },
    {
        "key": "bodalka",
        "name_ru": "Бодалка",
        "section": "base",
        "js": "botva.clickByText('Бодаться') || botva.clickByText('Бодалка');",
    },
    {
        "key": "zorro",
        "name_ru": "Зорро",
        "section": "base",
        "js": "botva.clickByText('Зорро');",
    },
    {
        "key": "strashilki",
        "name_ru": "Страшилки",
        "section": "base",
        "js": "botva.clickByText('Страшилки') || botva.clickByText('Пугать');",
    },
    {
        "key": "arena",
        "name_ru": "Арена",
        "section": "base",
        "js": "botva.clickByText('Арена');",
    },
    {
        "key": "kach",
        "name_ru": "Кач",
        "section": "base",
        "js": "botva.clickByText('Качаться') || botva.clickByText('Тренироваться');",
    },
    {
        "key": "open",
        "name_ru": "Открываем",
        "section": "base",
        "js": "botva.clickByText('Открыть');",
    },
    {
        "key": "pokupka",
        "name_ru": "Покупка",
        "section": "base",
        "js": "botva.clickByText('Купить');",
    },
    {
        "key": "prodat",
        "name_ru": "Продать",
        "section": "base",
        "js": "botva.clickByText('Продать');",
    },
    {
        "key": "rabota",
        "name_ru": "Работа",
        "section": "base",
        "js": "botva.clickByText('Работать') || botva.clickByText('Работа');",
    },
    {
        "key": "klass",
        "name_ru": "Класс",
        "section": "base",
        "js": "botva.clickByText('Класс');",
    },
    {
        "key": "korablik",
        "name_ru": "Кораблик",
        "section": "base",
        "js": "botva.clickByText('Кораблик') || botva.clickByText('Плыть');",
    },
    {
        "key": "umeniya",
        "name_ru": "Умения",
        "section": "base",
        "js": "botva.clickByText('Умения');",
    },
    {
        "key": "korova",
        "name_ru": "Корова",
        "section": "base",
        "js": "botva.clickByText('Корова') || botva.clickByText('Доить');",
    },
    {
        "key": "muzey",
        "name_ru": "Музей",
        "section": "base",
        "js": "botva.clickByText('Музей');",
    },
    {
        "key": "karera",
        "name_ru": "Карьера!",
        "section": "base",
        "js": "botva.clickByText('Карьера');",
    },
    {
        "key": "ikarus",
        "name_ru": "Икарус",
        "section": "base",
        "js": "botva.clickByText('Икарус');",
    },
    {
        "key": "kazna",
        "name_ru": "Казна",
        "section": "base",
        "js": "botva.clickByText('Казна');",
    },
    {
        "key": "taverna",
        "name_ru": "Таверна",
        "section": "base",
        "js": "botva.clickByText('Таверна');",
    },
    {
        "key": "ferma",
        "name_ru": "Ферма",
        "section": "base",
        "js": "botva.clickByText('Ферма');",
    },
    {
        "key": "alkhimiya",
        "name_ru": "Алхимия",
        "section": "base",
        "js": "botva.clickByText('Алхимия');",
    },
    {
        "key": "podarok",
        "name_ru": "Подарок",
        "section": "base",
        "js": "botva.clickByText('Подарок');",
    },
    {
        "key": "razryvatel",
        "name_ru": "Разрыватель",
        "section": "base",
        "js": "botva.clickByText('Разрыватель');",
    },
    {
        "key": "vospitalka",
        "name_ru": "Воспиталка",
        "section": "base",
        "js": "botva.clickByText('Воспиталка');",
    },
]

MINE_ACTIONS = [
    {
        "key": "opusk_kri",
        "name_ru": "Опуск за кри",
        "section": "mine",
        "js": "botva.clickByText('Опуститься') || botva.clickByText('Спуск');",
    },
    {
        "key": "shahta",
        "name_ru": "Шахта",
        "section": "mine",
        "js": "botva.clickByText('Шахта') || botva.clickByText('Копать');",
    },
]

FORTRESS_ACTIONS = [
    {
        "key": "zhalovatsya",
        "name_ru": "Жаловаться",
        "section": "fortress",
        "js": "botva.clickByText('Жаловаться');",
    },
    {
        "key": "turist",
        "name_ru": "Турист",
        "section": "fortress",
        "js": "botva.clickByText('Турист');",
    },
    {
        "key": "fortress_taverna",
        "name_ru": "Таверна",
        "section": "fortress",
        "js": "botva.clickByText('Таверна');",
    },
    {
        "key": "katakomby",
        "name_ru": "Катакомбы",
        "section": "fortress",
        "js": "botva.clickByText('Катакомбы');",
    },
    {
        "key": "velikiy_dub",
        "name_ru": "ВеликийДуб",
        "section": "fortress",
        "js": "botva.clickByText('Великий Дуб') || botva.clickByText('ВеликийДуб');",
    },
    {
        "key": "podzem_toneli",
        "name_ru": "Подземные Тонели",
        "section": "fortress",
        "js": "botva.clickByText('Подземные') || botva.clickByText('Тонели');",
    },
    {
        "key": "akademiya_prikl",
        "name_ru": "АкадемияПрикл",
        "section": "fortress",
        "js": "botva.clickByText('Академия');",
    },
    {
        "key": "arena_gladiatorov",
        "name_ru": "АренаГладиаторов",
        "section": "fortress",
        "js": "botva.clickByText('Гладиатор') || botva.clickByText('Арена');",
    },
]

AVATAR_ACTIONS = [
    {
        "key": "auto_bodalka",
        "name_ru": "Авто Бодалка",
        "section": "avatar",
        "js": "botva.clickByText('Бодаться');",
    },
    {
        "key": "auto_shahta",
        "name_ru": "Авто Шахта",
        "section": "avatar",
        "js": "botva.clickByText('Шахта');",
    },
    {
        "key": "avatar_korablik",
        "name_ru": "Кораблик",
        "section": "avatar",
        "js": "botva.clickByText('Кораблик');",
    },
    {
        "key": "sbor_resov",
        "name_ru": "СборРесов",
        "section": "avatar",
        "js": "botva.clickByText('Собрать') || botva.clickByText('Ресурсы');",
    },
    {
        "key": "avatar_muzey",
        "name_ru": "Музей",
        "section": "avatar",
        "js": "botva.clickByText('Музей');",
    },
    {
        "key": "avatar_strashilka",
        "name_ru": "Страшилка",
        "section": "avatar",
        "js": "botva.clickByText('Страшилка') || botva.clickByText('Пугать');",
    },
    {
        "key": "avatar_kach",
        "name_ru": "Кач",
        "section": "avatar",
        "js": "botva.clickByText('Качаться');",
    },
    {
        "key": "tayniy_orden",
        "name_ru": "ТайныйОрден",
        "section": "avatar",
        "js": "botva.clickByText('Тайный') || botva.clickByText('Орден');",
    },
    {
        "key": "bitva_za_zemli",
        "name_ru": "БитваЗаЗемли",
        "section": "avatar",
        "js": "botva.clickByText('Битва за') || botva.clickByText('Земли');",
    },
    {
        "key": "zadaniya",
        "name_ru": "Задания",
        "section": "avatar",
        "js": "botva.clickByText('Задания') || botva.clickByText('Квест');",
    },
    {
        "key": "polyany",
        "name_ru": "Поляны",
        "section": "avatar",
        "js": "botva.clickByText('Поляны');",
    },
    {
        "key": "avatar_ikarus",
        "name_ru": "Икарус",
        "section": "avatar",
        "js": "botva.clickByText('Икарус');",
    },
    {
        "key": "avatar_ferma",
        "name_ru": "Ферма",
        "section": "avatar",
        "js": "botva.clickByText('Ферма');",
    },
    {
        "key": "sozdat",
        "name_ru": "Создать",
        "section": "avatar",
        "js": "botva.clickByText('Создать');",
    },
    {
        "key": "sunduk",
        "name_ru": "Сундук",
        "section": "avatar",
        "js": "botva.clickByText('Сундук');",
    },
    {
        "key": "avatar_prodat",
        "name_ru": "Продать",
        "section": "avatar",
        "js": "botva.clickByText('Продать');",
    },
]

SMALL_ADVENTURES = [
    {
        "key": "mal_prikl_1",
        "name_ru": "Мал.Прикл 1",
        "section": "adventures",
        "js": "botva.clickByText('Приключение');",
    },
    {
        "key": "mal_prikl_2",
        "name_ru": "Мал.Прикл 2",
        "section": "adventures",
        "js": "botva.clickByText('Приключение');",
    },
    {
        "key": "mal_prikl_3",
        "name_ru": "Мал.Прикл 3",
        "section": "adventures",
        "js": "botva.clickByText('Приключение');",
    },
    {
        "key": "bol_prikl",
        "name_ru": "БолПрикл",
        "section": "adventures",
        "js": "botva.clickByText('Большое приключение');",
    },
    {
        "key": "kar_kar",
        "name_ru": "КарКар",
        "section": "adventures",
        "js": "botva.clickByText('Караван');",
    },
]

ALL_ACTIONS = (
    BASE_ACTIONS
    + MINE_ACTIONS
    + FORTRESS_ACTIONS
    + AVATAR_ACTIONS
    + SMALL_ADVENTURES
)
