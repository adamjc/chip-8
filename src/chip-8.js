// Made with a loooot of help from this excellent resource: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM
export default (keyboard, render) => {
  // CHIP-8 Interpreter
  const WORD_SIZE = 8

  // It has 16 8-bit data registers. V[0xF] is the carry register.
  let vRegisters = new Uint8Array(16)

  // It was originally designed to work on 4k computers, so lets give ourselves 4k of memory
  // 0x0 -> 0x1FF is used to store the system font (it was originally used to store the interpreter data, back when it was ran on 4k systems)
  // 0x200 -> 0xFFF is used to store the program data
  let memory = new Uint8Array(4096)

  // Copied from CowGood's font set
  const fonts = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80, // F
  ]

  memory.set(fonts, 0)

  // There are 2 timers, a delay timer and a sound timer, both decrease to 0 at a rate of 60Hz, once at 0 they stay there
  let delayTimer = 0

  // When the sound timer hits 0, a monotone sound is played.
  let soundTimer = 0

  // And of course a (16-bit) program counter, starting at... 0x200 (where the program is loaded in!)
  let pc = 0x200

  // It also has a 16-bit register, usually used for addressing memory
  let iRegister = pc

  // A stack pointer, allows us to have function calls.
  let sp = 0
  // The stack. Documentation says it's 16 deep, but apparently only 10 are ever used? I'll stick with 16 just in case...
  let stack = new Array(16)

  // It utilises a 64x32 pixel display... we will get the chip-8 to write to these values, and in our `emulator` code, 
  // we will write these values to a screen. Simple! (should be!).
  const DISPLAY_WIDTH = 64
  const DISPLAY_HEIGHT = 32
  let display = new Array(DISPLAY_WIDTH).fill().map(_ => new Array(DISPLAY_HEIGHT).fill(0))

  let drawFlag = true

  let animationFrame

  function setMemory (file, start) {
    memory.set(file, start)
  }
  
  function getDisplay () {
    return display
  }

  function start () {
    console.log('Starting...')
    let lastTimeUpdated = Date.now()
    const cpuSpeed = 1000 / 500 // 500Mhz
    animationFrame = window.requestAnimationFrame(function loop () {
      // cycle the CPU "many" times, depending on how long the draw loop took
      const now = Date.now()
      const diff = now - lastTimeUpdated
      const cycles = Math.floor(diff / cpuSpeed)
      for (var i = 0; i < cycles; i += 1) {
        cycle()
      }
      
      if (drawFlag) {
        render()
        drawFlag = false
      }

      lastTimeUpdated = now

      animationFrame = window.requestAnimationFrame(loop)
    })
  }

  function reset () {
    window.cancelAnimationFrame(animationFrame)
    memory = new Uint8Array(4096)
    vRegisters = new Uint8Array(16) 
    memory.set(fonts, 0)
    display = new Array(DISPLAY_WIDTH).fill().map(_ => new Array(DISPLAY_HEIGHT).fill(0))
    pc = 0x200
    stack = new Array(16)
    drawFlag = true
    delayTimer = 0
    soundTimer = 0
    iRegister = pc
  }

  // does a cpu cycle innit.
  let lastTimeDecremented = 0
  function cycle () {
    const currentTime = Date.now()
    const dT = currentTime - lastTimeDecremented
    const timerRefreshRate = 1000 / 60
    if (dT >= timerRefreshRate) {
      // decrement delayTimer at a rate of 60Hz
      if (delayTimer > 0) {
        delayTimer -= 1
      }

      lastTimeDecremented = currentTime
    }

    const inst = fetch()

    // decode & execute (i'm too lazy to have them do separately, feels like a waste? We'll see...)
    decodeAndExecute(inst)
  }

  // fetching from memory takes twoooo cycles, cos it's an 8-bit bus, 
  // but each instruction is 16-bits long. Neat-o. VLIW are lame.
  function fetch() {
    const inst = (memory[pc] << 8) | memory[pc + 1]
    pc += 2

    return inst
  }

  // aight we got a hex value now we need to look up what that means exactly
  function decodeAndExecute(inst) {
    // Many of the instructions follow the structure below, so to make my life simpler, I will calculate these values 
    // from the instruction We are using bitmasking to get these values. If you don't quite get what's happening here, 
    // look up https://en.wikipedia.org/wiki/Mask_(computing)
    const nnn = inst & 0x0FFF // nnn or addr - A 12-bit value, the lowest 12 bits of the instruction
    const n = inst & 0x000F // n or nibble - A 4-bit value, the lowest 4 bits of the instruction  
    const x = (inst & 0x0F00) >> 8 // x - A 4-bit value, the lower 4 bits of the high byte of the instructionction
    const y = (inst & 0x00F0) >> 4// y - A 4-bit value, the upper 4 bits of the low byte of the instru  
    const kk = inst & 0x00FF // kk or byte - An 8-bit value, the lowest 8 bits of the instruction

    // gonna split this into 'macro level opcodes' and 'micro level opcodes', as the instructions can be indexed by the 
    // highest byte first, and then after that we can decide what to do...
    const highByte = inst & 0xF000
    // We... could use a switch statement here, but that would be insane, right? How about a map instead?
    const macroOpcodes = {
      0x0000: clearAndReturnOpcodes,
      0x1000: jump,
      0x2000: callSubroutine,
      0x3000: skipIfVxkk,
      0x4000: skipIfNotVxkk,
      0x5000: skipIfVxVy,
      0x6000: loadVxVal,
      0x7000: addVxVal,
      0x8000: settingFuncs,
      0x9000: skipIfNotVxVy,
      0xA000: loadIAddr,
      0xB000: jumpV0Offset,
      0xC000: setVxRandom,
      0xD000: draw,
      0xE000: skipKey,
      0xF000: registerManipulation
    }

    const macroOpcode = macroOpcodes[highByte] ? macroOpcodes[highByte] : notImplemented  

    macroOpcode({ nnn, n, x, y, kk }) // Yes, very ineffecient right now
  }

  // 0x0000
  function clearAndReturnOpcodes (inst) {
    // is the last bit set? if it is, it's the 'RET' function, otherwise it's the 'CLS' function
    if (inst.nnn & 0x00F) {
      returnFromSub() // 0x00EE
    } else {
      clearScreen() // 0x00E0
    }

    // 00E0 - CLS -> Clear the screen
    function clearScreen () {
      for (var x = 0; x < display.length; x += 1) {
        for (var y = 0; y < display[x].length; y += 1) {
          display[x][y] = 0
        }
      }
    }

    // 00EE - RET
    // The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack 
    // pointer. We're doing it the other way around (subtract, THEN set), because otherwise our 'stack's' (which is an 
    // array) first element is never set (stack[0] will never be used)
    function returnFromSub () {
      sp -= 1
      pc = stack[sp]
    }
  }

  // 1nnn - JP addr -> Sets pc to nnn
  function jump (inst) {
    pc = inst.nnn
  }

  // 2nnn - CALL addr
  // Call subroutine at nnn.
  // The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set 
  // to nnn. We're doing this the other way around (set, then increment), see 00EE for more info.
  function callSubroutine (inst) {
    stack[sp] = pc
    sp += 1
    pc = inst.nnn
  }

  // 3xkk - SE Vx, byte -> The interpreter compares register Vx to kk, and if they are equal, increments pc by 2.
  function skipIfVxkk (inst) {
    if (vRegisters[inst.x] === inst.kk) {
      pc += 2
    }
  }

  // 4xkk - SNE Vx, byte
  // Skip next instruction if Vx != kk.
  // The interpreter compares register Vx to kk, and if they are not equal, increments the program counter by 2.
  function skipIfNotVxkk (inst) {
    if (vRegisters[inst.x] !== inst.kk) {
      pc += 2
    }
  }

  // 5xy0 - SE Vx, Vy
  // Skip next instruction if Vx = Vy.
  // The interpreter compares register Vx to register Vy, and if they are equal, increments the program counter by 2.
  function skipIfVxVy (nnn) {
    debugger
  }

  // 6xkk - LD Vx, byte
  // Set Vx = kk.
  // The interpreter puts the value kk into register Vx.
  function loadVxVal (inst) {
    vRegisters[inst.x] = inst.kk
  }

  // 0x7000
  // Set Vx = Vx + kk.
  // Adds the value kk to the value of register Vx, then stores the result in Vx. 
  function addVxVal (inst) {
    vRegisters[inst.x] = vRegisters[inst.x] + inst.kk
  }

  // 0x8000
  function settingFuncs (inst) {
    const microOpCodes = {
      0x0: loadVxVy,
      0x3: VxXorVy,
      0x2: vXAndVy,
      0x4: vXAddVy,
      0x5: vXSubVy,
      0x7: vYSubVx,
      0xE: shiftLeft
    }

    // 8xy0 - LD Vx, Vy -> Vx = Vy
    function loadVxVy () {
      vRegisters[inst.x] = vRegisters[inst.y]
    }
    
    // 8xy1 - OR Vx, Vy
    // Set Vx = Vx OR Vy.
    // Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx. A bitwise OR compares the 
    // corrseponding bits from two values, and if either bit is 1, then the same bit in the result is also 1. Otherwise, 
    // it is 0.

    // 8xy2 - AND Vx, Vy -> Vx = Vx & Vy
    function vXAndVy () {
      vRegisters[inst.x] = vRegisters[inst.x] & vRegisters[inst.y]
    }
    
    // 8xy3 - XOR Vx, Vy -> Set Vx = Vx XOR Vy.
    function VxXorVy () {
      vRegisters[inst.x] = vRegisters[inst.x] ^ vRegisters[inst.y]
    }
    
    
    // 8xy4 - ADD Vx, Vy -> Vx = Vx + Vy
    // Set Vx = Vx + Vy, set VF = carry.
    // The values of Vx and Vy are added together. If the result is greater than 8 bits (i.e., > 255,) VF is set to 1, 
    // otherwise 0. Only the lowest 8 bits of the result are kept, and stored in Vx.
    function vXAddVy () {
      const result = vRegisters[inst.x] + vRegisters[inst.y]
      
      if (result > 0xFF) {
        vRegisters[0xF] = 1
      } else {
        vRegisters[0xF] = 0
      }

      vRegisters[inst.x] = result & 0xFF
    }
    
    // 8xy5 - SUB Vx, Vy
    // Set Vx = Vx - Vy, set VF = NOT borrow.
    // If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
    function vXSubVy () {
      if (vRegisters[inst.x] > vRegisters[inst.y]) {
        vRegisters[0xF] = 1
      } else {
        vRegisters[0xF] = 0
      }

      vRegisters[inst.x] = (vRegisters[inst.x] - vRegisters[inst.y]) & 0xFF
    }
    
    // 8xy6 - SHR Vx {, Vy}
    // Set Vx = Vx SHR 1.
    // If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.

    // 8xy7 - SUBN Vx, Vy -> Set Vx = Vy - Vx, set VF = NOT borrow.
    function vYSubVx () {
      if (vRegisters[inst.y] > vRegisters[inst.x]) {
        vRegisters[0xF] = 1
      } else {
        vRegisters[0xF] = 0
      }

      vRegisters[inst.x] = vRegisters[inst.y] - vRegisters[inst.x]
    }
    
    // 8xyE - SHL Vx {, Vy} -> V[0xF] = 1 if Vx >= 0x80, else 0. Then Vx = Vx << 1.
    function shiftLeft () {
      if (vRegisters[inst.x] & 0b10000000) {
        vRegisters[0xF] = 1
      } else {
        vRegisters[0xF] = 0
      }

      vRegisters[inst.x] = vRegisters[inst.x] << 1
    }

    if (!microOpCodes[inst.n]) {
      debugger
    }
    
    microOpCodes[inst.n] ()
  }

  // 9xy0 - SNE Vx, Vy
  // Skip next instruction if Vx != Vy.
  // The values of Vx and Vy are compared, and if they are not equal, the program counter is increased by 2.
  function skipIfNotVxVy (inst) {
    if (vRegisters[inst.x] !== vRegisters[inst.y]) {
      pc += 2
    }
  }

  // 0xA000
  // Annn - LD I, addr
  // Set I = nnn.
  // The value of register I is set to nnn.
  function loadIAddr (inst) {
    iRegister = inst.nnn
  }

  // Bnnn - JP V0, addr
  // Jump to location nnn + V0.
  // The program counter is set to nnn plus the value of V0.
  function jumpV0Offset (nnn) {
    debugger
  }

  // Cxkk - RND Vx, byte
  // Set Vx = random byte AND kk.
  // The interpreter generates a random number from 0 to 255, which is then ANDed with the value kk. The results are 
  // stored in Vx. See instruction 8xy2 for more information on AND.
  function setVxRandom (inst) {
    const random = Math.floor(Math.random(1) * 255)
    vRegisters[inst.x] = random & inst.kk
  }

  // Dxyn - DRW Vx, Vy, nibble
  // Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
  // The interpreter reads n bytes from memory, starting at the address stored in I. 
  // These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). 
  // Sprites are XORed onto the existing screen. 
  // If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. 
  // If the sprite is positioned so part of it is outside the coordinates of the display, i t wraps around to the 
  // opposite side of the screen.
  function draw (inst) {
    let x = vRegisters[inst.x]
    let y = vRegisters[inst.y]
    let iAddr = iRegister
    vRegisters[0xF] = 0
    
    for (var i = 0; i < inst.n; i += 1) {
      const newY = (y + i) % DISPLAY_HEIGHT

      const line = memory[iAddr]
      iAddr += 1

      for (var j = 0; j < WORD_SIZE; j += 1) {
        const newX = (x + j) % DISPLAY_WIDTH

        const bitmask = 0b00000001 << (WORD_SIZE - 1 - j)
        const pixel = (line & bitmask) >> (WORD_SIZE - 1 - j)
        
        const currentPixel = display[newX][newY]
        const newPixel = currentPixel ^ pixel

        display[newX][newY] = newPixel

        if (currentPixel > newPixel) {
          vRegisters[0xF] = 1
        }
      }
    }

    drawFlag = true
  }

  // 0xE000
  function skipKey (inst) {
    // Ex9E - SKP Vx -> Skip next instruction if key with the value of Vx is pressed.
    if (inst.kk == 0x9E) {
      const isKeyPressed = keyboard.get(vRegisters[inst.x])
      if (isKeyPressed) {
        pc += 2
      }
      return
    }

    // ExA1 - SKNP Vx
    // Skip next instruction if key with the value of Vx is not pressed.
    // Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is 
    // increased by 2.
    if (inst.kk == 0xA1) {
      const isKeyPressed = keyboard.get(vRegisters[inst.x])
      if (!isKeyPressed) {
        pc += 2
      }
      return
    }

    debugger
  }

  // 0xF000
  function registerManipulation (inst) {
    const microOpCodes = {
      0x07: loadDelayTimer,
      0x0A: waitForKeyPress,
      0x15: setDelayTimer,
      0x18: setSoundTimer,
      0x1E: addIVx,
      0x29: loadIVx,
      0x33: storeBcd,
      0x55: loadIV0ToVx,
      0x65: loadV0ToVxI
    }

    // Fx07 - LD Vx, DT -> The value of DT is placed into Vx.
    function loadDelayTimer () {
      vRegisters[inst.x] = delayTimer
    }

    // Fx15 - LD DT, Vx -> DT is set equal to the value of Vx.
    function setDelayTimer () {
      delayTimer = vRegisters[inst.x]
    }

    // Fx1E - ADD I, Vx
    // Set I = I + Vx.
    // The values of I and Vx are added, and the results are stored in I.
    function addIVx () {
      const value = iRegister + vRegisters[inst.x]
      
      if (value > 0xFFF) {
        vRegisters[0xF] = 1
      } else {
        vRegisters[0xF] = 0
      }

      iRegister = value & 0xFFF
    }

    // Fx29 - LD F, Vx
    // Set I = location of sprite for digit Vx.
    // The value of I is set to the location for the hexadecimal sprite corresponding to the value of Vx.
    function loadIVx () {
      iRegister = vRegisters[inst.x] * 5
    }

    // Fx33 - LD B, Vx
    // Store BCD representation of Vx in memory locations I, I+1, and I+2.
    // The interpreter takes the decimal value of Vx, and places the hundreds digit in 
    // memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.
    function storeBcd () {
      const dec = vRegisters[inst.x]

      // For a given value, say 234
      memory[iRegister] = Math.floor(dec / 100) // Gives us 2
      memory[iRegister + 1] = Math.floor(dec / 10) % 10 // Gives us 3
      memory[iRegister + 2] = dec % 10 // Gives us 4
    }

    // Fx55 - LD [I], Vx -> V[0]...V[x] => memory[I]...memory[I + x]
    function loadIV0ToVx () {
      for (let i = 0; i <= inst.x; i += 1) {
        memory[iRegister + i] = vRegisters[i]
      }
    }

    // Fx65 - LD Vx, [I] -> The interpreter reads values from memory starting at location I into registers V0 through Vx.
    function loadV0ToVxI () {
      for (let i = 0; i <= inst.x ; i += 1) {
        vRegisters[i] = memory[iRegister + i]
      }
    }

    // Fx0A - LD Vx, K
    // Wait for a key press, store the value of the key in Vx.
    // All execution stops until a key is pressed, then the value of that key is stored in Vx.
    function waitForKeyPress () {
      const keyPressed = keyboard.getAny()

      if (!keyPressed) {
        // keep looping until a key is pressed
        pc -= 2
        return
      }
      vRegisters[inst.x] = keyPressed
      return keyPressed
    }

    // Fx18 - LD ST, Vx -> Set sound timer = Vx.
    function setSoundTimer () {
      soundTimer = vRegisters[inst.x]
    }

    if (!microOpCodes[inst.kk]) {
      debugger
      return
    }

    return microOpCodes[inst.kk]()
  }

  function notImplemented (nnn) {
    debugger
  }

  return {
    getDisplay,
    setMemory,
    start,
    reset
  }
}