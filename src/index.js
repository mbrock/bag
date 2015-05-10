bag = {
  queue: [],
  things: null
}

bag.load = function (files) {
  this.queue = this.queue.concat(files)
  bag.work()
}

bag.work = function () {
  if (this.queue.length) {
    var f = new FileReader
    f.onload = function () {
      bag.save(f.result).then(function () { bag.work() })
    }
    f.readAsDataURL(this.queue[0])
    this.queue = this.queue.splice(1)
  }
}

bag.save = function (x) {
  return db.post({
    _attachments: {
      'image.jpg': {
        content_type: 'image/jpeg',
        data: x.replace(/^data:[^,]*,/, '')
      }
    }
  })
}

db = new PouchDB('bag')

onload = function () {
  db.allDocs({ include_docs: true, attachments: true }).then(function (x) {
    change({ things: { $set: x.rows }})
  })

  function render () {
    React.render(tag(Root, bag), document.body)
  }

  change = function (change) {
    bag = React.addons.update(bag, change)
    render()
  }
}

Root = React.createClass({
  displayName: 'bag',

  getInitialState: function () {
    return { }
  },

  things: function () {
    return this.props.things.slice(0).sort(function (x, y) {
      var xn = x.doc.name.toLowerCase()
      var yn = y.doc.name.toLowerCase()
      if (xn < yn) return -1
      else if (xn > yn) return 1
      else return 0
    })
  },

  render: function () {
    return tag(Dropzone, {
      onDrop: function (x) {
        bag.load(x)
      }
    }, this.things().map(function (x) {
      return tag('.thing', {}, [
        tag('img', {
          src: 'data:image/jpeg;base64,' + x.doc._attachments['image.jpg'].data
        }),
        tag('input', {
          defaultValue: x.doc.name,
          onBlur: function (e) {
            db.put(update(x.doc, { $merge: { name: e.target.value }}))
          }
        })
      ])
    }))
  }
})

Dropzone = React.createClass({
  getInitialState: function() {
    return { active: false }
  },

  onDragLeave: function(e) {
    this.setState({ active: false })
  },

  onDragOver: function(e) {
    e.preventDefault()
    this.setState({ active: true })
  },

  onDrop: function(e) {
    e.preventDefault()
    this.setState({ active: false });

    var files = e.dataTransfer ? e.dataTransfer.files : e.target.files

    for (var i = 0; i < files.length; i++)
      files[i].preview = URL.createObjectURL(files[i]);

    if (this.props.onDrop)
      this.props.onDrop(Array.prototype.slice.call(files))
  },

  render: function() {
    return tag('.dropzone', {
      className: this.state.active ? 'active' : '',
      onClick: this.onClick,
      onDragLeave: this.onDragLeave,
      onDragOver: this.onDragOver,
      onDrop: this.onDrop,
    }, this.props.children)
  }
})

//name: Hermite resize
//about: Fast image resize/resample using Hermite filter with JavaScript.
//author: ViliusL
//demo: http://viliusle.github.io/miniPaint/
function resample (canvas, W, H, W2, H2) {
  W2 = Math.round(W2);
  H2 = Math.round(H2);
  var img = canvas.getContext("2d").getImageData(0, 0, W, H);
  var img2 = canvas.getContext("2d").getImageData(0, 0, W2, H2);
  var data = img.data;
  var data2 = img2.data;
  var ratio_w = W / W2;
  var ratio_h = H / H2;
  var ratio_w_half = Math.ceil(ratio_w/2);
  var ratio_h_half = Math.ceil(ratio_h/2);
  
  for(var j = 0; j < H2; j++){
    for(var i = 0; i < W2; i++){
      var x2 = (i + j*W2) * 4;
      var weight = 0;
      var weights = 0;
      var weights_alpha = 0;
      var gx_r = gx_g = gx_b = gx_a = 0;
      var center_y = (j + 0.5) * ratio_h;
      for(var yy = Math.floor(j * ratio_h); yy < (j + 1) * ratio_h; yy++){
        var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
        var center_x = (i + 0.5) * ratio_w;
        var w0 = dy*dy //pre-calc part of w
        for(var xx = Math.floor(i * ratio_w); xx < (i + 1) * ratio_w; xx++){
          var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
          var w = Math.sqrt(w0 + dx*dx);
          if(w >= -1 && w <= 1){
            //hermite filter
            weight = 2 * w*w*w - 3*w*w + 1;
            if(weight > 0){
              dx = 4*(xx + yy*W);
              //alpha
              gx_a += weight * data[dx + 3];
              weights_alpha += weight;
              //colors
              if(data[dx + 3] < 255)
                weight = weight * data[dx + 3] / 250;
              gx_r += weight * data[dx];
              gx_g += weight * data[dx + 1];
              gx_b += weight * data[dx + 2];
              weights += weight;
            }
          }
        }
      }
      data2[x2]     = gx_r / weights;
      data2[x2 + 1] = gx_g / weights;
      data2[x2 + 2] = gx_b / weights;
      data2[x2 + 3] = gx_a / weights_alpha;
    }
  }
  canvas.getContext("2d").clearRect(0, 0, Math.max(W, W2), Math.max(H, H2));
  canvas.width = W2;
  canvas.height = H2;
  canvas.getContext("2d").putImageData(img2, 0, 0);
}

update = React.addons.update

// Create and return a new ReactElement of the given type.  The type
// argument can be either an HTML tag name or a component class.
function tag(type, props, children) {
  if (type === void 0) {
    throw new Error('Undefined first argument to tag()')
  } else if (props instanceof Array) {
    throw new Error('Second argument to tag() must be an object')
  } else if (children && !(children instanceof Array)) {
    throw new Error('Third argument to tag() must be an array')
  } else if (typeof type != 'string') {
    return React.createElement.apply(
      React, [type, props].concat(children || [])
    )
  } else if (
    // XXX: phew, what are we doing here...
    /^([a-z0-9]+)?(?:#([a-z0-9-]+))?((?:\.[a-z0-9-]+)*)$/.test(type)
  ) {
    var tagName = RegExp.$1 || 'div'
    var id = RegExp.$2 || void 0
    var classNames = RegExp.$3 ? RegExp.$3.slice(1).split('.') : []
    return React.createElement.apply(React, [tagName, update(props || {}, {
      id: { $apply: function(x) { return x || id } },
      className: {
        $apply: function(x) {
          return (x ? x.split(' ') : []).concat(classNames).join(' ')
        }
      }
    })].concat(children || []))
  } else {
    throw new Error('Bad first argument to tag(): ' + JSON.stringify(type))
  }
}
