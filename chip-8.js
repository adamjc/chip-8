const chip8 = (() => {
  // CHIP-8 Interpreter

  // It has 16 8-bit data registers. V[0xF] is the carry register.
  let vRegisters = new Array(16)

  // It also has a 16-bit register, usually used for addressing memory
  let iRegister

  // It was originally designed to work on 4k computers, so lets give ourselves 4k of memory
  // 0x0 -> 0x200 is used to store the system font (it was originally used to store the interpreter data, back when it was ran on 4k systems)
  // 0x200 -> 0xFFF is used to store the program data
  let memory = new Array(4096)

  // There are 2 timers, a delay timer and a sound timer, both decrease to 0 at a rate of 60Hz, once at 0 they stay there.
  let delayTimer

  // When the sound timer hits 0, a monotone sound is played.
  let soundTimer

  // And of course a program counter, starting at... 0x200 (where the program is loaded in!)
  let pc = 0x200

  // A stack pointer, allows us to have function calls. Documentation says it's 16 deep, but apparently only 10 are ever used? I'll stick with 16 just in case...
  let sp = new Array(16)

  // It utilises a 64x32 pixel display... we will get the chip-8 to write to these values, and in our `emulator` code, we will write these
  // values to a screen. Simple! (should be!).
  let display = new Array(64 * 32)

  // does a cpu cycle innit.
  function cycle () {
    // fetching from memory takes twoooo cycles, cos it's an 8-bit bus, but each instruction is 16-bits long. Neat-o. VLIW are lame.
    const inst = (memory[pc] << 8) + memory[pc + 1]
    
    // decode


    // execute
  }

  return {
    cycle,
    display,
    memory
  }
})()

