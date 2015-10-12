# beat.js
*This library is experimental. Don't use this code in the production!*

beat.js uses attributes instead modifiers and provides easy API to register services and new custom elements (blocks and elements in BEM terminology). Templates and shadow DOM are used to encapsulate the internal structure of entities.

## Terminology
### Block
Let's call custom elements, which have its own prototype, as blocks. The example of block's registration is below:
```javascript
beat.registerElement('w-app', {
    _onSetAttribute: {
        'bem': {
            'created': function (attrName, newVal, prevVal) {
                console.log('Hello from constructor!');
            }
        }
    }
});
```
Each block has own uid - unique identifier.

### Element
Let's call custom elements, which have no own prototype, as elements. The example of element's registration is below:
```javascript
beat.registerElement('w-app__border');
```
Note that `element.tagName` always contains `__`. Elements also have uid, which is the same as block's uid. Element without block is possible, but abnormally.

### Modifier / Attribute
Let's call attributes of custom elements as modifiers. When you use beat.js, attributes and modifiers are the same. Absolutely.

You don't need to register modifiers, just write styles for them. When modifiers are changed, some of block's functions are called (read below about `_beforeSetAttribute`, `_onSetAttribute`, `_beforeElemSetAttribute`, `_onElemSetAttribute`).

### Node
Let's call any DOM-elements as nodes. Of course, blocks and elements are nodes too.

## Beat API
### beat.noConflict()
Changes the value of `window.beat` back to its original value, returning a reference to the `beat` object.

### beat.getTemplateFor(tagName)
This method should return template-node, which will be used to create shadow DOM for new instances of `tagName`. By default it is looking for link-nodes, having attributes `id` equal to `tagName` and `rel` equal to `import`.

If you want to overwrite this method, make it before first call of `beat.registerElement`.

### beat.registerElement(tagName, methods)
This method stores template and prototype for `tagName`.
+ For `tagName`, containing `__`, beat creates the prototype of element.
+ Otherwise, beat creates the prototype of block, extended by `methods`.

### beat.registerService(serviceName, constructor)
This method stores immediately constructed service. Constructor gets only one argument - the name of the service `serviceName`. Register services before you can use ones first time.

### beat.serveFunction(serviceNames, function)
This method makes services available in function's body. It calls the `function`, passing services as arguments. `serviceNames` should be an array of strings. Example given:
```javascript
beat.registerService('log', serviceName => {
    return function () {
        console.log.apply(console, arguments);
    };
});

beat.serveFunction(['log'], function (log) {
    log(12345);
});
```

## jQuery / zepto API
### $.fn.call(methodName, arg1, arg2, ...)
For each element in this collection calls `methodName` with arguments. Context is an element itself.
```javascript
$('b-block').call('setAttribute', 'color', 'blue');
```
### $.fn.apply(methodName, args)
For each element in this collection calls `methodName` with arguments from an array `args`. Context is an element itself.

## Block's and Element's API
### node.dom
This property contains:
+ `$(this)`, if `$` variable exists;
+ `this`, otherwise.

### node.shadow
This property contains:
+ `$(this.shadowRoot)`, if `$` variable exists;
+ `this.shadowRoot`, otherwise.

### node.getAttribute(attrName)
Returns a current value of an attribute `attrName`. If one doesn't exist, returns `null`. Remember, that the current value could be empty string.

### node.getAttributes()
Returns an object, containing a map of all existing attributes.

### node.hasAttribute(attrName, attrVal)
Checks, has an attribute `attrName` a value `attrVal` or not. If `attrVal` is not specified, any value except `null` returns `true`.
```javascript
this.setAttribute('color', 'red');
this.hasAttribute('color');         // true
this.hasAttribute('color', 'red');  // true
this.hasAttribute('color', 'blue'); // false
this.hasAttribute('size');          // false
```

### node.setAttribute(attrName, newVal)
Sets a new value `newVal` of an attribute `attrName`. If `null` is passed instead the value, the attribute will be removed. Note that an empty string is not `null`, but yet another value!

It has no effect while the attribute is locked or one of called `this._beforeSetAttribute` functions returns `false`. If the attribute is changed successfully, corresponding `this._onSetAttribute` handlers will be called. If the current node is the element, method works with the groups of the methods `this._beforeElemSetAttribute` and `this._onElemSetAttribute` (where `this` is the block `element.getBlock()`).

