import Chip8 from './chip-8'

const SCALE = 10

function loadMemory (file) {
  console.log('loading memory')
  const array = new Uint8Array(file)

  chip8.setMemory(array, 0x200)

  chip8.start()
}

const canvas = document.createElement('canvas')
canvas.id = 'canvas'
canvas.width = 64 * SCALE
canvas.height = 32 * SCALE
document.getElementById('game').appendChild(canvas)
const context = canvas.getContext('2d')

function render () {
  const display = chip8.getDisplay()

  for (var x = 0; x < display.length; x += 1) {
    for (var y = 0; y < display[0].length; y += 1) {
      const pixel = display[x][y]
      context.fillStyle = pixel ? '#fff' : '#000'
      context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)
    }
  }
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
const chip8 = Chip8(keyboard, render, sound)

window.addEventListener('keydown', ({ key }) => {
  if (Object.values(keyboard.keyMap).includes(key)) {
    keyboard.set(key, true)
  }
})

window.addEventListener('keyup', ({ key }) => {
  keyboard.set(key, false)
})

document.getElementById('reset').addEventListener('click', _ => {
  chip8.reset()
})

document.getElementById('game-picker').addEventListener('change', event => {
  chip8.reset()
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