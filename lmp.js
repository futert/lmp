(function () {
    // Сохраняем оригинальные реализации
    const originalCreate = Document.prototype.createElement;

    // Утилита: делаем функцию похожей на нативную (toString)
    function makeNativeLike(fn, hint) {
        try {
            Object.defineProperty(fn, "toString", {
                value: () => `function ${hint}() { [native code] }`,
                configurable: true,
                enumerable: false,
                writable: false
            });
        } catch (e) { /* best-effort */ }
        return fn;
    }

    // Обёртка для createElement: только для <video> меняем поведение play
    const createElementWrapper = function (tagName, options) {
        const element = originalCreate.call(this, tagName, options);

        try {
            if (String(tagName).toLowerCase() === "video") {
                // Патчим play локально на экземпляре, делаем свойство не перечислимым
                Object.defineProperty(element, "play", {
                    configurable: true,
                    enumerable: false,
                    writable: true,
                    value: function () {
                        // Блокируем воспроизведение рекламы: мгновенно считаем, что видео завершилось
                        try { this.pause && this.pause(); } catch (e) {}
                        setTimeout(() => {
                            try {
                                this.ended = true;
                                this.dispatchEvent(new Event("ended"));
                            } catch (e) {}
                        }, 200);
                        // Возвращаем Promise-совместимый объект, как у HTMLMediaElement.play()
                        try { return Promise.resolve(); } catch (e) { return; }
                    }
                });
            }
        } catch (e) { /* без поломки основного потока */ }

        return element;
    };

    // Устанавливаем обёрнутую функцию на прототип документа, делая её "немного нативной"
    try {
        makeNativeLike(createElementWrapper, "createElement");
        Object.defineProperty(Document.prototype, "createElement", {
            value: createElementWrapper,
            configurable: true,
            writable: true,
            enumerable: false
        });
    } catch (e) { /* fail silently */ }

    // Скрытая (неперечисляемая, неизменяемая) реализация Account.hasPremium
    try {
        const acc = window.Account || (window.Account = {});
        if (!acc.hasPremium || typeof acc.hasPremium !== "function" || acc.hasPremium() !== true) {
            const hasPremiumFn = function () { return true; };
            makeNativeLike(hasPremiumFn, "hasPremium");
            Object.defineProperty(acc, "hasPremium", {
                value: hasPremiumFn,
                configurable: true,
                enumerable: false,
                writable: false
            });
        }
    } catch (e) { /* best-effort */ }

    // Очистка таймеров рекламы — запускается после загрузки документа
    function clearAdTimers() {
        try {
            const highest = setTimeout(() => { }, 0);
            for (let i = highest; i >= 0; i--) {
                try { clearTimeout(i); } catch (e) { }
                try { clearInterval(i); } catch (e) { }
            }
        } catch (e) { /* ignore */ }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", clearAdTimers, { once: true });
    } else {
        // Документ уже загружен
        clearAdTimers();
    }
})();
