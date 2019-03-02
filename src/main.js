import Chip8 from './chip-8'
import keyboard from './keyboard'
import gameEngine from './game-engine'

let game

function loadMemory (file) {
  const array = new Uint8Array(file)

  chip8.setMemory(array, 0x200)

  game = gameEngine(chip8, 'game')
}

window.addEventListener('keydown', ({ key }) => {
  if (Object.values(keyboard.keyMap).includes(key)) {
    keyboard.set(key, true)
  }
})

document.querySelectorAll('.game-controls__button').forEach(el => el.addEventListener('mousedown', event => {
  const key = event.target.innerHTML
  if (Object.values(keyboard.keyMap).includes(key)) {
    keyboard.set(key, true)
  }
}))

window.addEventListener('keyup', ({ key }) => {
  keyboard.set(key, false)
})

document.querySelectorAll('.game-controls__button').forEach(el => el.addEventListener('mouseup', event => {
  const key = event.target.innerHTML
  keyboard.set(key, false)
}))

const sound = new Audio('./sound.wav')

const chip8 = Chip8(keyboard, sound)

function reset () {
  if (game) {
    game.canvas.remove()
    game.scene.stop()
    game.destroy()
  }

  chip8.reset()
}

document.getElementById('reset').addEventListener('click', _ => reset())

function getGame (game) {
  fetch(`./games/${game}`)
    .then(response => response.blob())
    .then(body => {
      const reader = new FileReader()
      reader.addEventListener("loadend", _ => loadMemory(reader.result))
      reader.readAsArrayBuffer(body)
    })
}

document.getElementById('game-picker').addEventListener('change', event => {
  reset()
  getGame(event.target.value)
}, false)
