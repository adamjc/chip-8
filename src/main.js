import Chip8 from './chip-8'

const SCALE = 10

let game
function loadMemory (file) {
  console.log('loading memory')
  const array = new Uint8Array(file)

  chip8.setMemory(array, 0x200)

  game = new Phaser.Game(config)
}

let keyboard = (function () {
  const keyMap = {
    '1': '1',
    '2': '2',
    '3': '3',
    '4': 'q',
    '5': 'w',
    '6': 'e',
    '7': 'a',
    '8': 's',
    '9': 'd',
    'a': 'z',
    '0': 'x',
    'b': 'c',
    'c': '4',
    'd': 'r',
    'e': 'f',
    'f': 'v'
  }

  const keys = {
    '1': false,
    '2': false,
    '3': false,
    'q': false,
    'w': false,
    'e': false,
    'a': false,
    's': false,
    'd': false,
    'z': false,
    'x': false,
    'c': false,
    '4': false,
    'r': false,
    'f': false,
    'v': false
  }

  function set (keyPress, value) {
    keys[keyPress] = value
  }

  function get (hexKey) {
    return keys[keyMap[hexKey.toString(16)]]
  }

  function getAny () {
    return Object.values(keys).reduce((key, current, index) => {
      const vmKey = Object.keys(keyMap)[index]
      if (key) {
        return key
      } else if (current) {
        return vmKey
      }
    }, null)
  }

  return {
    keyMap,
    set,
    get,
    getAny
  }
})()

const sound = new Audio('./sound.wav')
const chip8 = Chip8(keyboard, sound)

window.addEventListener('keydown', ({ key }) => {
  if (Object.values(keyboard.keyMap).includes(key)) {
    keyboard.set(key, true)
  }
})

window.addEventListener('keyup', ({ key }) => {
  keyboard.set(key, false)
})

function reset () {
  if (game) {
    game.canvas.remove()
    game.scene.stop()
    game.destroy()
  }

  chip8.reset()
}

document.getElementById('reset').addEventListener('click', _ => reset())

document.getElementById('game-picker').addEventListener('change', event => {
  reset()
  getGame(event.target.value)
}, false)

document.querySelectorAll('.game-controls__button').forEach(el => el.addEventListener('mousedown', event => {
  const key = event.target.innerHTML
  if (Object.values(keyboard.keyMap).includes(key)) {
    keyboard.set(key, true)
  }
}))

document.querySelectorAll('.game-controls__button').forEach(el => el.addEventListener('mouseup', event => {
  const key = event.target.innerHTML
  keyboard.set(key, false)
}))

function getGame (game) {
  fetch(`./games/${game}`)
    .then(response => response.blob())
    .then(body => {
      const reader = new FileReader()
      reader.addEventListener("loadend", _ => loadMemory(reader.result))
      reader.readAsArrayBuffer(body)
    })
}

const Scene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function Scene () {
    Phaser.Scene.call(this, { key: 'example' })
  },
  preload: preload,
  create: create,
  applyPipeline: applyPipeline,
  update: update
})

const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 320,
  parent: 'game',
  scene: [ Scene ]
}

function preload () {
}

let graphics
const DISPLAY_WIDTH = 64
const DISPLAY_HEIGHT = 32
let phaserDisplay = new Array(DISPLAY_WIDTH).fill().map(_ => new Array(DISPLAY_HEIGHT).fill(0))

for (let x = 0; x < phaserDisplay.length; x += 1) {
  for (let y = 0; y < phaserDisplay[x].length; y += 1) {
    phaserDisplay[x][y] = new Phaser.Geom.Rectangle(x * SCALE, y * SCALE, SCALE, SCALE)
  }
}

function create () {
  graphics = this.add.graphics({ fillStyle: { color: 0xffffff }})
  this.pipeline = this.game.renderer.addPipeline('Pipeline', new Pipeline(this.game))
  this.applyPipeline()
}

function update (_, delta) {
  const cpuSpeed = 1000 / 500 // 500Mhz
  // cycle the CPU "many" times, depending on how long the draw loop took
  const cycles = Math.floor(delta / cpuSpeed)
  for (var i = 0; i < cycles; i += 1) {
    chip8.cycle()
  }

  if (chip8.getDrawFlag()) {
    graphics.clear()  
    const display = chip8.getDisplay()
    for (var x = 0; x < display.length; x += 1) {
      for (var y = 0; y < display[0].length; y += 1) {
        const pixel = display[x][y]
        graphics.fillStyle(pixel ? 0xffffff : 0x0)
        const rect = phaserDisplay[x][y]
        graphics.fillRectShape(rect)
      }
    }
    chip8.drawFlag = false
  }
}

function applyPipeline () {
  this.cameras.main.setRenderToTexture(this.pipeline)
}

const shader = `
  precision mediump float;

  uniform float time;
  uniform vec2 resolution;
  uniform sampler2D uMainSampler;

  varying vec2 outTexCoord;

  vec2 crt (vec2 coord) {
    // lower == more curved
    float straightness = 2.1;

    // put in symmetrical coords
    coord = coord - 0.5;

    // shrink
    coord *= 1.1;	

    // deform coords
    coord.x *= 1.0 + pow(coord.y / (straightness + 0.5), 2.0);
    coord.y *= 1.0 + pow(coord.x / straightness, 2.0);

    // transform back to 0.0 - 1.0 space
    coord  = coord + 0.5;

    return coord;
  }

  void main () {
    vec2 crtCoords = crt(outTexCoord);

    if (crtCoords.x < 0.0 || crtCoords.x > 1.0 || crtCoords.y < 0.0 || crtCoords.y > 1.0) {
      gl_FragColor.rgb = vec3(0.85, 0.85, 0.65);
      return;
    }

    gl_FragColor = texture2D(uMainSampler, crtCoords);
  }
`

const Pipeline = new Phaser.Class({
  Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,
  initialize: function Pipeline (game) {
    Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
      game: game,
      renderer: game.renderer,
      fragShader: shader
    })
  }
})