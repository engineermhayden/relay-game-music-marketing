export class Soundscape {
  private context?: AudioContext;
  enabled = false;
  async toggle() { this.enabled=!this.enabled; if(this.enabled){this.context??=new AudioContext();await this.context.resume();this.cue('scan');} return this.enabled; }
  cue(kind: string) {
    if(!this.enabled||!this.context)return;
    const c=this.context, o=c.createOscillator(),g=c.createGain();
    o.type='sine'; o.frequency.setValueAtTime(kind==='scan'?180:520,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(kind==='scan'?900:1040,c.currentTime+.25);
    g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.06,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.5);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.55);
  }
  dispose(){void this.context?.close();}
}
