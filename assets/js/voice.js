/**
 * Browser speech narration for recognition results.
 */
(function (global) {
  "use strict";

  let lastText = "";
  let voicesReady = false;
  let speakTimer = 0;
  let keepAlive = 0;
  let activeUtterance = null;

  function t(key) {
    return global.I18n && I18n.t ? I18n.t(key) : key;
  }

  function prefs() {
    return global.ARPrefs ? ARPrefs.load() : { voiceEnabled: true, autoSpeak: true, volume: 100, voiceURI: "" };
  }

  function clean(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text || text === "\u2014" || text === "-" || /^unknown$/i.test(text) || text === "\u672a\u77e5") return "";
    if (/^https?:\/\//i.test(text)) return "";
    if (/^[{\[]/.test(text)) return "";
    return text;
  }

  function article(word) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
  }

  const ARVoice = {
    supported() {
      return typeof global.speechSynthesis !== "undefined" && typeof global.SpeechSynthesisUtterance !== "undefined";
    },

    lastText() {
      return lastText;
    },

    cancel() {
      if (!this.supported()) return;
      clearTimeout(speakTimer);
      clearInterval(keepAlive);
      try { global.speechSynthesis.cancel(); } catch (_) {}
    },

    voices() {
      if (!this.supported()) return [];
      return global.speechSynthesis.getVoices() || [];
    },

    allVoices() {
      const list = this.voices().slice();
      list.sort((a, b) => Number(!!b.localService) - Number(!!a.localService));
      return list;
    },

    preferredVoices() {
      const lang = global.I18n && I18n.lang === "zh" ? "zh" : "en";
      const all = this.allVoices();
      const matched = all.filter((v) => String(v.lang || "").toLowerCase().indexOf(lang) === 0);
      return matched.length ? matched : all;
    },

    currentVoiceLang() {
      const settings = prefs();
      if (settings.voiceLang) return settings.voiceLang;
      if (settings.voiceURI) {
        const chosen = this.voices().find((v) => v.voiceURI === settings.voiceURI);
        if (chosen && chosen.lang) return chosen.lang;
      }
      if (settings.voiceName) {
        const named = this.voices().find((v) => v.name === settings.voiceName);
        if (named && named.lang) return named.lang;
      }
      return global.I18n && I18n.lang === "zh" ? "zh-CN" : "en-US";
    },

    arm() {
      if (!this.supported()) return;
      const synth = global.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(" ");
      utter.volume = 0;
      utter.rate = 2;
      try {
        synth.resume();
        synth.speak(utter);
      } catch (_) {}
    },

    voiceBase(code) {
      const c = String(code || "en").toLowerCase().replace("_", "-");
      if (c.indexOf("zh") === 0) {
        if (c.indexOf("tw") !== -1) return "zh-TW";
        if (c.indexOf("hk") !== -1 || c.indexOf("yue") !== -1) return "zh-HK";
        return "zh-CN";
      }
      return c.split("-")[0] || "en";
    },

    pickVoice(uri, langHint) {
      const list = this.voices();
      const settings = prefs();
      if (uri) {
        const exact = list.find((v) => v.voiceURI === uri);
        if (exact) return exact;
      }
      if (settings.voiceName) {
        const named = list.find((v) => v.name === settings.voiceName);
        if (named) return named;
      }
      const hint = String(langHint || "en").toLowerCase();
      const matched = list.filter((v) => String(v.lang || "").toLowerCase().indexOf(hint) === 0);
      matched.sort((a, b) => Number(!!b.localService) - Number(!!a.localService));
      return matched[0] || null;
    },

    localVoice(langHint) {
      const hint = this.voiceBase(langHint);
      const prefix = hint.indexOf("zh") === 0 ? "zh" : hint;
      const locals = this.allVoices().filter((v) => v.localService);
      const pool = locals.length ? locals : this.allVoices();
      return pool.find((v) => this.voiceBase(v.lang) === hint)
        || pool.find((v) => String(v.lang || "").toLowerCase().indexOf(prefix) === 0)
        || null;
    },

    speakText(text, options) {
      const opts = options || {};
      if (!this.supported()) return { ok: false, reason: "unsupported" };
      const message = clean(text);
      if (!message) return { ok: false, reason: "empty" };
      const settings = prefs();
      if (!opts.force && settings.voiceEnabled === false) return { ok: false, reason: "disabled" };

      const synth = global.speechSynthesis;
      clearTimeout(speakTimer);
      lastText = message;

      const start = () => {
        const utter = new SpeechSynthesisUtterance(message);
        const volume = Number(settings.volume);
        utter.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1;
        utter.rate = 1;
        utter.pitch = 1;
        const langCode = opts.lang || this.currentVoiceLang();
        const voice = opts.useLocal
          ? this.localVoice(langCode)
          : this.pickVoice(settings.voiceURI, langCode);
        utter.lang = (voice && voice.lang) || langCode;
        if (voice) utter.voice = voice;
        utter.onend = () => { clearInterval(keepAlive); };
        utter.onerror = (event) => {
          clearInterval(keepAlive);
          const reason = event && event.error ? event.error : "failed";
          if (reason === "interrupted" || reason === "canceled") return;
          if (!opts.retried) {
            const same = this.localVoice(opts.lang || utter.lang);
            const nextLang = (same && same.lang) || opts.lang || utter.lang;
            this.speakText(message, Object.assign({}, opts, { force: true, retried: true, useLocal: true, lang: nextLang }));
            return;
          }
          document.dispatchEvent(new CustomEvent("arvoice:error", { detail: { reason: reason } }));
        };
        activeUtterance = utter;
        try {
          synth.resume();
          synth.speak(activeUtterance);
          setTimeout(() => { try { synth.resume(); } catch (_) {} }, 80);
          setTimeout(() => { try { synth.resume(); } catch (_) {} }, 300);
          clearInterval(keepAlive);
          keepAlive = setInterval(() => {
            if (!synth.speaking) {
              clearInterval(keepAlive);
              return;
            }
            try { synth.resume(); } catch (_) {}
          }, 4000);
        } catch (_) {
          document.dispatchEvent(new CustomEvent("arvoice:error", { detail: { reason: "failed" } }));
        }
      };

      if (synth.speaking || synth.pending) {
        try { synth.cancel(); } catch (_) {}
        speakTimer = setTimeout(start, 80);
      } else {
        start();
      }
      return { ok: true, text: message };
    },

    speakAll(fields, lang) {
      const code = lang || this.currentVoiceLang();
      const base = this.voiceBase(code);
      const labels = this.fieldLabels(base);
      const parts = [];
      const product = (fields.productName || fields.product || "").trim();
      const maker = (fields.manufacturer || "").trim();
      const spec = (fields.specification || "").trim();
      const desc = (fields.description || "").trim();
      if (product) parts.push(labels.product + " " + product + ".");
      if (maker) parts.push(labels.manufacturer + " " + maker + ".");
      if (spec && spec !== "—" && spec !== "-") parts.push(labels.specification + " " + spec + ".");
      if (desc && desc !== "—" && desc !== "-") parts.push(labels.description + " " + desc);
      if (!parts.length) return { ok: false, reason: "empty" };
      return this.speakText(parts.join(" "), { lang: code, force: true });
    },

    fieldLabels(base) {
      const table = {
        en: { product: "Product:", manufacturer: "Manufacturer:", specification: "Specification:", description: "Description:" },
        "zh-CN": { product: "\u4ea7\u54c1\uff1a", manufacturer: "\u5236\u9020\u5546\uff1a", specification: "\u89c4\u683c\uff1a", description: "\u63cf\u8ff0\uff1a" },
        "zh-TW": { product: "\u7522\u54c1\uff1a", manufacturer: "\u88fd\u9020\u5546\uff1a", specification: "\u898f\u683c\uff1a", description: "\u63cf\u8ff0\uff1a" },
        "zh-HK": { product: "\u7522\u54c1\uff1a", manufacturer: "\u88fd\u9020\u5546\uff1a", specification: "\u898f\u683c\uff1a", description: "\u63cf\u8ff0\uff1a" },
        it: { product: "Prodotto:", manufacturer: "Produttore:", specification: "Specifiche:", description: "Descrizione:" },
        es: { product: "Producto:", manufacturer: "Fabricante:", specification: "Especificaci\u00f3n:", description: "Descripci\u00f3n:" },
        fr: { product: "Produit :", manufacturer: "Fabricant :", specification: "Sp\u00e9cification :", description: "Description :" },
        de: { product: "Produkt:", manufacturer: "Hersteller:", specification: "Spezifikation:", description: "Beschreibung:" },
        ja: { product: "\u88fd\u54c1\uff1a", manufacturer: "\u30e1\u30fc\u30ab\u30fc\uff1a", specification: "\u4ed5\u69d8\uff1a", description: "\u8aac\u660e\uff1a" },
        ko: { product: "\uc81c\ud488:", manufacturer: "\uc81c\uc870\uc0ac:", specification: "\uc0ac\uc591:", description: "\uc124\uba85:" },
        pt: { product: "Produto:", manufacturer: "Fabricante:", specification: "Especifica\u00e7\u00e3o:", description: "Descri\u00e7\u00e3o:" },
        nl: { product: "Product:", manufacturer: "Fabrikant:", specification: "Specificatie:", description: "Beschrijving:" },
        pl: { product: "Produkt:", manufacturer: "Producent:", specification: "Specyfikacja:", description: "Opis:" },
        ru: { product: "\u041f\u0440\u043e\u0434\u0443\u043a\u0442:", manufacturer: "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c:", specification: "\u0425\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0438:", description: "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435:" },
        hi: { product: "\u0909\u0924\u094d\u092a\u093e\u0926:", manufacturer: "\u0928\u093f\u0930\u094d\u092e\u093e\u0924\u093e:", specification: "\u0935\u093f\u0936\u093f\u0937\u094d\u091f\u0924\u093e:", description: "\u0935\u093f\u0935\u0930\u0923:" },
        id: { product: "Produk:", manufacturer: "Produsen:", specification: "Spesifikasi:", description: "Deskripsi:" },
        th: { product: "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32:", manufacturer: "\u0e1c\u0e39\u0e49\u0e1c\u0e25\u0e34\u0e15:", specification: "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14:", description: "\u0e04\u0e33\u0e2d\u0e18\u0e34\u0e1a\u0e32\u0e22:" },
        vi: { product: "S\u1ea3n ph\u1ea9m:", manufacturer: "Nh\u00e0 s\u1ea3n xu\u1ea5t:", specification: "Th\u00f4ng s\u1ed1:", description: "M\u00f4 t\u1ea3:" },
        tr: { product: "\u00dcr\u00fcn:", manufacturer: "\u00dcretici:", specification: "\u00d6zellik:", description: "A\u00e7\u0131klama:" },
        ar: { product: "\u0627\u0644\u0645\u0646\u062a\u062c:", manufacturer: "\u0627\u0644\u0635\u0627\u0646\u0639:", specification: "\u0627\u0644\u0645\u0648\u0627\u0635\u0641\u0627\u062a:", description: "\u0627\u0644\u0648\u0635\u0641:" },
      };
      return table[base] || table.en;
    },

    speakRecognitionResult(result, options) {
      if (!result) return { ok: false, reason: "empty" };
      const langCode = (options && options.lang) || this.currentVoiceLang();
      const base = this.voiceBase(langCode);
      const zh = base.indexOf("zh") === 0;
      const name = zh
        ? (clean(result.productNameZh) || clean(result.productName) || clean(result.objectLabelZh) || clean(result.objectLabel))
        : (clean(result.productName) || clean(result.objectLabel));
      const maker = zh
        ? (clean(result.manufacturerZh) || clean(result.manufacturer))
        : clean(result.manufacturer);
      const desc = zh
        ? (clean(result.descriptionZh) || clean(result.description) || clean(result.specificationZh) || clean(result.specification))
        : (base === "en" ? (clean(result.description) || clean(result.specification)) : "");
      const sentence = this.sentenceFor(base, name, maker) + (desc ? (zh ? desc : " " + desc) : "");
      return this.speakText(sentence, Object.assign({}, options || {}, { lang: langCode }));
    },

    sentenceFor(base, name, maker) {
      const item = name || "";
      const who = maker || "";
      const both = !!(item && who && item.toLowerCase().indexOf(who.toLowerCase()) === -1);
      const table = {
        "zh-CN": "\u8fd9\u662f" + (both || (!item && who) ? who + "\u7684" : "") + (item || "\u4e00\u4e2a\u7269\u4f53") + "\u3002",
        "zh-TW": "\u9019\u662f" + (both ? who + "\u7684" : "") + (item || "\u4e00\u500b\u7269\u9ad4") + "\u3002",
        "zh-HK": "\u5462\u500b\u4fc2" + (both ? who + "\u5605" : "") + (item || "\u4e00\u4ef6\u5622") + "\u3002",
        it: both ? "Questo \u00e8 " + item + " di " + who + "." : "Questo \u00e8 " + (item || "un oggetto") + ".",
        es: both ? "Esto es " + item + " de " + who + "." : "Esto es " + (item || "un objeto") + ".",
        fr: both ? "Ceci est " + item + " de " + who + "." : "Ceci est " + (item || "un objet") + ".",
        de: both ? "Das ist " + item + " von " + who + "." : "Das ist " + (item || "ein Objekt") + ".",
        ja: "\u3053\u308c\u306f" + (both ? who + "\u306e" : "") + (item || "\u7269\u4f53") + "\u3067\u3059\u3002",
        ko: "\uc774\uac83\uc740 " + (both ? who + "\uc758 " : "") + (item || "\ubb3c\uccb4") + "\uc785\ub2c8\ub2e4.",
        pt: both ? "Isto \u00e9 " + item + " da " + who + "." : "Isto \u00e9 " + (item || "um objeto") + ".",
        nl: both ? "Dit is " + item + " van " + who + "." : "Dit is " + (item || "een object") + ".",
        pl: both ? "To jest " + item + " firmy " + who + "." : "To jest " + (item || "obiekt") + ".",
        ru: both ? "\u042d\u0442\u043e " + item + " \u043e\u0442 " + who + "." : "\u042d\u0442\u043e " + (item || "\u043e\u0431\u044a\u0435\u043a\u0442") + ".",
        hi: "\u092f\u0939 " + (both ? who + " \u0915\u093e " : "") + (item || "\u0935\u0938\u094d\u0924\u0941") + " \u0939\u0948\u0964",
        id: both ? "Ini adalah " + item + " dari " + who + "." : "Ini adalah " + (item || "sebuah benda") + ".",
        th: "\u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d " + (both ? who + " " : "") + (item || "\u0e27\u0e31\u0e15\u0e16\u0e38"),
        vi: both ? "\u0110\u00e2y l\u00e0 " + item + " c\u1ee7a " + who + "." : "\u0110\u00e2y l\u00e0 " + (item || "m\u1ed9t v\u1eadt") + ".",
        tr: both ? "Bu, " + who + " \u00fcr\u00fcn\u00fc " + item + "." : "Bu bir " + (item || "nesne") + ".",
        ar: both ? "\u0647\u0630\u0627 " + item + " \u0645\u0646 " + who + "." : "\u0647\u0630\u0627 " + (item || "\u0634\u064a\u0621") + ".",
      };
      if (table[base]) return table[base];
      if (both) return "This is " + article(who) + " " + who + " " + item + ".";
      return "This is " + (item ? article(item) + " " + item : "an object") + ".";
    },

    testSentence(code) {
      const base = this.voiceBase(code);
      const lines = {
        "zh-CN": "\u8fd9\u662f AI \u7269\u4f53\u8bc6\u522b\u7cfb\u7edf\u7684\u8bed\u97f3\u6d4b\u8bd5\u3002",
        "zh-TW": "\u9019\u662f AI \u7269\u9ad4\u8fa8\u8b58\u7cfb\u7d71\u7684\u8a9e\u97f3\u6e2c\u8a66\u3002",
        "zh-HK": "\u5462\u500b\u4fc2 AI \u7269\u4ef6\u8b58\u5225\u7cfb\u7d71\u5605\u8072\u97f3\u6e2c\u8a66\u3002",
        it: "Questa \u00e8 una prova vocale del sistema di riconoscimento oggetti.",
        es: "Esta es una prueba de voz del sistema de reconocimiento de objetos.",
        fr: "Ceci est un test vocal du syst\u00e8me de reconnaissance d'objets.",
        de: "Dies ist ein Sprachtest f\u00fcr das Objekterkennungssystem.",
        ja: "\u3053\u308c\u306f\u7269\u4f53\u8a8d\u8b58\u30b7\u30b9\u30c6\u30e0\u306e\u97f3\u58f0\u30c6\u30b9\u30c8\u3067\u3059\u3002",
        ko: "\uc774\uac83\uc740 \uc0ac\ubb3c \uc778\uc2dd \uc2dc\uc2a4\ud15c\uc758 \uc74c\uc131 \ud14c\uc2a4\ud2b8\uc785\ub2c8\ub2e4.",
        pt: "Este \u00e9 um teste de voz do sistema de reconhecimento de objetos.",
        nl: "Dit is een spraaktest voor het objectherkenningssysteem.",
        pl: "To jest test g\u0142osu systemu rozpoznawania obiekt\u00f3w.",
        ru: "\u042d\u0442\u043e \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0442\u0435\u0441\u0442 \u0441\u0438\u0441\u0442\u0435\u043c\u044b \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0432\u0430\u043d\u0438\u044f \u043e\u0431\u044a\u0435\u043a\u0442\u043e\u0432.",
        hi: "\u092f\u0939 \u0935\u0938\u094d\u0924\u0941 \u092a\u0939\u091a\u093e\u0928 \u092a\u094d\u0930\u0923\u093e\u0932\u0940 \u0915\u093e \u0906\u0935\u093e\u091c \u092a\u0930\u0940\u0915\u094d\u0937\u0923 \u0939\u0948\u0964",
        id: "Ini adalah uji suara untuk sistem pengenalan objek.",
        th: "\u0e19\u0e35\u0e48\u0e04\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e17\u0e14\u0e2a\u0e2d\u0e1a\u0e40\u0e2a\u0e35\u0e22\u0e07\u0e02\u0e2d\u0e07\u0e23\u0e30\u0e1a\u0e1a\u0e08\u0e14\u0e08\u0e33\u0e41\u0e19\u0e01\u0e27\u0e31\u0e15\u0e16\u0e38",
        vi: "\u0110\u00e2y l\u00e0 b\u00e0i ki\u1ec3m tra gi\u1ecdng n\u00f3i c\u1ee7a h\u1ec7 th\u1ed1ng nh\u1eadn d\u1ea1ng v\u1eadt th\u1ec3.",
        tr: "Bu, nesne tan\u0131ma sistemi i\u00e7in bir ses testidir.",
        ar: "\u0647\u0630\u0627 \u0627\u062e\u062a\u0628\u0627\u0631 \u0635\u0648\u062a\u064a \u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0634\u064a\u0627\u0621.",
        en: "This is a voice test for the AI Object Recognition System.",
      };
      return lines[base] || lines.en;
    },

    replay() {
      if (!lastText) return { ok: false, reason: "empty" };
      return this.speakText(lastText, { force: true });
    },

    test() {
      if (this.supported()) {
        try {
          global.speechSynthesis.getVoices();
          global.speechSynthesis.resume();
        } catch (_) {}
      }
      const langCode = this.currentVoiceLang();
      return this.speakText(this.testSentence(langCode), { force: true, lang: langCode });
    },

    whenVoicesReady(callback) {
      if (!this.supported()) {
        callback([]);
        return;
      }
      const synth = global.speechSynthesis;
      let tries = 0;
      const run = () => {
        const list = this.allVoices();
        if (list.length || tries > 20) {
          voicesReady = list.length > 0;
          callback(list);
          return true;
        }
        return false;
      };
      try { synth.getVoices(); } catch (_) {}
      if (run()) return;
      const onChange = () => {
        if (run()) synth.removeEventListener("voiceschanged", onChange);
      };
      synth.addEventListener("voiceschanged", onChange);
      const timer = setInterval(() => {
        tries += 1;
        try { synth.getVoices(); } catch (_) {}
        if (run() || tries > 20) {
          clearInterval(timer);
          synth.removeEventListener("voiceschanged", onChange);
        }
      }, 250);
    },
  };

  global.ARVoice = ARVoice;
  global.speakRecognitionResult = function (result) {
    return ARVoice.speakRecognitionResult(result);
  };
})(window);