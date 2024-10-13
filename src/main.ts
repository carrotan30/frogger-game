/**
 * FIT2102 Assignment 1
 * Frogger Arcade Game
 *
 * A 2D game created on an SVG canvas based on the arcade game, Frogger.
 * Created using functional reactive programming concepts and Obeservables from the RxJs library.
 * Side effects are contained as much as possible and functions are written to be pure unless stated otherwise.
 *
 * Written heavily based on the Asteroids example provided by Tim Dwyer.
 * The Model-View-Controller (MVC) architecture and usage of observables is similar to the example, 
 * but the overall functionalities have been modified to suit this game. 
 * 
 * Asteroids example can be found here: https://stackblitz.com/edit/asteroids05?file=index.ts
 * 
 * @author Caleb Tan En Hong
 * @since 14.09.22
 */

/**
 * Imports
 * 
 * The game utilises operators and Observables from the RxJS library to implement FRP concepts.
 */
import "./style.css";
import { interval, fromEvent, merge} from 'rxjs'
import { map, scan, filter} from 'rxjs/operators'

/**
 * The type for Keyboard Event keys that will be detected in the game.
 */
type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'KeyR'

/**
 * The type of Event inputs that will be detected by the game.
 */
type Event = 'keydown'

/**
 * The main function that runs at the start of the program.
 * This function intialises the entire game. 
 */
