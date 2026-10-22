import { buildTutorialSteps, TUTORIAL_REWARD } from '../data/tutorial.js';
import { TutorialMountain } from './TutorialMountain.js';
import { BALANCE } from '../config/balanceConfig.js';

const note = (dir) => ({ dir, gap: 1, hold: 0, hidden: false, gust: false });
const PRAISE = ['NICE!', 'GOOD CLIMBING!', 'THAT WAS SMOOTH.', 'YOU LEARN FAST!'];

// Runs the Training Crag lessons on top of the normal climbing scene, with
// Bram (TutorialCoach) talking you through them. Steps advance as the player
// reaches each lesson's hold. After a fall or an off-script catch, a single
// "back up" route returns them to the lesson.
export class TutorialDirector {
  constructor(scene, coach) {
    this.scene = scene;
    this.coach = coach;
    this.steps = buildTutorialSteps(BALANCE);
    this.lessons = this.steps.filter((s) => s.lesson);
    this.pointer = 0;
    this.shown = new Set();
    this.slipResult = null;
    this.finished = false;
    this.praise = 0;
    scene.mountain.scripted = (node) => this.routesFor(node);
  }

  get step() { return this.steps[this.pointer]; }
  get cardOpen() { return this.coach.open; }

  findNode(id) { return this.scene.mountain.findNode(id); }
  stepLevel(step) { return parseInt(step.from || step.at, 10); }

  // Scripted route offers (null = let the normal generator decide).
  routesFor(node) {
    let step = this.step;
    if (!step || this.finished) return null;
    if (step.type === 'rest' && step.at === node.id) {
      // Leaving a lesson ledge moves on to the next lesson.
      this.pointer++;
      step = this.step;
      if (!step) return null;
    }
    const make = (r) => TutorialMountain.makeRoute(node, this.findNode(r.to), r);
    if (step.type === 'route' && step.from === node.id) return step.routes.map(make);
    if (step.type === 'slip' && step.from === node.id) {
      // Offered underneath Bram's warning; the lesson empties your grip first.
      return [make({ to: '14:0', type: 'safe', notes: ['U', 'L', 'U'].map(note) })];
    }
    const targetId = step.type === 'rest' ? step.at : step.from;
    const target = this.findNode(targetId);
    if (target && target.level > node.level) {
      return [make({ to: targetId, type: 'safe', label: target.kind === 'ledge' ? undefined : 'BACK UP', notes: ['L', 'U', 'R'].map(note), beatMs: 700, windowScale: 1.2 })];
    }
    // Somehow above the lesson: jump ahead to the next lesson above us.
    const next = this.steps.findIndex((s, i) => i > this.pointer && this.stepLevel(s) >= node.level);
    if (next > 0) {
      this.pointer = next;
      return this.routesFor(node);
    }
    return null;
  }

  // Shows a step's lesson chip, goal and lines (once per step).
  begin(step, onDone) {
    const idx = this.steps.indexOf(step);
    if (this.shown.has(idx)) { if (onDone) onDone(); return; }
    this.shown.add(idx);
    if (step.lesson) {
      this.coach.lesson(this.lessons.indexOf(step) + 1, this.lessons.length, step.lesson);
      this.coach.setGoal(step.goal ? step.goal.text : null);
      this.coach.setWhen(step.when || null);
    }
    this.coach.say(step.say || [], onDone);
  }

  // Called after the routes are on screen.
  onRouteSelect(node) {
    const step = this.step;
    if (!step || step.from !== node.id) return;
    if (step.setGrip !== undefined && !this.shown.has(this.pointer)) this.scene.grip.set(step.setGrip);
    if (step.type === 'slip') {
      this.begin(step);
      // Routes are locked while the grip visibly drains away, then you slip.
      this.holdRoutes = true;
      this.scene.tweens.addCounter({
        from: this.scene.grip.value, to: 0, duration: 1600, ease: 'Quad.easeIn',
        onUpdate: (tw) => this.scene.grip.set(tw.getValue()),
        onComplete: () => {
          this.holdRoutes = false;
          if (this.step !== step || this.scene.state !== 'ROUTE_SELECT') return;
          this.slipResult = 'pending';
          this.pointer++;
          this.scene.grip.set(0);
          this.scene.startSlip();
        },
      });
      return;
    }
    this.begin(step);
  }

  onComboStart(route) {
    const step = this.step;
    if (step && step.type === 'route' && step.from === route.from.id && step.combo) this.coach.say([step.combo]);
  }

  // Checks the lesson goal and lets Bram react. Called before arriving.
  onComboEnd(route, summary, ok) {
    const step = this.step;
    if (!step || step.type !== 'route' || step.from !== route.from.id) return;
    const g = step.goal;
    if (g && g.later && ok) return;
    let met = ok;
    if (g && g.perfects) met = ok && summary.perfect >= g.perfects;
    if (g && g.noMiss) met = ok && summary.miss === 0;
    if (g && g.risky) met = ok && route.type === 'risky';
    if (met && (g || step.completes)) this.coach.completeGoal();
    if (!ok) { this.coach.say(['LOST IT! NO WORRIES,\nTRY THAT ONE AGAIN.']); return; }
    const line = met ? step.win : step.lose;
    this.coach.say([line || PRAISE[this.praise++ % PRAISE.length]]);
  }

  onArrive(node) {
    const step = this.step;
    if (!step || step.type !== 'route') return;
    // The route-choice lesson has three targets at different heights.
    if (step.routes.some((r) => r.to === node.id) || (step.routes.length > 1 && node.level > this.stepLevel(step))) this.pointer++;
  }

  onSlipCaught() { if (this.slipResult === 'pending') this.slipResult = 'caught'; }
  onFall() { if (this.slipResult === 'pending') this.slipResult = 'fell'; }

  // Called whenever the climber settles on a ledge.
  onRest(node) {
    if (this.slipResult === 'caught' || this.slipResult === 'fell') {
      const caught = this.slipResult === 'caught';
      this.slipResult = null;
      if (caught) this.coach.completeGoal();
      this.coach.say([caught
        ? 'GREAT CATCH! ON A REAL CLIMB YOU GRAB\nA LOWER HOLD AND KEEP GOING.'
        : 'OUCH! A FALL SENDS YOU BACK TO\nTHE LAST LEDGE. (SUMMIT: RUN OVER!)']);
      return;
    }
    const step = this.step;
    if (!step || step.type !== 'rest' || step.at !== node.id) return;
    // On the top ledge you stay until Bram is done (Space skips to his next line).
    if (step.final) this.holdRest = true;
    this.begin(step, step.final ? () => this.finish() : null);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    const reward = this.scene.grantTutorialReward(TUTORIAL_REWARD);
    this.scene.celebrateTutorial();
    this.coach.showFinal({
      title: 'TRAINING COMPLETE!',
      lines: ['YOU KNOW EVERYTHING THE MOUNTAIN', 'CAN THROW AT YOU. NOW GO HIGH!'],
      reward: reward ? `+${reward} GEMS FOR THE TRADER` : '',
    }, () => this.scene.onTutorialComplete());
  }
}
