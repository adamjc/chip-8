import Chip8 from './chip-8'

const SCALE = 10
let lastTimeDrawn = 0

function loadMemory (file) {
  console.log('loading memory')
  const array = new Uint8Array(file)

  for (let i = 0; i < array.length; i += 1) {
    chip8.memory[0x200 + i] = array[i]
  }

  setInterval(loop, 2) // CHIP-8 runs at 500MHz from what I've read...
}

function loop () {
  chip8.cycle()
  drawCanvas()
}

function drawCanvas () {
  // get currentTime
  const currentTime = Date.now()
  // subtract from last time this was called (lastTimeDrawn)
  // that gives you dT (delta time, the difference)
  const dT = currentTime - lastTimeDrawn
  const fps = (1000 / 60)
  
  // if dT >= 1000 / 60, or however quickly you want to refresh the draw screen
  if (dT >= fps) {
    // draw it
    const canvas = document.getElementById('canvas')
    const context = canvas.getContext('2d')

    for (var x = 0; x < chip8.display.length; x += 1) {
      for (var y = 0; y < chip8.display[0].length; y += 1) {
        const pixel = chip8.display[x][y]
        context.fillStyle = pixel ? '#fff' : '#000'
        context.strokeStyle = '#555'
        context.strokeRect(x * SCALE, y * SCALE, SCALE, SCALE)
        context.fillRect(x * SCALE, y * SCALE, SCALE, SCALE)
      }
    }

    lastTimeDrawn = currentTime
  }
}

function dumpMemory () {
  for (var i = 0; i < chip8.memory.length; i += 1) {
    console.log(chip8.memory[i])
  }
}

function readSingleFile (event) {
  const canvas = document.getElementById('canvas')
  const context = canvas.getContext('2d')
  context.fillRect(0, 0, 640, 320, '#000')

  var filename = event.target.files[0]

  if (!filename) return

  const reader = new FileReader()
  reader.onload = file => loadMemory(file.target.result)  
  reader.readAsArrayBuffer(filename)
}

let keyboard = (function () {
  const keyMap = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "q",
    "5": "w",
    "6": "e",
    "7": "a",
    "8": "s",
    "9": "d",
    "a": "z",
    "0": "x",
    "b": "c",
    "c": "4",
    "d": "r",
    "e": "f",
    "f": "v"
  }

  const keys = {
    "1": false,
    "2": false,
    "3": false,
    "q": false,
    "w": false,
    "e": false,
    "a": false,
    "s": false,
    "d": false,
    "z": false,
    "x": false,
    "c": false,
    "4": false,
    "r": false,
    "f": false,
    "v": false
  }

  function set (keyPress, value) {
    keys[keyPress] = value
  }

  function get (hexKey) {
    debugger
    return keys[keyMap[hexKey.toString(16)]]
  }

  return {
    keyMap,
    set,
    get
  }
})()

let canvas = document.createElement('canvas')
canvas.id = 'canvas'
canvas.width = 64 * SCALE
canvas.height = 32 * SCALE
document.body.appendChild(canvas)

const chip8 = Chip8(keyboard, false)

window.addEventListener('keydown', ({ key }) => {
  keyboard.set(key, true)
})

window.addEventListener('keyup', ({ key }) => {
  keyboard.set(key, false)
})

document.getElementById('file-input').addEventListener('change', readSingleFile, false)