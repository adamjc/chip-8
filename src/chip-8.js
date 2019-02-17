import loggerFactory from './logger' // laugh it up, Joel

const logger = new loggerFactory(true)

// Made with a loooot of help from this excellent resource: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM

// CHIP-8 Interpreter
const WORD_SIZE = 8

// It has 16 8-bit data registers. V[0xF] is the carry register.
let vRegisters = new Array(16)

// It also has a 16-bit register, usually used for addressing memory
let iRegister

// It was originally designed to work on 4k computers, so lets give ourselves 4k of memory
// 0x0 -> 0x1FF is used to store the system font (it was originally used to store the interpreter data, back when it was ran on 4k systems)
// 0x200 -> 0xFFF is used to store the program data
let memory = new Array(4096)

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

memory.splice(0, fonts.length, ...fonts)

// There are 2 timers, a delay timer and a sound timer, both decrease to 0 at a rate of 60Hz, once at 0 they stay there.
let delayTimer

// When the sound timer hits 0, a monotone sound is played.
let soundTimer

// And of course a (16-bit) program counter, starting at... 0x200 (where the program is loaded in!)
let pc = 0x200

// A stack pointer, allows us to have function calls.
let sp = 0
// The stack. Documentation says it's 16 deep, but apparently only 10 are ever used? I'll stick with 16 just in case...
let stack = new Array(16)

// It utilises a 64x32 pixel display... we will get the chip-8 to write to these values, and in our `emulator` code, we will write these
// values to a screen. Simple! (should be!).
const DISPLAY_WIDTH = 64
const DISPLAY_HEIGHT = 32
let display = new Array(DISPLAY_WIDTH).fill().map(_ => new Array(DISPLAY_HEIGHT).fill(0))

// does a cpu cycle innit.
function cycle () {
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
  // Many of the instructions follow the structure below, so to make my life simpler, I will calculate these values from the instruction
  // We are using bitmasking to get these values. If you don't quite get what's happening here, look up https://en.wikipedia.org/wiki/Mask_(computing)
  logger.log('-----')
  logger.log('inst', inst)
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
  logger.log('clearAndReturnOpcodes')
  // is the last bit set? if it is, it's the 'RET' function, otherwise it's the 'CLS' function
  if (inst.nnn & 0x00F) {
    returnFromSub() // 0x00EE
  } else {
    clearScreen() // 0x00E0
  }

  // 00E0 - CLS
  function clearScreen () {
    logger.log('clearScreen') 
  }

  // 00EE - RET
  // The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack pointer.
  // We're doing it the other way around (subtract, THEN set), because otherwise our 'stack's' (which is an array) first element
  // is never set (stack[0] will never be used)
  function returnFromSub () {
    logger.log('returnFromSub')
    
    sp -= 1
    pc = stack[sp]
  }
}

// 1nnn - JP addr
function jump (nnn) {
  logger.log('jump')
  // Jump to location nnn.  
}

// 2nnn - CALL addr
// Call subroutine at nnn.
// The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set to nnn.
// We're doing this the other way around (set, then increment), see 00EE for more info.
function callSubroutine (inst) {
  logger.log('callSubroutine')

  stack[sp] = pc
  sp += 1
  pc = inst.nnn

  logger.log('sp', sp)
  logger.log(`stack[${sp}]`, stack[sp])
  logger.log('pc', pc)
}

//  3xkk - SE Vx, byte
function skipIfVxkk (nnn) {
  logger.log('skipIfVxkk')
  //   Skip next instruction if Vx = kk.

  // The interpreter compares register Vx to kk, and if they are equal, increments the program counter by 2.
}

// 4xkk - SNE Vx, byte
function skipIfNotVxkk (nnn) {
  logger.log('skipIfNotVxkk')
  // Skip next instruction if Vx != kk.

  // The interpreter compares register Vx to kk, and if they are not equal, increments the program counter by 2.
}

