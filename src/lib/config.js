"use strict";

var twpConfig = {}

{
    let observers = []
    let config = null
    const defaultTargetLanguages = ["en", "es", "de"]
    const defaultConfig = {
        pageTranslatorService: "google", // google yandex
        textTranslatorService: "google", // google yandex bing deepl
        ttsSpeed: 1.0,
        enableDeepL: "yes",
        targetLanguage: null,
        targetLanguageTextTranslation: null,
        targetLanguages: [], // "en", "es", "de"
        alwaysTranslateSites: [],
        neverTranslateSites: [],
        sitesToTranslateWhenHovering: [],
        langsToTranslateWhenHovering: [],
        alwaysTranslateLangs: [],
        neverTranslateLangs: [],
        customDictionary: new Map(),
        showTranslatePageContextMenu: "yes",
        showTranslateSelectedContextMenu: "yes",
        showButtonInTheAddressBar: "yes",
        showOriginalTextWhenHovering: "no",
        showTranslateSelectedButton: "yes",
        showPopupMobile: "yes", // yes no threeFingersOnTheScreen
        useOldPopup: "yes",
        darkMode: "auto", // auto yes no
        popupBlueWhenSiteIsTranslated: "yes",
        popupPanelSection: 1,
        showReleaseNotes: "yes",
        dontShowIfPageLangIsTargetLang: "no",
        dontShowIfPageLangIsUnknown: "no",
        dontShowIfSelectedTextIsTargetLang: "no",
        dontShowIfSelectedTextIsUnknown: "no",
        hotkeys: {}, // Hotkeys are obtained from the manifest file
        expandPanelTranslateSelectedText: "no",
        translateTag_pre: "yes",
        dontSortResults: "no",
        translateDynamicallyCreatedContent: "yes",
        autoTranslateWhenClickingALink: "no",
        translateSelectedWhenPressTwice: "no",
        translateTextOverMouseWhenPressTwice: "no",
        translateClickingOnce: "no"
    }


    let onReadyObservers = []
    let configIsReady = false
    let onReadyResolvePromise
    const onReadyPromise = new Promise(resolve => onReadyResolvePromise = resolve)

    function readyConfig() {
        configIsReady = true
        onReadyObservers.forEach(callback => callback())
        onReadyObservers = []
        onReadyResolvePromise()
    }

    twpConfig.onReady = function (callback) {
        if (callback) {
            if (configIsReady) {
                callback()
            } else {
                onReadyObservers.push(callback)
            }
        }
        return onReadyPromise
    }

    twpConfig.get = function (name) {
        return config[name]
    }

    twpConfig.set = function (name, value) {
        config[name] = value
        const obj = {}
        obj[name] = toObjIfTypeIsMap(value)
        chrome.storage.local.set(obj)
        observers.forEach(callback => callback(name, value))
    }

    twpConfig.export = function () {
        const r = {
            timeStamp: Date.now(),
            version: chrome.runtime.getManifest().version
        }

        for (const key in defaultConfig) {
            let value = twpConfig.get(key)
            r[key] = toObjIfTypeIsMap(value)
        }

        return r
    }

    twpConfig.import = function (newconfig) {
        for (const key in defaultConfig) {
            if (typeof newconfig[key] !== "undefined") {
                let value = toMapIfTypeIsObj(newconfig[key])
                twpConfig.set(key, value)
            }
        }

        if (typeof browser !== "undefined" && typeof browser.commands !== "undefined") {
            for (const name in config.hotkeys) {
                browser.commands.update({
                    name: name,
                    shortcut: config.hotkeys[name]
                })
            }
        }

        chrome.runtime.reload()
    }

    twpConfig.restoreToDefault = function () {
        if (typeof browser !== "undefined" && typeof browser.commands !== "undefined") {
            for (const name of Object.keys(chrome.runtime.getManifest().commands || {})) {
                const info = chrome.runtime.getManifest().commands[name]
                if (info.suggested_key && info.suggested_key.default) {
                    browser.commands.update({
                        name: name,
                        shortcut: info.suggested_key.default
                    })
                } else {
                    browser.commands.update({
                        name: name,
                        shortcut: ""
                    })
                }
            }
        }

        twpConfig.import(defaultConfig)
    }

    twpConfig.onChanged = function (callback) {
        observers.push(callback)
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        twpConfig.onReady(function () {
            if (areaName === "local") {
                for (const name in changes) {
                    const newValue = changes[name].newValue
                    if (config[name] !== newValue) {
                        config[name] = toMapIfTypeIsObj(newValue)
                        observers.forEach(callback => callback(name, newValue))
                    }
                }
            }
        })
    })

    chrome.i18n.getAcceptLanguages(acceptedLanguages => {
        chrome.storage.local.get(null, onGot => {
            config = {}

            for (const name in defaultConfig) {
                config[name] = defaultConfig[name]
            }

            for (let lang of acceptedLanguages) {
                if (config.targetLanguages.length >= 3) break;
                lang = twpLang.fixTLanguageCode(lang)
                if (lang && config.targetLanguages.indexOf(lang) === -1) {
                    config.targetLanguages.push(lang)
                }
            }

            for (const idx in defaultTargetLanguages) {
                if (config.targetLanguages.length >= 3) break;
                if (config.targetLanguages.indexOf(defaultTargetLanguages[idx]) === -1) {
                    config.targetLanguages.push(defaultTargetLanguages[idx])
                }
            }

            for (const name in onGot) {
                config[name] = toMapIfTypeIsObj(onGot[name])
            }

            // se tiver algum targetLanguage undefined substitui a configuração
            if (config.targetLanguages.some(tl => !tl)) {
                config.targetLanguages = defaultTargetLanguages
                chrome.storage.local.set({
                    targetLanguages: config.targetLanguages
                })
            }

            // se targetLanguages for maior que 3 remove as sobras
            while (config.targetLanguages.length > 3) config.targetLanguages.pop();

            // remove idiomas duplicados
            //config.targetLanguages = [... new Set(config.targetLanguages)]

            // preencher targetLanguages
            for (const lang of defaultTargetLanguages) {
                if (config.targetLanguages.length >= 3) break;
                if (config.targetLanguages.indexOf(lang) === -1) {
                    config.targetLanguages.push(lang)
                }
            }

            if (!config.targetLanguage || config.targetLanguages.indexOf(config.targetLanguage) === -1) {
                config.targetLanguage = config.targetLanguages[0]
            }
            if (!config.targetLanguageTextTranslation || config.targetLanguages.indexOf(config.targetLanguageTextTranslation) === -1) {
                config.targetLanguageTextTranslation = config.targetLanguages[0]
            }

            config.targetLanguages = config.targetLanguages.map(lang => twpLang.fixTLanguageCode(lang))
            config.neverTranslateLangs = config.neverTranslateLangs.map(lang => twpLang.fixTLanguageCode(lang))
            config.alwaysTranslateLangs = config.alwaysTranslateLangs.map(lang => twpLang.fixTLanguageCode(lang))
            config.targetLanguage = twpLang.fixTLanguageCode(config.targetLanguage)
            config.targetLanguageTextTranslation = twpLang.fixTLanguageCode(config.targetLanguageTextTranslation)

            if (config.targetLanguages.indexOf(config.targetLanguage) === -1) {
                config.targetLanguage = config.targetLanguages[0]
            }
            if (config.targetLanguages.indexOf(config.targetLanguageTextTranslation) === -1) {
                config.targetLanguageTextTranslation = config.targetLanguages[0]
            }


            if (chrome.commands) {
                chrome.commands.getAll(results => {
                    try {
                        for (const result of results) {
                            config.hotkeys[result.name] = result.shortcut
                        }
                        twpConfig.set("hotkeys", config.hotkeys)
                    } catch (e) {
                        console.error(e)
                    }
                    readyConfig()
                })
            } else {
                readyConfig()
            }
        })
    })

    function addInArray(configName, value) {
        const array = twpConfig.get(configName)
        if (array.indexOf(value) === -1) {
            array.push(value)
            twpConfig.set(configName, array)
        }
    }

    function addInMap(configName,key, value) {
        let map = twpConfig.get(configName)
        if (typeof map.get(key) === "undefined") {
            map.set(key,value)
            twpConfig.set(configName, map)
        }
    }

    function removeFromArray(configName, value) {
        const array = twpConfig.get(configName)
        const index = array.indexOf(value)
        if (index > -1) {
            array.splice(index, 1)
            twpConfig.set(configName, array)
        }
    }

    function removeFromMap(configName, key) {
        const map = twpConfig.get(configName)
        if (typeof map.get(key) !== "undefined") {
            map.delete(key)
            twpConfig.set(configName, map)
        }
    }

    twpConfig.addSiteToTranslateWhenHovering = function (hostname) {
        addInArray("sitesToTranslateWhenHovering", hostname)
    }

    twpConfig.removeSiteFromTranslateWhenHovering = function (hostname) {
        removeFromArray("sitesToTranslateWhenHovering", hostname)
    }

    twpConfig.addLangToTranslateWhenHovering = function (lang) {
        addInArray("langsToTranslateWhenHovering", lang)
    }

    twpConfig.removeLangFromTranslateWhenHovering = function (lang) {
        removeFromArray("langsToTranslateWhenHovering", lang)
    }

    twpConfig.addSiteToAlwaysTranslate = function (hostname) {
        addInArray("alwaysTranslateSites", hostname)
        removeFromArray("neverTranslateSites", hostname)
    }
    twpConfig.removeSiteFromAlwaysTranslate = function (hostname) {
        removeFromArray("alwaysTranslateSites", hostname)
    }
    twpConfig.addSiteToNeverTranslate = function (hostname) {
        addInArray("neverTranslateSites", hostname)
        removeFromArray("alwaysTranslateSites", hostname)
        removeFromArray("sitesToTranslateWhenHovering", hostname)
    }
    twpConfig.addKeyWordTocustomDictionary = function (key, value) {
        addInMap("customDictionary", key, value)
    }
    twpConfig.removeSiteFromNeverTranslate = function (hostname) {
        removeFromArray("neverTranslateSites", hostname)
    }
    twpConfig.removeKeyWordFromcustomDictionary = function (keyWord) {
        removeFromMap("customDictionary", keyWord)
    }
    twpConfig.addLangToAlwaysTranslate = function (lang, hostname) {
        addInArray("alwaysTranslateLangs", lang)
        removeFromArray("neverTranslateLangs", lang)

        if (hostname) {
            removeFromArray("neverTranslateSites", hostname)
        }
    }
    twpConfig.removeLangFromAlwaysTranslate = function (lang) {
        removeFromArray("alwaysTranslateLangs", lang)
    }
    twpConfig.addLangToNeverTranslate = function (lang, hostname) {
        addInArray("neverTranslateLangs", lang)
        removeFromArray("alwaysTranslateLangs", lang)
        removeFromArray("langsToTranslateWhenHovering", lang)

        if (hostname) {
            removeFromArray("alwaysTranslateSites", hostname)
        }
    }
    twpConfig.removeLangFromNeverTranslate = function (lang) {
        removeFromArray("neverTranslateLangs", lang)
    }

    function addTargetLanguage(lang) {
        const targetLanguages = twpConfig.get("targetLanguages")
        lang = twpLang.fixTLanguageCode(lang)
        if (!lang) return;

        const index = targetLanguages.indexOf(lang)
        if (index === -1) {
            targetLanguages.unshift(lang)
            targetLanguages.pop()
        } else {
            targetLanguages.splice(index, 1)
            targetLanguages.unshift(lang)
        }

        twpConfig.set("targetLanguages", targetLanguages)
    }

    twpConfig.setTargetLanguage = function (lang, forTextToo = false) {
        const targetLanguages = twpConfig.get("targetLanguages")
        lang = twpLang.fixTLanguageCode(lang)
        if (!lang) return;

        if (targetLanguages.indexOf(lang) === -1 || forTextToo) {
            addTargetLanguage(lang)
        }

        twpConfig.set("targetLanguage", lang)

        if (forTextToo) {
            twpConfig.setTargetLanguageTextTranslation(lang)
        }
    }

    twpConfig.setTargetLanguageTextTranslation = function (lang) {
        lang = twpLang.fixTLanguageCode(lang)
        if (!lang) return;

        twpConfig.set("targetLanguageTextTranslation", lang)
    }
}

/**
 * The StorageEvent.newValue unable to monitor Map changes.
 *
 * So here the Map type is converted to Object, otherwise return it directly.
 * */
function toObjIfTypeIsMap(value) {
    if (value instanceof Map) {
        return Object.fromEntries(value)
    } else {
        return value
    }
}

/**
 * If it is Object we convert it to Map, otherwise return it directly.
 * */
function toMapIfTypeIsObj(value) {
    if (Object.prototype.toString.call(value) === '[object Object]') {
        return new Map(Object.entries(value))
    }else {
        return value
    }
}