### node.removeAttribute(attrName)
It is the same as `node.setAttribute(attrName, null)`. Removes an attribute `attrName`.

### node.defaultAttribute(attrName, defVal)
If a current node has no attribute `attrName`, sets it to value `defVal`. Checks the presence of the attribute using `node.hasAttribute`.
```javascript
beat.registerElement('p-page', {
    _onSetAttribute: {
        'bem': {
            'created': function (attrName, newVal, prevVal) {
                this.setAttribute('color', 'red');
                this.defaultAttribute('color', 'blue');
                this.defaultAttribute('size', 'big');
                console.log(this.getAttributes());
                /* {
                    bem: 'created',
                    color: 'red',
                    size: 'big'
                } */
            }
        }
    }
});
```

### node.toggleAttribute(attrName, attrVals)
Makes a carousel of an attribute `attrName`, values are got from an array `attrVals`.
```javascript
var colors = ['red', 'green', 'blue'];
this.setAttribute('color', 'magic');
this.toggleAttribute('color', colors); // red
this.toggleAttribute('color', colors); // green
this.toggleAttribute('color', colors); // blue
this.toggleAttribute('color', colors); // red
```

### node.hasLock(attrName)
Checks, is an attribute `attrName` locked or not. Returns boolean.

### node.setLock(attrName, isLocked)
Set boolean lock-mode for an attribute `attrName`. When the attribute is locked, it can't be changed. Note, that attribute `uid` is locked all the time.
```javascript
function changeColor (color) {
    if (block.hasLock('color')) {
        alert('At this moment color couldn\'t be changed!');
    } else {
        block.setAttribute('color', color);
    }
};
this.setLock('color', true);
changeColor('red');
```

## Block's only API
### block._beforeSetAttribute
These functions are called every time, when somebody tries to change attribute's value. If at least one of the functions returns `false`, attribute won't be changed.

### block._onSetAttribute
These handlers are called, when an attribute of a block is already changed.

### block._beforeElemSetAttribute
These methods are the same as `block._beforeSetAttribute`, but its relate to elements of the block.

### block._onElemSetAttribute
These methods are the same as `block._onSetAttribute`, but its relate to elements of the block.

### Usage example for _*SetAttribute
```javascript
beat.registerElement('s-player', {
  _beforeSetAttribute: {
    'speed': {
      '*': function () {
        return this.hasAttribute('admin');
      }
    }
  },
  _onSetAttribute: {
    'speed': {
      '*': function (attrName, newVal, prevVal) {
        this._speed = +newVal || 1;
        console.log('Speed is equal ' + this._speed);
      }
    }
  },
  _beforeElemSetAttribute: {
    '*': {
      '*': {
        '*': function (elemNode, attrName, newVal, prevVal) {
          console.log(elemNode.tagName, attrName, newVal, prevVal);
        }
      }
    },
    'video': {
      'size': {
        '*': function () {
          return false;
        }
      }
    }
  },
  _onElemSetAttribute: {
    'video': {
      'bem': {
        'attached': function () {
          console.log('Video is attached to DOM tree!');
        }
      }
    }
  }
});

/* ... */

let player = $('s-player').get(0);
player.setAttribute('speed', 2);   // nothing happens
player.setAttribute('admin', '');
player.setAttribute('speed', 3);   // now player's speed is equal 3
player
  .getElem('video')
  .setAttribute('size', 'big');    // nothing happens
/*  Console:
    [object HTMLVideoElement], 'bem', 'created', null
    [object HTMLVideoElement], 'bem', 'attached', 'created'
    Speed is equal 3
    [object HTMLVideoElement], 'size', 'big', null  */
```

### block.getElem(elemName)
Returns first matched element, having name `elemName`:
+ If `$` variable exists, returns jQuery collection (could be empty).
+ Otherwise returns node, which have found by `document.querySelector` (could be null).

Note that elements are searched for inside native DOM only (without shadow DOM).

### block.getElems(elemName)
It is the same as `block.getElem`, but all found elements will be returned.

## Element's only API
### elem.getBlock()
Block of element is a closest parent block, which name is the same as element's name before `__`. Method returns it (block). Of course, element's block could be changed by DOM transformation.

### elem.updateBlock()
If you want to update block of a current element by force, call this method. Most likely nothing would be changed. Also it is called always after create, attach and detach element.
