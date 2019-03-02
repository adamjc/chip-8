export default (chip8, parentDOM) => {
  const SCALE = 10

  function create () {
    const DISPLAY_WIDTH = chip8.getDisplay().length
    const DISPLAY_HEIGHT = chip8.getDisplay()[0].length
  
    const phaserDisplay = new Array(DISPLAY_WIDTH).fill().map(_ => new Array(DISPLAY_HEIGHT).fill(0))
  
    for (let x = 0; x < phaserDisplay.length; x += 1) {
      for (let y = 0; y < phaserDisplay[x].length; y += 1) {
        phaserDisplay[x][y] = new Phaser.Geom.Rectangle(x * SCALE, y * SCALE, SCALE, SCALE)
      }
    }
  
    this.phaserDisplay = phaserDisplay
    this.graphics = this.add.graphics({ fillStyle: { color: 0xffffff }})
    this.pipeline = this.game.renderer.addPipeline('Pipeline', new Pipeline(this.game))
    this.applyPipeline()
  }
  
  function update (_, delta) {
    const cpuSpeed = 1000 / 500 // 500Mhz
    // cycle the CPU "many" times, depending on how long the draw loop took
    const cycles = Math.floor(delta / cpuSpeed)
    for (var i = 0; i < cycles; i += 1) {
      chip8.cycle(delta)
    }
  
    if (chip8.getDrawFlag()) {
      this.graphics.clear()  
      const display = chip8.getDisplay()
      for (var x = 0; x < display.length; x += 1) {
        for (var y = 0; y < display[0].length; y += 1) {
          const pixel = display[x][y]
          this.graphics.fillStyle(pixel ? 0xffffff : 0x0)
          const rect = this.phaserDisplay[x][y]
          this.graphics.fillRectShape(rect)
        }
      }
      chip8.drawFlag = false
    }
  }
  
  const Scene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Scene () {
      Phaser.Scene.call(this, { key: 'example' })
    },
    create: create,
    applyPipeline: applyPipeline,
    update: update
  })
  
  const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 320,
    parent: parentDOM,
    scene: [ Scene ]
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

  return new Phaser.Game(config)
}



