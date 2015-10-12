/*
    beat.js JavaScript Library v0.0.1
    https://github.com/Enet/beat

    Released under the GNU GPLv3 license
    https://github.com/Enet/beat/blob/master/LICENSE

    Date: 2015-10-12T21:17Z
*/
'prevent prettydiff';
'use strict';
(function () {
    let $ = window.$,
        noConflict = window.beat,
        protos = {},
        templates = {},
        services = {},
        callbacks = [],
        beat,
        uid = 0,
        antiGarbageCollector = new WeakSet(),
        htmlElemProto = HTMLElement.prototype,
        customElemProto = Object.create(htmlElemProto),
        bemElemProto = Object.create(customElemProto),
        bemBlockProto = Object.create(customElemProto);

    window.setImmediate = window.setImmediate || function (callback) {
        window.addEventListener('message', function listener () {
            window.removeEventListener('message', listener);
            callback();
        });
        window.postMessage(null, '*');
    };

    if ($ && $.fn) {
        $.fn.apply = function (method, args) {
            for (let e = 0, el = this.length; e < el; e++) {
                let elem = this[e];
                if (elem && typeof elem[method] === 'function') elem[method].apply(elem, args);
            }
            return this;
        };

        $.fn.call = function (method) {
            return this.apply(method, [].slice.call(arguments, 1));
        };
    }

    function isPrevented (elem, attrName, newVal, callbackObjects) {
        if (this.hasLock(attrName)) return true;

        let prevVal = this.getAttribute(attrName),
            prevented = false,
            args = elem ? [elem, attrName, newVal, prevVal] : [attrName, newVal, prevVal];

        callbackObjects.forEach(callbackObject => {
            if (!callbackObject) return;
            for (let n of ['*', attrName]) {
                if (!callbackObject[n]) continue;
                for (let v of ['*', newVal]) {
                    let callback = callbackObject[n][v];
                    if (typeof callback === 'function' && callback.apply(this, args) === false) {
                        prevented = true;
                    }
                }
            }
        });

        return prevented;
    };

    function executeCallbacks () {
        setImmediate(() => {
            if (document.readyState === 'complete' && callbacks.length) {
                callbacks.forEach(callback => callback());
                callbacks = [];
            }
        });
    };

    Object.assign(customElemProto, {
        createdCallback: function () {
            Object.defineProperties(this, {
                isBlock: {value: false, configurable: true},
                isElem: {value: false, configurable: true},
                attributeLocks: {value: {uid: true}}
            });

            this.createShadowRoot().appendChild(document.importNode(templates[this.tagName.toLowerCase()].content, true));

            if ($) {
                this.dom = $(this);
                this.shadow = $(this.shadowRoot);
            } else {
                this.dom = this;
                this.shadow = this.shadowRoot;
            }

            antiGarbageCollector.add(this);
            htmlElemProto.setAttribute.call(this, 'bem', 'created');
        },

        attributeChangedCallback: function (elem, attrName, prevVal, newVal, callbackObject) {
            if (attrName === 'uid') return;
            let args = elem ? [elem, attrName, newVal, prevVal] : [attrName, newVal, prevVal];
            for (let n of ['*', attrName]) {
                if (!callbackObject[n]) continue;
                for (let v of ['*', newVal]) {
                    if (typeof callbackObject[n][v] === 'function') {
                        callbackObject[n][v].apply(this, args);
                    }
                }
            }
        },

        attachedCallback: function () {
            this.setAttribute('bem', 'attached');
        },

        detachedCallback: function () {
            this.setAttribute('bem', 'detached');
        },

        initAttributes: function (elem, callbackObjects) {
            let bemVal = this.getAttribute('bem');
            callbacks.push(() => {
                this.attributeChangedCallback('bem', null, bemVal);
                for (let a = 0, al = this.attributes.length; a < al; a++) {
                    let attribute = this.attributes[a];
                    if (attribute.name === 'bem') continue;
                    if (isPrevented.call(this, elem, attribute.name, attribute.value, callbackObjects)) continue;
                    this.attributeChangedCallback(attribute.name, null, attribute.value);
                }
            });
            executeCallbacks();
            delete this.initAttributes;
        },

        setLock: function (attrName, lockVal) {
            if (attrName !== 'uid') this.attributeLocks[attrName] = !!lockVal;
        },

        hasLock: function (attrName) {
            return !!this.attributeLocks[attrName];
        },

        getAttribute: function (attrName) {
            return htmlElemProto.getAttribute.call(this, attrName);
        },

        getAttributes: function () {
            let attributes = {};
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
            let index = (attrVals.indexOf(this.getAttribute(attrName)) + 1) % attrVals.length;
            this.setAttribute(attrName, attrVals[index] || null);
        }
    });

    Object.assign(bemElemProto, {
        createdCallback: function () {
            customElemProto.createdCallback.call(this);
            let splittedTagName = this.tagName.toLowerCase().split('__');
            Object.defineProperties(this, {
                isElem: {value: true},
                elemName: {value: splittedTagName[1] || ''},
                blockName: {value: splittedTagName[0]}
            });
            this.updateBlock();
            if (this.block) {
                this.initAttributes(this, [
                    this.block._beforeElemSetAttribute['*'],
                    this.block._beforeElemSetAttribute[this.elemName]
                ]);
            }
        },

        attributeChangedCallback: function (attrName, prevVal, newVal) {
            if (this.block) {
                for (let e of ['*', this.elemName]) {
                    let callbackObject = this.block._onElemSetAttribute[e];
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
            let block = this.closest(this.blockName),
                uid = (block && block.uid) || 0;
            Object.defineProperties(this, {
                block: {value: block, configurable: true},
                uid: {value: htmlElemProto.setAttribute.call(this, 'uid', uid) || uid, configurable: true}
            });
        },

        getBlock: function () {
            return this.block;
        }
    });

    Object.assign(bemBlockProto, {
        createdCallback: function () {
            Object.defineProperty(this, 'uid', {
                value: htmlElemProto.setAttribute.call(this, 'uid', ++uid) || uid,
                configurable: true
            });
            this._beforeSetAttribute = this._beforeSetAttribute || {};
            this._onSetAttribute = this._onSetAttribute || {};
            this._beforeElemSetAttribute = this._beforeElemSetAttribute || {};
            this._onElemSetAttribute = this._onElemSetAttribute || {};
            customElemProto.createdCallback.call(this);
            this.initAttributes(null, [this._beforeSetAttribute]);
            Object.defineProperty(this, 'isBlock', {value: true});
        },

        attributeChangedCallback: function (attrName, prevVal, newVal) {
            customElemProto.attributeChangedCallback.call(this, null, attrName, prevVal, newVal, this._onSetAttribute);
        },

        setAttribute: function (attrName, newVal) {
            customElemProto.setAttribute.call(this, null, attrName, newVal, [this._beforeSetAttribute]);
        },

        getElem: function (elemName) {
            let elem = this.querySelector(`${this.tagName}__${elemName.trim()}[uid="${this.uid}"]`);
            return $ ? $(elem) : elem;
        },

        getElems: function (elemName) {
            let elems = this.querySelectorAll(`${this.tagName}__${elemName.trim()}[uid="${this.uid}"]`);
            return $ ? $(Array.from(elems)) : elems;
        }
    });

    beat = {
        getTemplateFor: function (tagName) {
            let link = document.getElementById(tagName);
            return (link && link.import) ? link.import.querySelector('template') : null;
        },

        registerElement: function (tagName, methods) {
            tagName = tagName.toLowerCase();
            if (protos[tagName]) return;

            let isElem = ~tagName.indexOf('__'),
                currentProto = protos[tagName] = Object.assign(Object.create(isElem ? bemElemProto : bemBlockProto), methods);

            let template = beat.getTemplateFor(tagName);
            if (!template || !template.content) {
                template = document.createElement('template');
                template.appendChild(document.createElement('div'));
            }

            templates[tagName] = template;
            document.registerElement(tagName, {
                prototype: currentProto
            });
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
        }
    };

    window.beat = beat;
    document.addEventListener('readystatechange', executeCallbacks);
})();