// 5xy0 - SE Vx, Vy
function skipIfVxVy (nnn) {
  logger.log('skipIfVxVy')
  // Skip next instruction if Vx = Vy.

  // The interpreter compares register Vx to register Vy, and if they are equal, increments the program counter by 2.
}

// 6xkk - LD Vx, byte
// Set Vx = kk.
// The interpreter puts the value kk into register Vx.
function loadVxVal (inst) {
  vRegisters[inst.x] = inst.kk
  console.log(`vRegister[${inst.x.toString(16)}] = ${inst.kk.toString(16)}`)
}

// 0x7000
// Set Vx = Vx + kk.
// Adds the value kk to the value of register Vx, then stores the result in Vx. 
function addVxVal (inst) {
  logger.log('addVxVal')
  vRegisters[inst.x] = vRegisters[inst.x] + inst.kk
  logger.log(`vRegisters[${inst.x}]`, vRegisters[inst.x])
}

// 0x8000
function settingFuncs (nnn) {
  // 8xy0 - LD Vx, Vy
  // Set Vx = Vy.
  
  // Stores the value of register Vy in register Vx.
  
  
  // 8xy1 - OR Vx, Vy
  // Set Vx = Vx OR Vy.
  
  // Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx. A bitwise OR compares the corrseponding bits from two values, and if either bit is 1, then the same bit in the result is also 1. Otherwise, it is 0.
  
  
  // 8xy2 - AND Vx, Vy
  // Set Vx = Vx AND Vy.
  
  // Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx. A bitwise AND compares the corrseponding bits from two values, and if both bits are 1, then the same bit in the result is also 1. Otherwise, it is 0.
  
  
  // 8xy3 - XOR Vx, Vy
  // Set Vx = Vx XOR Vy.
  
  // Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result in Vx. An exclusive OR compares the corrseponding bits from two values, and if the bits are not both the same, then the corresponding bit in the result is set to 1. Otherwise, it is 0.
  
  
  // 8xy4 - ADD Vx, Vy
  // Set Vx = Vx + Vy, set VF = carry.
  
  // The values of Vx and Vy are added together. If the result is greater than 8 bits (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result are kept, and stored in Vx.
  
  
  // 8xy5 - SUB Vx, Vy
  // Set Vx = Vx - Vy, set VF = NOT borrow.
  
  // If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
  
  
  // 8xy6 - SHR Vx {, Vy}
  // Set Vx = Vx SHR 1.
  
  // If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
  
  
  // 8xy7 - SUBN Vx, Vy
  // Set Vx = Vy - Vx, set VF = NOT borrow.
  
  // If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
  
  
  // 8xyE - SHL Vx {, Vy}
  // Set Vx = Vx SHL 1.
  
  // If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2.
}

// 9xy0 - SNE Vx, Vy
function skipIfNotVxVy (nnn) {
  logger.log('skipIfNotVxVy')
  
  // Skip next instruction if Vx != Vy.

  // The values of Vx and Vy are compared, and if they are not equal, the program counter is increased by 2.
}

// 0xA000
// Annn - LD I, addr
// Set I = nnn.
// The value of register I is set to nnn.
function loadIAddr (inst) {
  iRegister = inst.nnn
  console.log(`iRegister = ${inst.nnn.toString(16)}`)
}

// Bnnn - JP V0, addr
// Jump to location nnn + V0.

// The program counter is set to nnn plus the value of V0.
function jumpV0Offset (nnn) {
  logger.log('jumpV0Offset')
}

// Cxkk - RND Vx, byte
// Set Vx = random byte AND kk.

// The interpreter generates a random number from 0 to 255, which is then ANDed with the value kk. The results are stored in Vx. See instruction 8xy2 for more information on AND.
function setVxRandom (nnn) {
  logger.log('setVxRandom')
}

// Dxyn - DRW Vx, Vy, nibble
// Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.