function main() {
  /**
   * Inside this function classes and functions from rx.js are used to add visuals to the svg element in index.html, 
   * animate them, and make them interactive.
   */

  /**
   * This is the view for the game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

  /**
   * Constants.
   * These values remain constant throughout every state of the game. 
   */
  const 
    Constants = {
      CANVAS_WIDTH: 600,
      CANVAS_HEIGHT: 550,
      START_TIME: 0,
      VEHICLE_ROW_COUNT: 4,
      PLANK_ROW_COUNT: 4,
      CROCODILE_COUNT: 1,
      FLY_COUNT: 1,
      DESTINATION_COUNT: 5,
      DESTINATION_HEIGHT: 50,
      FROG_START_X: 300,
      FROG_START_Y: 510,
      FLY_START_X: -100,
      FLY_START_Y: 15
    } as const

  /**
   * Entity view types. 
   * The following view types are applied to every available entity in the game.
   */
  type ViewType = 'frog' | 'vehicle' | 'plank' | 'river' | 'end' | 'block' | 'crocodile' | 'fly' | 'crochead'
  
  /**
   * Game state transitions.
   * The following game states represent different events that occur from an observable stream.
   */

  // Tick keep tracks on the time interval elapsed.
  class Tick {
    constructor(public readonly elapsed:number) {}
  }

  // Move keep tracks on whether the frog is moving in any direction.
  class Move {
    constructor(public readonly x:number, public readonly y:number, public readonly isScore:boolean) {}
  }

  // Restart keep tracks on whether the user asks the game to restart a new game.
  class Restart {
    constructor() {}
  }

  /**
   * The game clock stream is used to keep track of the elapsed time. It gives a sense of time passing in the game.
   */
  const
    gameClock$ = interval(10)
      .pipe(map(elapsed=>new Tick(elapsed)))

  /**
   * This function reads any keyboard event inputs from the user and assigns an event to it.
   */
  const
    keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,e)
      .pipe(
        filter(({code})=>code === k),
        filter(({repeat})=>!repeat),
        map(result)),
    
    // Reads arrow up which represents the frog moving forward.
    moveUp$ = keyObservable('keydown','ArrowUp',()=>new Move(0, -50, true)),

    // Reads arrow down which represents the frog moving backwards.
    moveDown$ = keyObservable('keydown', 'ArrowDown', ()=>new Move(0, 50, false)),

    // Reads arrow left which represents the frog moving left.
    moveLeft$ = keyObservable('keydown', 'ArrowLeft', ()=>new Move(-50, 0, false)),

    // Reads arrow right which represents the frog moving right.
    moveRight$ = keyObservable('keydown', 'ArrowRight', ()=>new Move(50, 0, false)),

    // Reads key R which represents the user asking the game to restart a new game.
    restart$ = keyObservable('keydown', 'KeyR', ()=> new Restart())
  
  /**
   * Types applied to the entities in the game.
   */

  // Represents a rectangle object 
  type Rectangle = Readonly<{
    x: number,
    y: number,
    height: number,
    width: number,
    velX: number
  }>
  
  // Represents an entity with an object ID and create time.
  type ObjectId = Readonly<{
    id: string,
    createTime: number
  }>

  // Interface representing a rectangle entitiy with an object ID and create time.
  interface IBody extends Rectangle, ObjectId {
    viewType: ViewType,
  }

  // Every object that participates in collision represents a Body.
  type Body = Readonly<IBody>

  // The game state.
  type State = Readonly<{
    time:number,  // the time that has passed at the current state
    frog:Body,    // the frog entity that is controlled by the player
    vehicles:ReadonlyArray<Body>, // first array of vehicles appearing on the road
    vehicles2:ReadonlyArray<Body>,  // second array of vehicles appearing on the road
    vehicles3:ReadonlyArray<Body>,  // third array of vehicles appearing on the road
    vehicles4:ReadonlyArray<Body>,  // fourth array of vehicles appearing on the road
    planks:ReadonlyArray<Body>, // first array of planks appearing on the river
    planks2:ReadonlyArray<Body>,  // second array of planks appearing on the river
    planks3:ReadonlyArray<Body>,  // third array of planks appearing on the river
    croc:ReadonlyArray<Body>, // array of crocodiles appearing on the river
    crocHead:ReadonlyArray<Body>, // array of crocodile heads appearing on the river appending to the front of an crocodile entity
    destinations: ReadonlyArray<Body>,  // array of end destinations that the frog must reach to proceed with the game
    blocks: ReadonlyArray<Body>,  // array of blocks that represents destinations that have been reached
    fly: Body,  // the fly entity spawning in one of the end destinations
    reachDestID: string,  // the ID of a destination that has just been reached by the frog
    reachDestCount: number, // the cumulative count of destinations that have been reached by the frog
    destScore: number, // the cumulative total for scores obtained by reaching a destination
    fliesScore: number, // the cumulative total for scores obtained by collecting a fly
    moveScore: number,  // the cumulative total for scores obtained by moving forward except towards final zone
    totalScore:number,  // the cumulative total of all the scores obtained by all means
    highScore:number, // the highest score obtained in every state of game created
    level: number,  // the level of difficulty of the current game state
    levelPassed: boolean, // checks whether the player has passed the level by reaching all five destinations
    levelMultiplier: number,  // a multiplier that is applied to the velocity of moving obstacles that increase every level by 0.1
    gameOver:boolean, // checks whether the game is over where the player collides with an object that creates a game-over situtation
    livesCount: number // the total lives of the frog left until the frog dies
  }>

  /**
   * This function creates rectangle entities.
   * @param viewType the view type of an entity (represents its ID)
   * @param oid the object ID and start time
   * @param rect the rectangle entity properties
   */
  const createRectangle = (viewType: ViewType)=> (oid:ObjectId)=> (rect: Rectangle)=>
    <Body>{
      ...oid,
      ...rect,
      id: viewType+oid.id,
      viewType: viewType
    },

    // All entities in the game are created to be rectangles.
    createVehicle = createRectangle('vehicle'),
    createPlank = createRectangle('plank'),
    createEnd = createRectangle('end'),
    createBlock = createRectangle('block'),
    createCroc = createRectangle('crocodile'),
    createCrocHead = createRectangle('crochead')
  
  /**
   * Creating a frog entity.
   * @returns Frog entity body
   */
  function createFrog():Body {
    return {
      id: 'frog',
      viewType: 'frog',
      x: Constants.CANVAS_WIDTH/2,
      y: Constants.CANVAS_HEIGHT - 40,
      height: 30,
      width: 30,
      createTime:0,
      velX: 0
    }
  }

  /**
   * Creating a fly entity.
   * @returns Fly entity body
   */
  function createFly():Body {
    return {
      id: 'fly',
      viewType: 'fly',
      x: -100,
      y: 15,
      height: 20,
      width: 20,
      createTime:0,
      velX: 0
    }
  }

  // Velocity and position constants for entities: vehicles, planks, destinationss
  const 
    y_vehicles = [-140, -90, -240, -190], // the starting y postitions of the vehicles
    vel_vehicles = [-0.5, 2, -1, 3],      // the starting velocities of the vehicles
    y_planks = [-340, -490, -390, -440],  // the starting y positions of the planks
    width_planks = [100, 100, 200, 300],  // the widths of the planks
    vel_planks = [1, -2, 2, -1],          // the starting velocities of the planks
    x_dests = [25, 150, 275, 400, 525]    // the x positions of the destinations

  // Creating obstacle entities in the game
  const 
    // Creates the first array of vehicles 
    startVehicles = [...Array(Constants.VEHICLE_ROW_COUNT)]
    .map((_, i) => createVehicle({id:String(i) + "a", createTime:Constants.START_TIME})
                                ({x:0, y:Constants.CANVAS_HEIGHT + y_vehicles[i], height: 30, width: 50, velX: vel_vehicles[i]})
    ),

    // Creates the second array of vehicles 
    startVehicles2 = [...Array(Constants.VEHICLE_ROW_COUNT)]
    .map((_, i) => createVehicle({id:String(i) + "b", createTime:Constants.START_TIME})
                                ({x:150, y:Constants.CANVAS_HEIGHT + y_vehicles[i], height: 30, width: 50, velX: vel_vehicles[i]})
    ),

    // Creates the third array of vehicles 
    startVehicles3 = [...Array(Constants.VEHICLE_ROW_COUNT - 1)]
    .map((_, i) => createVehicle({id:String(i) + "c", createTime:Constants.START_TIME})
                                ({x:300, y:Constants.CANVAS_HEIGHT + y_vehicles[i], height: 30, width: 50, velX: vel_vehicles[i]})
    ),

    // Creates the fourth array of vehicles 
    startVehicles4 = [...Array(Constants.VEHICLE_ROW_COUNT - 3)]
    .map((_, i) => createVehicle({id:String(i) + "d", createTime:Constants.START_TIME})
                                ({x:450, y:Constants.CANVAS_HEIGHT + y_vehicles[i], height: 30, width: 50, velX: vel_vehicles[i]})
    ),

    // Creates the first array of planks 
    startPlanks = [...Array(Constants.PLANK_ROW_COUNT)]
    .map((_, i) => createPlank({id:String(i) + "a", createTime:Constants.START_TIME})
                                ({x:0, y:Constants.CANVAS_HEIGHT + y_planks[i], height: 30, width: width_planks[i], velX: vel_planks[i]})
    ),

    // Creates the second array of planks 
    startPlanks2 = [...Array(Constants.PLANK_ROW_COUNT - 2)]
    .map((_, i) => createPlank({id:String(i) + "b", createTime:Constants.START_TIME})
                                ({x:200, y:Constants.CANVAS_HEIGHT + y_planks[i], height: 30, width: width_planks[i], velX: vel_planks[i]})
    ),

    // Creates the third array of planks 
    startPlanks3 = [...Array(Constants.PLANK_ROW_COUNT - 2)]
    .map((_, i) => createPlank({id:String(i) + "c", createTime:Constants.START_TIME})
                                ({x:400, y:Constants.CANVAS_HEIGHT + y_planks[i], height: 30, width: width_planks[i], velX: vel_planks[i]})
    ),

    // Creates the array of crocodiles
    startCroc = [...Array(Constants.CROCODILE_COUNT)]
    .map((_, i) => createCroc({id:String(i), createTime:Constants.START_TIME})
                                ({x:300, y:Constants.CANVAS_HEIGHT + y_planks[2], height: 30, width: width_planks[2], velX: vel_planks[2]})
    ),

    // Creates the array of crocodile heads
    startCrocHead = [...Array(Constants.CROCODILE_COUNT)]
    .map((_, i) => createCrocHead({id:String(i), createTime:Constants.START_TIME})
                                ({x:480, y:Constants.CANVAS_HEIGHT + y_planks[2], height: 30, width: 50, velX: vel_planks[2]})
    ),

    // Creates the array of destinations
    startDest =  [...Array(Constants.DESTINATION_COUNT)]
    .map((_, i) => createEnd({id:String(i), createTime:Constants.START_TIME})
                                ({x:x_dests[i], y:2, height: 48, width: 60, velX: 0})
    ),

    // Creates the array of blocks under the destinations
    startBlocks =  [...Array(Constants.DESTINATION_COUNT)]
    .map((_, i) => createBlock({id:String(i), createTime:Constants.START_TIME})
                                ({x:x_dests[i], y:2, height: 48, width: 60, velX: 0})
    ),

    /**
     * This function wraps a position around the edges of the canvas.
     * @param c value of a position
     * @returns a new position wrapped around the edge of the canvas
     */
    torusWrap = (c: number) => { 
      const w=Constants.CANVAS_WIDTH, 
        wrap = (v:number) => v <= 0 ? v + w : v >= w ? v - w : v;
      return wrap(c)
    },
    
    /**
     * This function blocks the frog from entering the final zone.
     * @param c value of a position
     * @returns the previous position that the frog was at before it tried to enter the final zone
     */
    borderBlock = (c: number) => {
      const 
        s = Constants.CANVAS_HEIGHT,
        block = (v:number) => v <= 0 ? v + 50 : v >= s ? v - 50 : v;
      return block(c)
    },

    /**
     * This functions handles all the movement of all entities in the games
     * @param o an entity body
     * @param s the current game state
     */
    moveBody = (o:Body, s:State) => 
    <Body>{
      ...o,
      x: torusWrap(o.x + o.velX * s.levelMultiplier),
      y: borderBlock(o.y)
    },

    // check a State for collisions:
    //   frog colliding with vehicle or river or canvas sides ends with game over
    //   frog colliding with destination ends eith victory and adds score
    //   frog colliding with planks gives frog same velocity as plank
    /**
     * This functions handles all collisions between the frog entity and another entity.
     * A frog colliding with vehicle, river, canvas sides or crocodile head: Decreases the lives by 1 until it reaches zero, then game over
     * A frog colliding with destination turns it into blocks and adds to the score.
     * A frog colliding with planks or crocodile gives the frog the same velocity as the plank..
     * A frog colliding with a fly adds to the score.
     * A frog colliding with final zone or outside the canvas does not let it move to that position
     * 
     * @param s The current game state
     */
    handleCollisions = (s:State) => {
      const
        // Checks whether two body entities intersect one another (collision)
        bodiesCollided = ([a,b]:[Body,Body]) => (a.x + a.width >= b.x) && (a.x <= b.x + b.width) && (a.y + a.height <= b.y + b.height) && (a.y >= b.y),
        
        // Checks whether frog collides with planks or crocodile
        collidedPlanks: ReadonlyArray<Body> = [s.planks, s.planks2, s.planks3, s.croc].flatMap(p => p.filter(p=>bodiesCollided([s.frog, p]))),
        
        // Checks whether frog collides with vehicle
        collidedVehicle: ReadonlyArray<Body> = [s.vehicles, s.vehicles2, s.vehicles3, s.vehicles4].flatMap(v => v.filter(v=>bodiesCollided([s.frog, v]))),
        
        // Checks whether frog collides with canvas left and right sides
        collidedSides = s.frog.x >= Constants.CANVAS_WIDTH || s.frog.x <= 0,

        // Checks whether frog collides with river
        collidedRiver = s.frog.y >= 50 && s.frog.y <= 250 && collidedPlanks.length <= 0,

        // Checks whether frog collides with destinations
        collidedEnd: ReadonlyArray<Body> = s.destinations.filter(d=>bodiesCollided([s.frog, d])),

        // Checks whether frog collides with crocodile head
        collidedCrocHead: ReadonlyArray<Body> = s.crocHead.filter(c=>bodiesCollided([s.frog, c])),

        // Checks whether frog collides with final zone or canvas top and bottom
        collidedFinalZone = s.frog.y <= 50 && collidedEnd.length <= 0,

        // Checks whether frog collides with blocks
        collidedBlocks: Array<Body> = s.blocks.filter(b=>bodiesCollided([s.frog, b])),

        // Checks whether frog collides with fly
        collidedFly = bodiesCollided([s.fly, s.frog]),

        // Checks whether frog collides with an entity that results in the loss of 1 life
        collidedDeath = collidedVehicle.length > 0 || collidedSides || collidedRiver || collidedCrocHead.length > 0
      
      return <State>{
        ...s,
        frog: {
          ...s.frog,
          x: collidedEnd.length > 0 || collidedDeath ? Constants.FROG_START_X : s.frog.x,
          y: collidedEnd.length > 0 || collidedDeath ? Constants.FROG_START_Y : collidedFinalZone || collidedBlocks.length > 0 ? s.frog.y + 50 : s.frog.y,
          velX: collidedPlanks.length > 0 ? collidedPlanks[0].velX: 0
        },
        fly: {
          ...s.fly,
          x: collidedFly ? Constants.FLY_START_X : s.fly.x,
          y: collidedFly ? Constants.FLY_START_Y : s.fly.y
        },
        reachDestID: collidedEnd.length > 0 ? collidedEnd[0].id: "",
        destinations: s.destinations.map((b) => b.id === s.reachDestID ? {...b, y:b.y - 100}: b),
        reachDestCount: collidedEnd.length > 0 ? s.reachDestCount + 1: s.reachDestCount,
        levelPassed: s.reachDestCount === Constants.DESTINATION_COUNT ? true : false,
        destScore: collidedEnd.length > 0 ? s.destScore + 100 : s.destScore,
        fliesScore: collidedFly && !collidedBlocks ? s.fliesScore + 50 : s.fliesScore,
        totalScore: s.destScore + s.fliesScore + s.moveScore,
        highScore: s.totalScore >= s.highScore ? s.totalScore : s.highScore,
        livesCount: collidedDeath ? s.livesCount - 1 : s.livesCount,
        gameOver: s.livesCount === 0 ? true : false,
      }
    }
  
  /**
   * Initial game state.
   * The properties have the same meaning as in the game state type.
   */
  const initialState: State = {
    time:0,
    frog: createFrog(),
    vehicles: startVehicles,
    vehicles2: startVehicles2,
    vehicles3: startVehicles3,
    vehicles4: startVehicles4,
    planks: startPlanks,
    planks2: startPlanks2,
    planks3: startPlanks3,
    croc: startCroc,
    crocHead: startCrocHead,
    destinations: startDest,
    blocks: startBlocks,
    fly: createFly(),
    reachDestCount: 0,
    reachDestID: "",
    destScore: 0,
    fliesScore: 0,
    moveScore: 0,
    totalScore: 0,
    highScore: 0,
    level: 1,
    levelPassed: false,
    levelMultiplier: 0.5,
    gameOver: false,
    livesCount: 3
  }

  /**
   * This function allows movement of moving entities in intervals, like a tick in time.
   * This is one out of two impure functions in the code.
   * Math.random() is used here to determine the new position of the fly to spawn in, this makes the function impure as Math.random is impure.
   * It is used to reuse the array of x positions of the destinations and to ensure that the fly spawns in the correct positions.
   * 
   * @param s The current game state
   * @param elapsed The total elapsed time
   * @returns A state where moving entities have changed their positions
   */
  const tick = (s:State,elapsed:number) => {
    return handleCollisions({...s, 
      frog: moveBody(s.frog, s),
      vehicles: s.vehicles.map(function(x) {return moveBody(x, s)}),
      vehicles2: s.vehicles2.map(function(x) {return moveBody(x, s)}),
      vehicles3: s.vehicles3.map(function(x) {return moveBody(x, s)}),
      vehicles4: s.vehicles4.map(function(x) {return moveBody(x, s)}),
      planks: s.planks.map(function(x) {return moveBody(x, s)}),
      planks2: s.planks2. map(function(x) {return moveBody(x, s)}),
      planks3: s.planks3.map(function(x) {return moveBody(x, s)}),
      croc: s.croc.map(function(x) {return moveBody(x, s)}),
      crocHead: s.crocHead.map(function(x) {return moveBody(x, s)}),
      fly: {
        ...s.fly,
        x: s.time % 500 == 0 && s.time != 0 ? x_dests[Math.floor(Math.random() * Constants.DESTINATION_COUNT)] + 20 : s.fly.x
      },
      time:elapsed
    })
  }


  /**
   * This function is a state transducer that changes properties of the state when there is an event detected.
   * @param s The current game state
   * @param e The detected event
   * @returns A state where the result of the event is applied to the respective properties of the state
   */
  const reduceState = (s:State, e:Move|Tick|Restart) => 
    e instanceof Move ? { ...s,
      frog : {...s.frog, x: s.frog.x + e.x, y: s.frog.y + e.y},
      moveScore : e.isScore && s.frog.y > 100 ? s.moveScore + 10 : s.moveScore
    }:
    e instanceof Restart ? {
      ...s,
      gameOver: true
    }:
    tick(s,e.elapsed);

  /**
   * This functions updates the view of the entities on the SVG canvas.
   * It visualises the animations on the canvas and changes their HTML attributes accordingly. 
   * It is one out of two impure functions in the code. 
   * @param s The current game state
   */
  function updateView(s: State) {
    const 
      // The SVG canvas
      svg = document.getElementById("svgCanvas")!,

      // The frog entity on the canvas
      frog = document.getElementById("frog")!,

      // The score value on the canvas
      score = document.getElementById("score")!,

      // The highscore value on the canvas
      highscore = document.getElementById("highscore")!,

      // The level value on the canvas
      level = document.getElementById("level")!,

      // The lives value on the canvas
      lives = document.getElementById("lives")!
    
    // Setting frog positions and appending on canvas
    frog.setAttribute("x", String(s.frog.x));
    frog.setAttribute("y", String(s.frog.y));
    svg.appendChild(frog)

    // Setting text values: level, score, highscore, lives
    level.textContent = String(s.level);
    score.textContent = String(s.totalScore);
    s.totalScore >= s.highScore ? highscore.textContent = String(s.totalScore) : null;
    lives.textContent = String(s.livesCount);

    /**
     * This function creates a body on the canvas or updates the position of an already created body.
     * @param b An entity body
     */
    const updateBodyView = (b:Body) => {
      /**
       * This functions creates a new body entity
       * @returns A newly created body entity
       */
      function createBodyView() {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        Object.entries({
          id: b.id,
          x: String(b.x),
          y: String(b.y),
          width: String(b.width),
          height: String(b.height)
        }).forEach(([key, val]) => v.setAttribute(key, String(val)))
        v.classList.add(b.viewType)
        svg.appendChild(v)
        
        // Fills destinations with a color
        v.id.startsWith("end") ? v.setAttribute("fill", "#E74C3C") : null
        return v;
      }

      // Checks whether the entity exists
      const v = document.getElementById(b.id) || createBodyView();

      // Changes position of the moving entities
      v.setAttribute("x", String(b.x));
      v.setAttribute("y", String(b.y));
    };

    // Updates the view of all entities in the game on the canvas
    s.vehicles.forEach(updateBodyView);
    s.vehicles2.forEach(updateBodyView);
    s.vehicles3.forEach(updateBodyView);
    s.vehicles4.forEach(updateBodyView);
    s.planks.forEach(updateBodyView);
    s.planks2.forEach(updateBodyView);
    s.planks3.forEach(updateBodyView);
    s.croc.forEach(updateBodyView);
    s.crocHead.forEach(updateBodyView);
    s.blocks.forEach(updateBodyView);
    s.destinations.forEach(updateBodyView);
    updateBodyView(s.fly)

    // Game over scenario where there are zero lives left
    if(s.gameOver) {
      // Shows game over text
      const v = document.createElementNS(svg.namespaceURI, "text")!;
      Object.entries({
        id: "gameover",
        x: "100",
        y: "225",
        fill: "red",
        class: "gameover"
      }).forEach(([key, val]) => v.setAttribute(key, String(val)))
      v.textContent = "Game Over";
      
      // Shows restart text
      const w = document.createElementNS(svg.namespaceURI, "text")!;
      Object.entries({
        id: "restart",
        x: "125",
        y: "280",
        fill: "red",
        class: "restart"
      }).forEach(([key, val]) => w.setAttribute(key, String(val)))
      w.textContent = "Press \"R\" to restart game";

      // Appends game over and restart text on the screen
      svg.appendChild(v);
      svg.appendChild(w);

      /**
       * Listens for R key keydown event to indicate a restart of a new game state
       */
      const restartKeyDown = fromEvent<KeyboardEvent>(document, "keydown")
        .pipe(
          map(({ key }) => {
            if (key === "r") {
              svg.removeChild(document.getElementById("gameover")!);
              svg.removeChild(document.getElementById("restart")!);
              restartKeyDown.unsubscribe();
              startGame(newGameState(s))
            }
          })
        )
        .subscribe();
    
    // Level passed scenario where the player filled in all 5 distinct destinations
    } else if (s.levelPassed) {
      startGame(newGameState(s))
    }
  }

  // Creates a new game state with its respective properties
  /**
   * This function creates a new game state with its respective properties
   * Game over: Game state like initial state, except high score
   * Level passed: Game state like initial state, except for all scores and multiplier and level properties are incremented
   * @param s The current game state
   * @returns A new game state 
   */
  function newGameState(s: State): State {
    // Game-over new game state
    if (s.gameOver) {
      return {
      ...s,
      time:0,
      frog: createFrog(),
      vehicles: startVehicles,
      vehicles2: startVehicles2,
      vehicles3: startVehicles3,
      vehicles4: startVehicles4,
      planks: startPlanks,
      planks2: startPlanks2,
      planks3: startPlanks3,
      croc: startCroc,
      crocHead: startCrocHead,
      destinations: startDest,
      blocks: startBlocks,
      reachDestCount: 0,
      fly: createFly(),
      reachDestID: "",
      destScore: 0,
      fliesScore: 0,
      moveScore: 0,
      totalScore: 0,
      level: 1,
      levelPassed: false,
      levelMultiplier: 0.5,
      gameOver: false,
      livesCount: 3
      }
    
    // Level passed new game state
    } else if (s.levelPassed){
      return {
      ...s,
      time:0,
      frog: createFrog(),
      vehicles: startVehicles,
      vehicles2: startVehicles2,
      vehicles3: startVehicles3,
      vehicles4: startVehicles4,
      planks: startPlanks,
      planks2: startPlanks2,
      planks3: startPlanks3,
      croc: startCroc,
      crocHead: startCrocHead,
      destinations: startDest,
      blocks: startBlocks,
      reachDestCount: 0,
      fly: createFly(),
      reachDestID: "",
      destScore: s.destScore,
      fliesScore: s.fliesScore,
      moveScore: s.moveScore,
      totalScore: s.totalScore,
      level: s.level + 1,
      levelPassed: false,
      levelMultiplier: s.levelMultiplier + 0.1,
      gameOver: false,
      livesCount: s.livesCount
      }

      // None of the above scenarios, return the same state
    } else {
      return s
    }
  }

  /**
   * This function is responsible for the main game stream
   * It merges the observables and pipes them to the state where the properties will be modified accordingly
   * It is subscribed and the view on the canvas changed accordingly with the modified properties
   * @param s The current game state
   */
  function startGame(s: State) {
    const subscription =
      merge(gameClock$, moveUp$, moveDown$, moveLeft$, moveRight$, restart$)
      .pipe(
        scan(reduceState, s))
      .subscribe((s) => {
        updateView(s)
        s.gameOver || s.levelPassed ? subscription.unsubscribe() : null
      });     
  }

  // Initial start of the first game state
  startGame(initialState);
}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}