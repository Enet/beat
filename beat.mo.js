/*
    beat.js JavaScript Library v0.0.2 (Mutation Observer API)
    https://github.com/Enet/beat

    Released under the GNU GPLv3 license
    https://github.com/Enet/beat/blob/master/LICENSE

    Date: 2016-01-09T13:21Z
*/
'prevent prettydiff';
'use strict';

(function () {
    var $ = window.$,
        noConflict = window.beat,
        protos = {},
        services = {},
        callbacks = [],
        beat,
        uid = 0,
        antiGarbageCollector = new WeakSet(),
        htmlElemProto = HTMLElement.prototype,
        customElemProto,
        bemElemProto,
        bemBlockProto;

    window.setImmediate = window.setImmediate || function (callback) {
        window.addEventListener('message', function listener () {
            window.removeEventListener('message', listener);
            callback();
        });
        window.postMessage(null, '*');
    };

    if ($ && $.fn) {
        $.fn.emit = $.fn.trigger;
        $.fn.once = $.fn.one;

        $.fn.apply = function (method, args) {
            for (var e = 0, el = this.length; e < el; e++) {
                var elem = this[e];
                if (elem && typeof elem[method] === 'function') elem[method].apply(elem, args);
            }
            return this;
        };

        $.fn.call = function (method) {
            return this.apply(method, [].slice.call(arguments, 1));
        };
    }

    function closest (elem, selector) {
        if ((elem.matches || elem.msMatchesSelector).call(elem, selector)) {
            return elem;
        } else if (elem.parentNode) {
            return closest(elem.parentNode, selector);
        } else {
            return null;
        }
    };

    function isPrevented (elem, attrName, newVal, callbackObjects) {
        if (this.hasLock(attrName)) return true;

        var prevVal = this.getAttribute(attrName),
            prevented = false,
            args = elem ? [elem, attrName, newVal, prevVal] : [attrName, newVal, prevVal];

        callbackObjects.forEach(callbackObject => {
            if (!callbackObject) return;
            for (var n of ['*', attrName]) {
                if (!callbackObject[n]) continue;
                for (var v of ['*', newVal]) {
                    var callback = callbackObject[n][v];
                    if (typeof callback === 'function' && callback.apply(this, args) === false) {
                        prevented = true;
                    }
                }
            }
        });

        return prevented;
    };

    function executeCallbacks () {
        if ((document.readyState === 'complete' || document.readyState === 'interactive') && callbacks.length) {
            callbacks.forEach(callback => callback());
            callbacks = [];
        }
    };

    customElemProto = {
        createdCallback: function (manualInit) {
            if (this.attributeLocks) return;
            Object.defineProperties(this, {
                isBlock: {value: false, configurable: true},
                isElem: {value: false, configurable: true},
                attributeLocks: {value: {uid: true, module: true}}
            });

            this.dom = $ ? $(this) : this;
            antiGarbageCollector.add(this);
            htmlElemProto.setAttribute.call(this, 'bem', 'created');
            if (!manualInit) htmlElemProto.setAttribute.call(this, 'bem', 'attached');
        },

        attributeChangedCallback: function (elem, attrName, prevVal, newVal, callbackObject) {
            if (attrName === 'uid' || attrName === 'module') return;
            var args = elem ? [elem, attrName, newVal, prevVal] : [attrName, newVal, prevVal];
            for (var n of ['*', attrName]) {
                if (!callbackObject[n]) continue;
                for (var v of ['*', newVal]) {
                    if (typeof callbackObject[n][v] === 'function') {
                        callbackObject[n][v].apply(this, args);
                    }
                }
            }
        },

        attachedCallback: function () {
            var prevVal = this.getAttribute('bem');
            this.setAttribute('bem', 'attached');
            callbacks.push(() => {
                this.attributeChangedCallback('bem', prevVal, 'attached');
            });
        },

        detachedCallback: function () {
            var prevVal = this.getAttribute('bem');
            this.setAttribute('bem', 'detached');
            callbacks.push(() => {
                this.attributeChangedCallback('bem', prevVal, 'detached');
            });
        },

        initAttributes: function (elem, callbackObjects) {
            var bemVal = this.getAttribute('bem');
            callbacks.push(() => {
                if (!(callbackObjects instanceof Array)) {
                    callbackObjects.updateBlock();
                    if (!callbackObjects.block) return;
                    callbackObjects = [
                        callbackObjects.block._beforeElemSetAttribute['*'],
                        callbackObjects.block._beforeElemSetAttribute[this.elemName]
                    ];
                }
                this._initedAttributes = {};
                this.attributeChangedCallback('bem', null, 'created');
                this._initedAttributes.bem = true;
                if (bemVal === 'attached') this.attributeChangedCallback('bem', 'created', 'attached');
                for (var a = 0, al = this.attributes.length; a < al; a++) {
                    var attribute = this.attributes[a];
                    if (this._initedAttributes[attribute.name]) continue;
                    if (isPrevented.call(this, elem, attribute.name, attribute.value, callbackObjects)) continue;
                    this.attributeChangedCallback(attribute.name, null, attribute.value);
                }
                delete this._initedAttributes;
            });
            delete this.initAttributes;
        },

        setLock: function (attrName, lockVal) {
            if (attrName !== 'uid' && attrName !== 'module') this.attributeLocks[attrName] = !!lockVal;
        },

        hasLock: function (attrName) {
            return !!this.attributeLocks[attrName];
        },

        getAttribute: function (attrName) {
            return htmlElemProto.getAttribute.call(this, attrName);
        },

        getAttributes: function () {
            var attributes = {};
            [].forEach.call(this.attributes, attribute => {
                attributes[attribute.name] = attribute.value;
            });
            return attributes;
        },

        hasAttribute: function (attrName, attrVal) {
            return arguments.length === 1 ? htmlElemProto.hasAttribute.call(this, attrName) : this.getAttribute(attrName) === attrVal;
        },

        setAttribute: function (elem, attrName, newVal, callbackObjects) {
            if (isPrevented.apply(this, arguments)) return;
            if (this._initedAttributes) this._initedAttributes[attrName] = true;
            if (newVal === undefined || newVal === null) {
                htmlElemProto.removeAttribute.call(this, attrName);
            } else {
                htmlElemProto.setAttribute.call(this, attrName, newVal);
            }
        },

        defaultAttribute: function (attrName, attrVal) {
            if (!this.hasAttribute(attrName)) this.setAttribute(attrName, attrVal);
        },

        removeAttribute: function (attrName) {
            this.setAttribute(attrName, null);
        },

        toggleAttribute: function (attrName, attrVals) {
            var index = (attrVals.indexOf(this.getAttribute(attrName)) + 1) % attrVals.length;
            this.setAttribute(attrName, attrVals[index] || null);
        }
    };

    bemElemProto = {
        createdCallback: function (manualInit) {
            customElemProto.createdCallback.call(this, manualInit);
            var splittedModuleName = (this.getAttribute('module') || '').toLowerCase().split('__');
            Object.defineProperties(this, {
                isElem: {value: true},
                elemName: {value: splittedModuleName[1] || ''},
                blockName: {value: splittedModuleName[0]}
            });
            this.initAttributes(this, this);
        },

        attributeChangedCallback: function (attrName, prevVal, newVal) {
            if (this.block) {
                for (var e of ['*', this.elemName]) {
                    var callbackObject = this.block._onElemSetAttribute[e];
                    callbackObject && customElemProto.attributeChangedCallback.call(this, this, attrName, prevVal, newVal, callbackObject);
                }
            }
        },

        attachedCallback: function () {
            customElemProto.attachedCallback.call(this);
            this.updateBlock();
        },

        detachedCallback: function () {
            customElemProto.detachedCallback.call(this);
            this.updateBlock();
        },

        setAttribute: function (attrName, newVal) {
            if (this.block) {
                customElemProto.setAttribute.call(this, this, attrName, newVal, [
                    this.block._beforeElemSetAttribute['*'],
                    this.block._beforeElemSetAttribute[this.elemName]
                ]);
            }
        },

        updateBlock: function () {
            var block = this.closest ?
                    this.closest('[module="' + this.blockName + '"]') :
                    closest(this, '[module="' + this.blockName + '"]'),
                uid = (block && block.uid) || 0;
            Object.defineProperties(this, {
                block: {value: block, configurable: true},
                uid: {value: htmlElemProto.setAttribute.call(this, 'uid', uid) || uid, configurable: true}
            });
        },

        getBlock: function () {
            return this.block;
        }
    };

    bemBlockProto = {
        createdCallback: function (manualInit) {
            Object.defineProperty(this, 'uid', {
                value: htmlElemProto.setAttribute.call(this, 'uid', ++uid) || uid,
                configurable: true
            });
            this._beforeSetAttribute = this._beforeSetAttribute || {};
            this._onSetAttribute = this._onSetAttribute || {};
            this._beforeElemSetAttribute = this._beforeElemSetAttribute || {};
            this._onElemSetAttribute = this._onElemSetAttribute || {};
            customElemProto.createdCallback.call(this, manualInit);
            this.initAttributes(null, [this._beforeSetAttribute]);
            Object.defineProperty(this, 'isBlock', {value: true});
        },

        attributeChangedCallback: function (attrName, prevVal, newVal) {
            customElemProto.attributeChangedCallback.call(this, null, attrName, prevVal, newVal, this._onSetAttribute);
        },

        setAttribute: function (attrName, newVal) {
            customElemProto.setAttribute.call(this, null, attrName, newVal, [this._beforeSetAttribute]);
        },

        getBlock: function (blockName, selector) {
            var block = this.querySelector(`[module="${blockName}"][uid]${selector || ''}`);
            return block;
        },

        getBlocks: function (blockName, selector) {
            var blocks = this.querySelectorAll(`[module="${blockName}"][uid]${selector || ''}`);
            return $ ? $(Array.from(blocks)) : blocks;
        },

        getElem: function (elemName, selector) {
            elemName = (elemName || '') + '';
            var elem = this.querySelector(`[module="${this.tagName.toLowerCase()}__${elemName.toLowerCase().trim()}"][uid="${this.uid}"]${selector || ''}`);
            return $ ? $(elem) : elem;
        },

        getElems: function (elemName, selector) {
            elemName = (elemName || '') + '';
            var elems = this.querySelectorAll(`[module="${this.tagName.toLowerCase()}__${elemName.toLowerCase().trim()}"][uid="${this.uid}"]${selector || ''}`);
            return $ ? $(Array.from(elems)) : elems;
        }
    };

    beat = {
        registerElement: function (tagName, methods) {
            tagName = tagName.toLowerCase();
            if (protos[tagName]) return;

            var isElem = ~tagName.indexOf('__'),
                currentProto = protos[tagName] = {},
                baseProto = isElem ? bemElemProto : bemBlockProto;

            for (var p in customElemProto) {
                currentProto[p] = customElemProto[p];
            }

            for (var p in baseProto) {
                currentProto[p] = baseProto[p];
            }

            for (var m in methods) {
                currentProto[m] = methods[m];
            }
        },

        registerService: function (serviceName, constructor) {
            services[serviceName] = constructor(serviceName);
        },

        serveFunction: function (serviceNames, serviceFunction) {
            serviceFunction(...serviceNames.map(serviceName => services[serviceName]));
        },

        noConflict: function () {
            window.beat = noConflict;
            return beat;
        },

        start: function () {
            if ($) {
                $(startObserve);
            } else {
                document.addEventListener('readystatechange', startObserve);
            }
        }
    };

    window.beat = beat;

    function startObserve () {
        if (document.readyState !== 'interactive') return;
        var observe;
        new MutationObserver(observe = function (mutations, observer, emulated) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'attributes') {
                    var node = mutation.target,
                        attrName = mutation.attributeName,
                        prevVal = mutation.oldValue,
                        newVal = node.getAttribute(attrName);
                    if (typeof node.attributeChangedCallback === 'function' && attrName !== 'bem') node.attributeChangedCallback(attrName, prevVal, newVal);
                } else if (mutation.type === 'childList') {
                    for (var n = 0, nl = mutation.addedNodes.length; n < nl; n++) {
                        var node = mutation.addedNodes[n];
                        observe([{
                            type: 'childList',
                            removedNodes: [],
                            addedNodes: node.childNodes || []
                        }], null, true);
                        if (!node.uid && node.getAttribute && node.getAttribute('module') && protos[node.getAttribute('module').toLowerCase()]) {
                            var proto = protos[node.getAttribute('module').toLowerCase()];
                            for (var p in proto) {
                                node[p] = proto[p];
                            }
                            node.createdCallback();
                        } else if (typeof node.attachedCallback === 'function') {
                            !node.hasAttribute('bem', 'attached') && node.attachedCallback(node);
                        }
                    }
                    for (var n = 0, nl = mutation.removedNodes.length; n < nl; n++) {
                        var node = mutation.removedNodes[n];
                        observe([{
                            type: 'childList',
                            removedNodes: node.childNodes || [],
                            addedNodes: [],
                        }], null, true);
                        if (typeof node.detachedCallback === 'function') {
                            !node.hasAttribute('bem', 'detached') && node.detachedCallback();
                        }
                    }
                }
            });

            if (!emulated) executeCallbacks();
        }).observe(document, {
            attributes: true,
            childList: true,
            characterData: false,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: false
        });

        observe([{
            type: 'childList',
            removedNodes: [],
            addedNodes: [document.documentElement]
        }]);
    };
})();