// The interpreter reads n bytes from memory, starting at the address stored in I. 
// These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). 
// Sprites are XORed onto the existing screen. 
// If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. 
// If the sprite is positioned so part of it is outside the coordinates of the display, 
// it wraps around to the opposite side of the screen. See instruction 8xy3 
// for more information on XOR, and section 2.4, Display, for more information on the Chip-8 
// screen and sprites.
function draw (inst) {
  let x = vRegisters[inst.x]
  let y = vRegisters[inst.y]
  vRegisters[0xF] = 0

  for (var i = 0; i < inst.n; i += 1) {
    if (y + i > DISPLAY_HEIGHT - 1) y = 0

    const line = memory[iRegister]
    iRegister += 1

    for (var j = 0; j < WORD_SIZE; j += 1) {
      if (x + j > DISPLAY_WIDTH - 1) x = 0

      const bitmask = 0b00000001 << (WORD_SIZE - 1 - j)
      const pixel = (line & bitmask) >> (WORD_SIZE - 1 - j)
      
      const currentPixel = display[x + j][y + i]
      const newPixel = currentPixel ^ pixel

      display[x + j][y + i] = newPixel

      vRegisters[0xF] = newPixel
    }
  }
}

// Ex9E - SKP Vx
// Skip next instruction if key with the value of Vx is pressed.

// Checks the keyboard, and if the key corresponding to the value of Vx is currently in the down position, PC is increased by 2.


// ExA1 - SKNP Vx
// Skip next instruction if key with the value of Vx is not pressed.

// Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is increased by 2.
function skipKey (nnn) {
  logger.log('skipKey')
}

// 0xF000
function registerManipulation (inst) {
  logger.log('registerManipulation')

  const microOpCodes = {
    0x29: loadIVx,
    0x33: storeBcd,
    0x65: loadVxI
  }

  // Fx29 - LD F, Vx
  // Set I = location of sprite for digit Vx.
  // The value of I is set to the location for the hexadecimal sprite corresponding to the value of Vx. See section 2.4, Display, for more information on the Chip-8 hexadecimal font.
  function loadIVx () {
    logger.log('loadIVx')
    iRegister = vRegisters[inst.x] * 5
  }

  // Fx33 - LD B, Vx
  // Store BCD representation of Vx in memory locations I, I+1, and I+2.
  // The interpreter takes the decimal value of Vx, and places the hundreds digit in 
  // memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.
  function storeBcd () {
    logger.log('storeBcd')
    const dec = vRegisters[inst.x]

    // For a given value, say 234
    memory[iRegister] = Math.floor(dec / 100) // Gives us 2
    memory[iRegister] = Math.floor(dec / 10) % 10 // Gives us 3
    memory[iRegister] = dec % 10 // Gives us 4
  }

  // Fx65 - LD Vx, [I]
  // Read registers V0 through Vx from memory starting at location I.
  // The interpreter reads values from memory starting at location I into registers V0 through Vx.
  function loadVxI () {
    logger.log('loadVxI')

    for (let i = 0; i <= inst.x ; i++) {
      vRegisters[i] = memory[iRegister + i]
    }
  }

  return microOpCodes[inst.kk]()
  // Fx07 - LD Vx, DT
  // Set Vx = delay timer value.

  // The value of DT is placed into Vx.


  // Fx0A - LD Vx, K
  // Wait for a key press, store the value of the key in Vx.

  // All execution stops until a key is pressed, then the value of that key is stored in Vx.


  // Fx15 - LD DT, Vx
  // Set delay timer = Vx.

  // DT is set equal to the value of Vx.


  // Fx18 - LD ST, Vx
  // Set sound timer = Vx.

  // ST is set equal to the value of Vx.


  // Fx1E - ADD I, Vx
  // Set I = I + Vx.

  // The values of I and Vx are added, and the results are stored in I.


  // Fx55 - LD [I], Vx
  // Store registers V0 through Vx in memory starting at location I.

  // The interpreter copies the values of registers V0 through Vx into memory, starting at the address in I.
}

function notImplemented (nnn) {
  logger.log('function not implemented')
}

export default {
  cycle,
  display,
  memory
}