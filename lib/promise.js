;(function _(global, factory) {
  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory()
  } else if (typeof define === 'function' && define.cmd) {
    define([], factory())
  } else if (typeof exports === 'object') {
    exports['Promise'] = factory()
  } else {
    global['Promise'] = factory()
  }
})(this, function() {
  var class2type = {}
  var toString = class2type.toString
  var names = 'Boolean Number String Function Array Date RegExp Object Error'.split(
    ' '
  )

  for (var i = 0, len = names.length; i < len; i++) {
    var name = names[i]

    class2type['[object ' + name + ']'] = name.toLowerCase()
  }

  function type(obj) {
    return obj == null
      ? String(obj)
      : class2type[toString.call(obj)] || 'object'
  }

  function isObject(value) {
    return type(value) === 'object'
  }

  function isFunction(value) {
    return type(value) == 'function'
  }

  function isArray(value) {
    return type(value) == 'array'
  }

  var PENDING = 'pending'
  var RESOLVED = 'resolved'
  var REJECTED = 'rejected'
  var UNDEFINED = void 0

  function genThen(obj) {
    var then = obj && obj.then
    if (obj && isObject(obj) && isFunction(then)) {
      return function() {
        then.apply(obj, arguments)
      }
    }
  }

  function executeCallback(type, val) {
    var isResolve = type === 'resolve'
    var thenable

    if (isResolve && (isObject(val) || isFunction(val))) {
      try {
        thenable = genThen(val)
      } catch (error) {
        return executeCallback.call(this, 'reject', val)
      }
    }

    if (isResolve && thenable) {
      executeResolver.call(this, thenable)
    } else {
      this.state = isResolve ? RESOLVED : REJECTED
      this.data = val
      this.callbackQueue.forEach(function(queue) {
        queue[type](val)
      })
    }

    return this
  }

  function executeResolver(fn) {
    var called = false
    var that = this

    function onFullfiled(val) {
      if (called) return

      called = true
      executeCallback.call(that, 'resolve', val)
    }

    function onRejected(val) {
      if (called) return

      called = true
      executeCallback.call(that, 'reject', val)
    }

    try {
      fn(onFullfiled, onRejected)
    } catch (e) {
      onRejected(e)
    }
  }

  function executeCallbackAsync(callback, val) {
    var that = this

    setTimeout(function() {
      var res

      try {
        res = callback(val)
      } catch (e) {
        return executeCallback.call(that, 'reject', e)
      }

      if (res !== that) {
        return executeCallback.call(that, 'resolve', res)
      } else {
        return executeCallback.call(
          that,
          'reject',
          new TypeError('Cannot resolve promise with itself')
        )
      }
    }, 0)
  }

  function CallbackItem(promise, onResolved, onRejected) {
    this.promise = promise

    this.onResolved = isFunction(onResolved)
      ? onResolved
      : function(v) {
          return v
        }

    this.onRejected = isFunction(onRejected)
      ? onRejected
      : function(v) {
          throw v
        }
  }

  CallbackItem.prototype.constructor = CallbackItem

  CallbackItem.prototype.resolve = function(val) {
    executeCallbackAsync.call(this.promise, this.onResolved, val)
  }

  CallbackItem.prototype.reject = function(val) {
    executeCallbackAsync.call(this.promise, this.onRejected, val)
  }

  function Promise(fn) {
    if (fn && !isFunction(fn))
      throw new TypeError('Promise resolve is Function')

    this.state = PENDING
    this.data = null
    this.callbackQueue = []

    if (fn) {
      executeResolver.call(this, fn)
    }
  }

  Promise.prototype.constructor = Promise

  Promise.prototype.then = function(onResolved, onRejected) {
    if (
      (!isFunction(onResolved) && this.state === RESOLVED) ||
      (!isFunction(onRejected) && this.state === REJECTED)
    )
      return this

    var promise = new this.constructor()

    if (this.state !== PENDING) {
      var callback = this.state === RESOLVED ? onResolved : onRejected
      executeCallbackAsync.call(promise, callback, this.data)
    } else {
      this.callbackQueue.push(new CallbackItem(promise, onResolved, onRejected))
    }

    return promise
  }

  Promise.prototype.catch = function(onRejected) {
    return this.then(null, onRejected)
  }

  Promise.prototype.finally = function(callback) {
    var that = this
    var _ = this.constructor

    return that.then(
      function(val) {
        _.resolve(callback(val)).then(function() {
          return val
        })
      },
      function(err) {
        _.resolve(callback(err)).then(function() {
          throw err
        })
      }
    )
  }

  Promise.resolve = function(val) {
    if (val instanceof this) return val
    return executeCallback.call(new this(), 'resolve', val)
  }

  Promise.reject = function(err) {
    if (err instanceof this) return err
    return executeCallback.call(new this(), 'reject', err)
  }

  Promise.all = function(iterable) {
    var that = this

    return new that(function(resolve, reject) {
      if (!iterable || type(iterable))
        return reject(new TypeError('iterable must be an array'))

      var len = iterable.length
      if (!len) return resolve([])

      var res = Array(len)
      var counter = 0
      var called = false

      iterable.forEach(function(iterator, i) {
        ;(function(i) {
          that.resolve(iterator).then(
            function(val) {
              res[i] = val
              if (++counter === len && !called) {
                called = true

                return resolve(res)
              }
            },
            function(err) {
              if (!called) {
                called = true
                return reject(err)
              }
            }
          )
        })(i)
      })
    })
  }

  Promise.race = function(iterable) {
    var that = this

    return new this(function(resolve, reject) {
      if (!iterable || !isArray(iterable))
        return reject(new TypeError('iterable must be an array'))

      var len = iterable.length
      if (!len) resolve([])

      var called = false
      iterable.forEach(function(iterator, i) {
        that.resolve(iterator).then(
          function(res) {
            if (!called) {
              called = true
              return resolve(res)
            }
          },
          function(err) {
            if (!called) {
              called = false
              return reject(err)
            }
          }
        )
      })
    })
  }

  return Promise
})
