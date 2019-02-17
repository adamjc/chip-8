import chip8 from './chip-8'

let interval
let loopCount = 0

function loadMemory (file) {
  console.log('loading memory')
  const array = new Uint8Array(file)

  for (let i = 0; i < array.length; i += 1) {
    chip8.memory[0x200 + i] = array[i]
  }

  interval = setInterval(loop, 1000 / 500) // CHIP-8 runs at 500MHz from what I've read...
}

function loop () {
  if (loopCount > 50) {
    console.log('clearing interval...')
    clearInterval(interval)
  }

  chip8.cycle()
  drawCanvas()
  loopCount += 1
}

let lastTimeDrawn = 0
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
        context.strokeRect(x * 10, y * 10, 10, 10)
        context.fillRect(x * 10, y * 10, 10, 10)
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

document.getElementById('file-input').addEventListener('change', readSingleFile, false)